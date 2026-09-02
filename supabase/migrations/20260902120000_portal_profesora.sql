-- PRD-0008 — Portal de la profesora.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`.
--
-- Dos restricciones mandan sobre todo lo demás, y las dos se imponen en la
-- base, no en la interfaz:
--
--   1. Una profesora ve **solo sus clases**.
--   2. De las inscritas ve **solo el nombre**. Ni correo, ni teléfono, ni
--      fecha de nacimiento, ni datos de apoderado. Nunca, tampoco para clases
--      pasadas: si necesita contactar a alguien, pasa por administración.
--
-- La segunda es la que obliga a la forma de este archivo. RLS filtra **filas,
-- no columnas**: darle a la profesora una política de select sobre `perfiles`
-- le entregaría la fila entera de cada alumna. Por eso no se le da ningún
-- acceso a `perfiles`, y los nombres salen por una función cuyo tipo de
-- retorno **es** el contrato.

-- ---------------------------------------------------------------------------
-- 1. Cerrar la fuga de saldo_creditos
-- ---------------------------------------------------------------------------
-- `saldo_creditos` es security definer —salta RLS— y estaba concedida a
-- `authenticated`: cualquiera con sesión que conociera un perfil_id ajeno podía
-- consultar cuántas clases tiene esa persona.
--
-- Hasta hoy era difícil de explotar porque nadie veía perfil_id de otros. **Este
-- PRD se los entrega a la profesora**, porque para listar inscritas necesita
-- leer `reservas`. O sea que este cambio convierte una debilidad teórica en una
-- alcanzable, y el saldo de clases es exactamente el dato financiero que el
-- portal de profesora tiene prohibido mostrar.
--
-- Se revoca a `authenticated`. No rompe nada: la interfaz de la alumna nunca la
-- llamó —`getSaldo` consulta `creditos` con su propia sesión y RLS— y las tres
-- funciones que la usan por dentro son security definer y corren como su dueño.

revoke execute on function public.saldo_creditos(uuid) from public, anon, authenticated;
grant execute on function public.saldo_creditos(uuid) to service_role;

-- El único consumidor que quedaba era esta vista, que la llamaba como
-- `authenticated`. Se reescribe con un subquery: `creditos_admin_lee` ya le
-- permite a admin leer todos los lotes, así que el saldo sale igual y ahora
-- pasando por RLS en vez de saltándola.
create or replace view public.duplicados_probables
with (security_invoker = true) as
select
  imp.id            as perfil_importado_id,
  imp.nombre        as nombre_importado,
  imp.email         as correo_temporal,
  nuevo.id          as perfil_nuevo_id,
  nuevo.email       as correo_nuevo,
  nuevo.created_at  as se_registro_at,
  (select coalesce(sum(c.cantidad_disponible), 0)::int from public.creditos c
    where c.perfil_id = imp.id and c.fecha_vencimiento > now())   as clases_del_importado,
  (select coalesce(sum(c.cantidad_disponible), 0)::int from public.creditos c
    where c.perfil_id = nuevo.id and c.fecha_vencimiento > now()) as clases_del_nuevo
from public.perfiles imp
join public.perfiles nuevo
  on nuevo.id <> imp.id
 and public.normalizar_nombre(nuevo.nombre) = public.normalizar_nombre(imp.nombre)
 and coalesce(btrim(nuevo.nombre), '') <> ''
where imp.pendiente_de_correo
  and not nuevo.pendiente_de_correo
  and imp.deleted_at is null
  and nuevo.deleted_at is null;

-- ---------------------------------------------------------------------------
-- 2. La cadena de identidad tiene un salto de tipo
-- ---------------------------------------------------------------------------
-- `perfiles.profesora_id` es un **slug** (text) con FK a `profesoras(slug)`,
-- pero `clases.profesora_id` es un **uuid** con FK a `profesoras(id)`. Para
-- responder "las clases de esta profesora" hay que ir
-- perfil → slug → profesoras.id → clases.
--
-- Se encapsula acá, hermana de `mi_rol()`, para no repetir ese join en cada
-- política ni arriesgar que una lo escriba distinto.
--
-- security definer por lo mismo que `mi_rol`: la usan políticas sobre tablas
-- que ella misma tendría que consultar.

create or replace function public.mi_profesora_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pr.id
  from public.perfiles pe
  join public.profesoras pr on pr.slug = pe.profesora_id
  where pe.user_id = auth.uid()
    and pe.deleted_at is null
    and pr.deleted_at is null;
$$;

grant execute on function public.mi_profesora_id() to authenticated, service_role;

/** ¿Esta clase la dicta quien está preguntando? Admin también pasa. */
create or replace function public.dicta_la_clase(p_clase_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tiene_nivel('admin') or exists (
    select 1 from public.clases c
    where c.id = p_clase_id
      and c.profesora_id = public.mi_profesora_id()
  );
$$;

grant execute on function public.dicta_la_clase(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Los nombres de las inscritas, y nada más
-- ---------------------------------------------------------------------------
-- **Esta función existe porque RLS no restringe columnas.** Una política sobre
-- `perfiles` que dejara ver a las alumnas de sus clases le entregaría la fila
-- completa: correo, teléfono, fecha de nacimiento y lo que se agregue después.
--
-- Acá el conjunto de columnas es la firma, no una promesa de la interfaz.
-- Nadie puede pedirle un correo porque no lo devuelve, y agregar un dato
-- sensible exigiría editar esta función a propósito.

create or replace function public.inscritas_de_clase(p_clase_id uuid)
returns table (reserva_id uuid, nombre text, estado text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.dicta_la_clase(p_clase_id) then
    raise exception 'Esa clase no es tuya' using errcode = '42501';
  end if;

  return query
    select r.id,
           -- Sin nombre cargado se muestra un marcador, nunca el correo.
           coalesce(nullif(btrim(p.nombre), ''), 'Sin nombre'),
           r.estado
    from public.reservas r
    join public.perfiles p on p.id = r.perfil_id
    where r.clase_id = p_clase_id
      and r.estado in ('confirmada', 'asistio')
    order by public.normalizar_nombre(p.nombre);
end;
$$;

revoke all on function public.inscritas_de_clase(uuid) from public, anon;
grant execute on function public.inscritas_de_clase(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. solicitudes_horario
-- ---------------------------------------------------------------------------
-- ⚠️ `profesora_id` apunta a `profesoras` y `resuelta_por` a `perfiles`, a
-- tablas **distintas** a propósito. Si las dos fueran a `perfiles`, PostgREST
-- no podría resolver el embed y devolvería PGRST201 sin ninguna fila — que es
-- exactamente lo que dejó la bandeja de transferencias vacía. Ver PRD-0017 §17.

create table if not exists public.solicitudes_horario (
  id uuid primary key default gen_random_uuid(),
  profesora_id uuid not null references public.profesoras (id) on delete restrict,
  dia_semana smallint not null check (dia_semana between 1 and 7),
  hora time not null,
  -- Puede pedir un horario para un curso del catálogo, o proponer uno que
  -- todavía no existe. Al menos uno de los dos.
  curso_id uuid references public.cursos (id) on delete restrict,
  curso_propuesto text,
  sede_id uuid references public.sedes (id) on delete restrict,
  mensaje text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'rechazada')),
  resuelta_por uuid references public.perfiles (id) on delete restrict,
  respuesta text,
  resuelta_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.solicitudes_horario is
  'Una profesora pide un bloque nuevo. La resuelve admin desde su bandeja; ella ve el estado y la respuesta.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_curso_definido') then
    alter table public.solicitudes_horario add constraint solicitudes_curso_definido
      check (curso_id is not null or nullif(btrim(curso_propuesto), '') is not null);
  end if;

  -- Rechazar sin explicar deja a la profesora sin saber qué corregir. Mismo
  -- criterio que rechazar una compra sin motivo.
  if not exists (select 1 from pg_constraint where conname = 'solicitudes_resuelta_con_respuesta') then
    alter table public.solicitudes_horario add constraint solicitudes_resuelta_con_respuesta
      check (estado = 'pendiente' or nullif(btrim(respuesta), '') is not null);
  end if;
end $$;

create index if not exists solicitudes_pendientes_idx
  on public.solicitudes_horario (created_at) where estado = 'pendiente';
create index if not exists solicitudes_profesora_idx
  on public.solicitudes_horario (profesora_id, created_at desc);

drop trigger if exists solicitudes_updated_at on public.solicitudes_horario;
create trigger solicitudes_updated_at before update on public.solicitudes_horario
  for each row execute function public.tocar_updated_at();

/**
 * Resolver una solicitud. Solo admin, con respuesta obligatoria.
 *
 * Aprobar **no crea el horario**: crear un bloque toca la parrilla, los cupos y
 * el calendario de las alumnas, y merece hacerse a la vista en el portal de
 * administración. Acá se registra la decisión y se le responde a la profesora.
 */
create or replace function public.resolver_solicitud(
  p_solicitud_id uuid,
  p_actor_user_id uuid,
  p_estado text,
  p_respuesta text
)
returns public.solicitudes_horario
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_solicitud public.solicitudes_horario;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  if p_estado not in ('aprobada', 'rechazada') then
    raise exception 'Una solicitud se aprueba o se rechaza' using errcode = '22023';
  end if;

  if coalesce(btrim(p_respuesta), '') = '' then
    raise exception 'Contéstale algo: va a leer esto' using errcode = '23514';
  end if;

  select * into v_solicitud from public.solicitudes_horario
  where id = p_solicitud_id for update;

  if v_solicitud is null then
    raise exception 'La solicitud no existe' using errcode = 'P0002';
  end if;
  if v_solicitud.estado <> 'pendiente' then
    raise exception 'Esa solicitud ya está %', v_solicitud.estado using errcode = '22023';
  end if;

  update public.solicitudes_horario
  set estado = p_estado, respuesta = btrim(p_respuesta),
      resuelta_por = v_actor.id, resuelta_at = now()
  where id = v_solicitud.id
  returning * into v_solicitud;

  return v_solicitud;
end;
$$;

revoke all on function public.resolver_solicitud(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.resolver_solicitud(uuid, uuid, text, text) to service_role;

/**
 * ¿Choca con algo que ya existe? Se le muestra a admin al resolver.
 *
 * No bloquea: es contexto para decidir. Los índices únicos de `horarios` ya
 * impiden crear el bloque conflictivo si igual se intentara.
 */
create or replace function public.conflictos_de_solicitud(p_solicitud_id uuid)
returns table (motivo text, detalle text)
language sql
stable
security definer
set search_path = public
as $$
  select
    case when h.sede_id = s.sede_id then 'sala' else 'profesora' end,
    c.nombre || ' · ' || pr.nombre || ' · ' || sd.nombre
  from public.solicitudes_horario s
  join public.horarios h
    on h.dia_semana = s.dia_semana
   and h.hora = s.hora
   and h.activo
   and h.deleted_at is null
   and (h.sede_id = s.sede_id or h.profesora_id = s.profesora_id)
  join public.cursos c on c.id = h.curso_id
  join public.profesoras pr on pr.id = h.profesora_id
  join public.sedes sd on sd.id = h.sede_id
  where s.id = p_solicitud_id;
$$;

grant execute on function public.conflictos_de_solicitud(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------

alter table public.solicitudes_horario enable row level security;
revoke all on public.solicitudes_horario from anon, authenticated;

grant select on public.solicitudes_horario to authenticated;
-- Pedir un horario es lo único que la profesora escribe. No mueve plata ni
-- cupos: deja una fila esperando respuesta.
grant insert (profesora_id, dia_semana, hora, curso_id, curso_propuesto, sede_id, mensaje)
  on public.solicitudes_horario to authenticated;
grant select, insert, update on public.solicitudes_horario to service_role;

drop policy if exists solicitudes_propias on public.solicitudes_horario;
create policy solicitudes_propias on public.solicitudes_horario
  for select to authenticated
  using (profesora_id = public.mi_profesora_id());

drop policy if exists solicitudes_crea_la_suya on public.solicitudes_horario;
create policy solicitudes_crea_la_suya on public.solicitudes_horario
  for insert to authenticated
  -- No puede pedir un horario a nombre de otra.
  with check (profesora_id = public.mi_profesora_id() and estado = 'pendiente');

drop policy if exists solicitudes_admin_lee on public.solicitudes_horario;
create policy solicitudes_admin_lee on public.solicitudes_horario
  for select to authenticated using (public.tiene_nivel('admin'));

-- Sin política de update para nadie: resolver pasa por `resolver_solicitud`.

-- Sus clases, incluidas las canceladas. Las programadas ya son públicas por
-- `clases_lectura_publica`, pero que le cancelen una clase es justo lo que
-- necesita ver, y esa política no la alcanza.
drop policy if exists clases_de_la_profesora on public.clases;
create policy clases_de_la_profesora on public.clases
  for select to authenticated
  using (profesora_id = public.mi_profesora_id());

-- Las reservas de sus clases: le dan el conteo sobre 22 sin pasar por la
-- service role key. **No traen nombres** — para eso está `inscritas_de_clase`.
drop policy if exists reservas_de_mis_clases on public.reservas;
create policy reservas_de_mis_clases on public.reservas
  for select to authenticated
  using (
    exists (
      select 1 from public.clases c
      where c.id = reservas.clase_id
        and c.profesora_id = public.mi_profesora_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Lo que la profesora sigue sin poder ver, y queda dicho
-- ---------------------------------------------------------------------------
-- No se agrega ninguna política sobre `perfiles`, `compras`, `creditos`,
-- `movimientos_credito` ni `planes`. Es deliberado y es la mitad del PRD:
--
--   · `perfiles` — porque RLS no restringe columnas. Los nombres salen por
--     `inscritas_de_clase`, que devuelve tres columnas y ninguna sensible.
--   · el resto — porque no ve plata. Ni la de la academia ni la de sus alumnas.
--
-- Si algún día hace falta que contacte a una alumna, la respuesta correcta no
-- es abrirle `perfiles`: es que administración la contacte, o una función nueva
-- con su propio contrato de columnas.
