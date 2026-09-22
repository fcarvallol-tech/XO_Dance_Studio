-- PRD-0019 — Correo que no se pierde: registro, reintento y visibilidad.
--
-- NO ejecutar a mano: se aplica con `supabase db push`, primero a staging y a
-- producción solo con aprobación.
--
-- ---------------------------------------------------------------------------
-- Qué problema resuelve
-- ---------------------------------------------------------------------------
-- PRD-0006 §5, ADR-0007 y PRD-0017 §11 prometen desde agosto: *"Falla el email
-- pero la reserva se creó. La reserva vale. El comprobante se reintenta."*
--
-- La primera mitad existe y está bien: `enviar()` no lanza nunca, así que un
-- problema de correo no revierte ni una reserva ni una compra. **La segunda no
-- existía en ninguna parte del repositorio.** El error se atrapaba, se escribía
-- en un log que nadie lee y se devolvía un `false` que ninguno de los seis
-- llamadores miraba. Si Resend fallaba treinta segundos, la alumna reservaba,
-- se le descontaba el crédito y su comprobante no existía ni iba a existir:
-- **se perdía hasta el dato de a quién había que escribirle.**
--
-- Esta tabla es ese dato. Con ella el reintento se vuelve posible y los que
-- fallaron se pueden mirar.
--
-- Contratos que replican `lib/dominio/envios.ts`, con sus tests:
--   · el backoff es por tiempo, no por pasada del cron (PRD-0019 §8.4)
--   · caducado gana sobre fallido: un aviso con plazo que llega tarde miente
--   · a los 30 días se va el contenido y la fila queda

-- ---------------------------------------------------------------------------
-- 1. La tabla
-- ---------------------------------------------------------------------------

create table if not exists public.envios_correo (
  id uuid primary key default gen_random_uuid(),

  -- El nombre de la función de lib/correo.ts que arma el cuerpo.
  plantilla text not null,

  -- Nullable **a propósito**: la purga de los 30 días lo vacía y deja la fila.
  -- El check de abajo impide que quede en null por otra razón.
  destinatario text,
  datos jsonb,
  purgado_at timestamptz,

  -- Identifica el hecho, no el intento: dos clics en "Ya transferí" son el
  -- mismo hecho y tienen que dar un solo correo.
  clave_idempotencia text unique,

  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviado', 'fallido', 'descartado')),
  intentos smallint not null default 0 check (intentos >= 0),
  ultimo_error text,
  motivo_descarte text,
  proximo_intento_at timestamptz,
  enviado_at timestamptz,

  -- Desde cuándo este aviso deja de ser cierto. Null = no caduca.
  caduca_at timestamptz,

  -- A qué se refiere, para mirarlo desde la bandeja y desde la alumna.
  perfil_id uuid references public.perfiles (id),
  compra_id uuid references public.compras (id),
  reserva_id uuid references public.reservas (id),
  clase_id uuid references public.clases (id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- Un envío sin destinatario solo se explica por la purga.
  constraint envios_destinatario_o_purgado
    check (destinatario is not null or purgado_at is not null)
);

drop trigger if exists envios_correo_updated_at on public.envios_correo;
create trigger envios_correo_updated_at
  before update on public.envios_correo
  for each row execute function public.tocar_updated_at();

-- El barrido busca por acá: lo que todavía puede salir.
create index if not exists envios_correo_por_intentar_idx
  on public.envios_correo (proximo_intento_at)
  where estado in ('pendiente', 'fallido');

-- La bandeja de admin busca lo que quedó mal.
create index if not exists envios_correo_fallidos_idx
  on public.envios_correo (created_at desc)
  where estado in ('fallido', 'descartado');

-- La purga.
create index if not exists envios_correo_a_purgar_idx
  on public.envios_correo (enviado_at)
  where estado = 'enviado' and purgado_at is null;

comment on table public.envios_correo is
  $c$Cada correo transaccional que el sistema decidió mandar, registrado ANTES de intentarlo. Sin esto, un envío que falla no deja ni a quién había que escribirle. PRD-0019.$c$;

comment on column public.envios_correo.caduca_at is
  'Desde cuándo el aviso deja de ser cierto. Un pendiente de pago caduca con expira_at; un comprobante, con el inicio de la clase. El reintento descarta lo caducado en vez de mandarlo.';

comment on column public.envios_correo.datos is
  'Cuerpo del aviso. Contiene datos personales de alumnas menores: se purga a los 30 días y la fila queda sin él.';

-- ---------------------------------------------------------------------------
-- 2. RLS — es de las tablas más sensibles del sistema
-- ---------------------------------------------------------------------------
-- Guarda correos, nombres y el cuerpo de avisos de menores de edad. Sin
-- política para `anon` ni para una alumna: **lectura solo admin**, escritura
-- solo desde el servidor. Nada acá se abre "por comodidad".

alter table public.envios_correo enable row level security;

drop policy if exists envios_correo_admin_lee on public.envios_correo;
create policy envios_correo_admin_lee on public.envios_correo
  for select to authenticated using (public.tiene_nivel('admin'));

-- El grant de tabla es necesario para que la política pueda dejar pasar a
-- admin; sin él, ni con la política se lee. `anon` no aparece en ninguna línea.
grant select on public.envios_correo to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Funciones
-- ---------------------------------------------------------------------------
-- Todas reciben lo que ya decidió `lib/dominio/envios.ts`: acá no se recalcula
-- el backoff ni la caducidad. Duplicar esa regla en SQL sería tener dos
-- versiones de la misma decisión, y la de allá es la que tiene tests.

/**
 * Registra un envío **antes** de intentarlo. Idempotente por clave: si el hecho
 * ya estaba encolado, devuelve la fila que existe y no manda un segundo correo.
 *
 * `p_motivo_descarte` no null lo deja nacer `descartado` sin intentarse: es el
 * camino de los correos `.invalid` de las alumnas importadas. Se registra igual,
 * porque que no se le pueda escribir a alguien también es un dato.
 */
create or replace function public.encolar_correo(
  p_plantilla text,
  p_destinatario text,
  p_datos jsonb default null,
  p_clave text default null,
  p_caduca_at timestamptz default null,
  p_motivo_descarte text default null,
  p_perfil_id uuid default null,
  p_compra_id uuid default null,
  p_reserva_id uuid default null,
  p_clase_id uuid default null
)
returns public.envios_correo
language plpgsql
security definer
set search_path = public
as $$
declare
  v_envio public.envios_correo;
begin
  if coalesce(btrim(p_plantilla), '') = '' then
    raise exception 'Un envío necesita plantilla' using errcode = '23514';
  end if;

  insert into public.envios_correo
    (plantilla, destinatario, datos, clave_idempotencia, caduca_at,
     estado, motivo_descarte, proximo_intento_at,
     perfil_id, compra_id, reserva_id, clase_id)
  values
    (p_plantilla, p_destinatario, p_datos, nullif(btrim(p_clave), ''), p_caduca_at,
     case when p_motivo_descarte is null then 'pendiente' else 'descartado' end,
     p_motivo_descarte,
     case when p_motivo_descarte is null then now() else null end,
     p_perfil_id, p_compra_id, p_reserva_id, p_clase_id)
  on conflict (clave_idempotencia) do nothing
  returning * into v_envio;

  -- Ya estaba encolado: se devuelve el que hay, sin tocarlo.
  if v_envio is null and nullif(btrim(p_clave), '') is not null then
    select * into v_envio from public.envios_correo
    where clave_idempotencia = btrim(p_clave);
  end if;

  return v_envio;
end;
$$;

/** Salió. */
create or replace function public.marcar_enviado(p_id uuid)
returns public.envios_correo
language sql
security definer
set search_path = public
as $$
  update public.envios_correo
  set estado = 'enviado',
      enviado_at = now(),
      intentos = intentos + 1,
      proximo_intento_at = null,
      ultimo_error = null
  where id = p_id
  returning *;
$$;

/**
 * No salió. `p_proximo` null significa que se agotaron los reintentos: la fila
 * queda esperando que una persona la mire en el portal.
 */
create or replace function public.marcar_fallido(
  p_id uuid,
  p_error text,
  p_proximo timestamptz default null
)
returns public.envios_correo
language sql
security definer
set search_path = public
as $$
  update public.envios_correo
  set estado = 'fallido',
      intentos = intentos + 1,
      ultimo_error = left(coalesce(p_error, 'sin detalle'), 2000),
      proximo_intento_at = p_proximo
  where id = p_id
  returning *;
$$;

/** Caducado, sin correo real, o cualquier otra razón para no mandarlo nunca. */
create or replace function public.descartar_envio(p_id uuid, p_motivo text)
returns public.envios_correo
language sql
security definer
set search_path = public
as $$
  update public.envios_correo
  set estado = 'descartado',
      motivo_descarte = coalesce(nullif(btrim(p_motivo), ''), 'sin motivo'),
      proximo_intento_at = null
  where id = p_id
  returning *;
$$;

/**
 * Los candidatos del barrido. **Filtra ancho a propósito**: quién se reintenta
 * de verdad lo decide `debeReintentar()` en `lib/dominio/envios.ts`, que tiene
 * tests. Acá solo se evita traer la tabla entera.
 */
create or replace function public.envios_por_intentar(p_limite int default 200)
returns setof public.envios_correo
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.envios_correo
  where estado in ('pendiente', 'fallido')
    and deleted_at is null
  order by coalesce(proximo_intento_at, created_at)
  limit greatest(1, least(coalesce(p_limite, 200), 1000));
$$;

/**
 * El botón "Reintentar ahora" del portal.
 *
 * Reinicia la cuenta de intentos: es una decisión de una persona, no otra
 * pasada del cron, y sin eso un envío agotado no se podría volver a mandar
 * nunca. El último error se conserva, para que en la bandeja siga diciendo por
 * qué había fallado.
 *
 * Un `descartado` no se reintenta desde acá: si caducó, lo que hay que hacer es
 * hablarle a esa persona, no mandarle un aviso que ya no es cierto.
 */
create or replace function public.reintentar_envio(
  p_id uuid,
  p_actor_user_id uuid
)
returns public.envios_correo
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_envio public.envios_correo;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  select * into v_envio from public.envios_correo where id = p_id for update;

  if v_envio is null then
    raise exception 'Ese envío no existe' using errcode = 'P0002';
  end if;
  if v_envio.estado = 'enviado' then
    raise exception 'Ese correo ya salió' using errcode = '22023';
  end if;
  if v_envio.estado = 'descartado' then
    raise exception 'Un envío descartado no se reintenta: %', coalesce(v_envio.motivo_descarte, 'sin motivo')
      using errcode = '22023';
  end if;
  if v_envio.purgado_at is not null then
    raise exception 'A ese envío ya se le borró el contenido: no hay qué mandar' using errcode = '22023';
  end if;

  update public.envios_correo
  set estado = 'fallido',
      intentos = 0,
      proximo_intento_at = now()
  where id = v_envio.id
  returning * into v_envio;

  return v_envio;
end;
$$;

/**
 * La purga de §3.7: al entregado viejo se le va el contenido y **queda la
 * fila**, con a quién se le escribió, cuándo y con qué resultado. Es lo que
 * permite contestar "se te mandó el 3 a las 18:04" sin guardar para siempre
 * datos personales de una menor.
 */
create or replace function public.purgar_envios_viejos(p_dias int default 30)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  with purgados as (
    update public.envios_correo
    set destinatario = null,
        datos = null,
        purgado_at = now()
    where estado = 'enviado'
      and purgado_at is null
      and enviado_at <= now() - make_interval(days => greatest(1, coalesce(p_dias, 30)))
    returning id
  )
  select count(*)::int into v_n from purgados;

  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Permisos, escritos y no heredados del default
-- ---------------------------------------------------------------------------
-- `revoke ... from public` NO es `revoke ... from anon`: PUBLIC cubre a todos,
-- `authenticated` incluido, y las funciones nacen con EXECUTE para PUBLIC. Ya
-- rompió el login una vez (PRD-0008 §15), así que cada una lleva su revoke y su
-- grant explícitos.
--
-- Todas estas las llama el servidor con la service role: `reintentar_envio`
-- recibe al actor y verifica el rol adentro, como el resto del sistema.

revoke all on function public.encolar_correo(text, text, jsonb, text, timestamptz, text, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.marcar_enviado(uuid) from public, anon, authenticated;
revoke all on function public.marcar_fallido(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.descartar_envio(uuid, text) from public, anon, authenticated;
revoke all on function public.envios_por_intentar(int) from public, anon, authenticated;
revoke all on function public.reintentar_envio(uuid, uuid) from public, anon, authenticated;
revoke all on function public.purgar_envios_viejos(int) from public, anon, authenticated;

grant execute on function public.encolar_correo(text, text, jsonb, text, timestamptz, text, uuid, uuid, uuid, uuid)
  to service_role;
grant execute on function public.marcar_enviado(uuid) to service_role;
grant execute on function public.marcar_fallido(uuid, text, timestamptz) to service_role;
grant execute on function public.descartar_envio(uuid, text) to service_role;
grant execute on function public.envios_por_intentar(int) to service_role;
grant execute on function public.reintentar_envio(uuid, uuid) to service_role;
grant execute on function public.purgar_envios_viejos(int) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Lo que esta migración NO hace
-- ---------------------------------------------------------------------------
-- · No agenda el barrido: eso es `vercel.json` y una ruta, y va en la fase 5.
--   Mientras tanto la tabla se llena igual y nada se pierde, que era el punto.
-- · No recalcula el backoff ni la caducidad en SQL: los decide
--   `lib/dominio/envios.ts`, que tiene tests, y acá solo se guardan.
-- · No toca `lib/correo.ts` ni las seis plantillas: eso es la fase 4.
-- · No borra ninguna fila: la purga vacía el contenido y deja el rastro.
