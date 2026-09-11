-- PRD-0018 — Clases especiales: esquema, funciones y permisos.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, primero a
-- staging (fase 2 del plan) y a producción solo con aprobación (fase 7).
--
-- Una clase especial es una fila más de `clases` (`tipo = 'especial'`), sin
-- horario, con Reel, portada, precio propio y fecha única. Se paga con una
-- **compra propia** (`compras.clase_id`), no con créditos, y la reserva nace
-- `pendiente_pago` **ocupando cupo** hasta que admin acredita la transferencia
-- o hasta que vence (`expira_at`). El dinero nunca se devuelve solo.
--
-- Lo que decide plata vive en funciones `security definer` que se llaman desde
-- el servidor con la service role y reciben al actor como parámetro, igual que
-- `reservar` y `acreditar_compra`. Ninguna escritura sobre especiales pasa por
-- PostgREST directo: las políticas de insert/update de admin quedan limitadas a
-- la parrilla (§6).
--
-- Contratos que replican `lib/dominio/especiales.ts`, con sus tests:
--   · cupo tomado = confirmada + asistio + (pendiente_pago con expira_at > now())
--   · solape = bloques [inicio, fin) que se pisan; el fin es abierto
--   · expira_at = min(declarada + retención, inicio − 2 h)
--
-- Una reserva pendiente de pago se puede caer de tres maneras, y no son la
-- misma cosa (Felipe, 10/09/2026 — PRD-0018 §8.3.b):
--   · `liberada`  — la alumna soltó el cupo antes de que nadie la aprobara.
--   · `expirada`  — se venció el plazo, o la academia canceló la clase.
--   · `cancelada` — se cayó una reserva que ya estaba en pie (confirmada).
-- Que se arrepienta es señal de la oferta; que expire es señal nuestra. Por
-- eso el tablero las cuenta por separado (metricas_demanda → `pendientes`).

-- ---------------------------------------------------------------------------
-- 1. clases
-- ---------------------------------------------------------------------------

alter table public.clases
  alter column horario_id drop not null;

alter table public.clases
  add column if not exists tipo text not null default 'parrilla',
  add column if not exists slug text,
  add column if not exists titulo text,
  add column if not exists cancion text,
  add column if not exists descripcion text,
  -- Solo el código del Reel, nunca la URL: la URL se arma al mostrar y así no
  -- se guardan parámetros de tracking ni variantes. Ver PRD-0018 §8.7.
  add column if not exists reel_codigo text,
  -- Ruta dentro del bucket privado `portadas-especiales`, nunca una URL: el
  -- sitio firma al renderizar. Ver PRD-0018 §7.6.
  add column if not exists portada_path text,
  add column if not exists dificultad text,
  -- Fin del bloque. Las de parrilla lo dejan en null y duran 60 minutos.
  add column if not exists fin timestamptz,
  add column if not exists precio_clp int,
  -- null = borrador. Solo las publicadas se ven fuera del admin.
  add column if not exists publicada_at timestamptz,
  add column if not exists creada_por uuid references public.perfiles (id),
  -- Informativo, sin automatismo. Es la palanca de PRD-0009 §8.3: con pocas
  -- alumnas la profesora gana menos que en una clase normal.
  add column if not exists minimo_alumnas smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clases_tipo_valido') then
    alter table public.clases add constraint clases_tipo_valido
      check (tipo in ('parrilla', 'especial'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clases_dificultad_valida') then
    alter table public.clases add constraint clases_dificultad_valida
      check (dificultad is null or dificultad in ('principiante', 'intermedio', 'avanzado'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clases_precio_no_negativo') then
    alter table public.clases add constraint clases_precio_no_negativo
      check (precio_clp is null or precio_clp >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clases_minimo_alumnas_positivo') then
    alter table public.clases add constraint clases_minimo_alumnas_positivo
      check (minimo_alumnas is null or minimo_alumnas > 0);
  end if;

  -- Una fila es coherente con su tipo, o no entra.
  if not exists (select 1 from pg_constraint where conname = 'clases_tipo_coherente') then
    alter table public.clases add constraint clases_tipo_coherente check (
      (tipo = 'parrilla'
        and horario_id is not null and titulo is null and slug is null
        and precio_clp is null and publicada_at is null and reel_codigo is null)
      or
      (tipo = 'especial'
        and horario_id is null and titulo is not null and slug is not null
        and precio_clp is not null and fin is not null and fin > inicio)
    );
  end if;

  -- Publicar exige Reel y portada (PRD-0018 §9.2).
  if not exists (select 1 from pg_constraint where conname = 'clases_publicada_completa') then
    alter table public.clases add constraint clases_publicada_completa check (
      publicada_at is null or tipo = 'parrilla'
      or (reel_codigo is not null and portada_path is not null)
    );
  end if;
end $$;

create unique index if not exists clases_slug_unico
  on public.clases (slug) where slug is not null;
create index if not exists clases_especiales_publicadas_idx
  on public.clases (inicio) where tipo = 'especial' and publicada_at is not null;

comment on column public.clases.tipo is
  'parrilla: generada desde un horario. especial: creada una a una, con precio propio, se paga con una compra (PRD-0018).';
comment on column public.clases.reel_codigo is
  'Código del Reel de Instagram. La URL de embed se arma al mostrar: instagram.com/reel/<código>/embed/. Nunca se guarda la URL.';
comment on column public.clases.portada_path is
  'Ruta en el bucket privado portadas-especiales. Se sirve con URL firmada desde el servidor.';

-- ---------------------------------------------------------------------------
-- 2. compras: una compra puede ser de una clase
-- ---------------------------------------------------------------------------

alter table public.compras
  alter column plan_id drop not null;

alter table public.compras
  add column if not exists clase_id uuid references public.clases (id) on delete restrict,
  -- Devoluciones, siempre a mano (PRD-0018 §8.3).
  add column if not exists reembolso_monto_clp int,
  add column if not exists reembolsada_por uuid references public.perfiles (id),
  add column if not exists reembolsada_at timestamptz,
  add column if not exists reembolso_nota text;

do $$
declare
  v_nombre text;
begin
  -- El check de estado se creó inline y Postgres lo nombró solo. Se busca por
  -- definición para no depender del nombre.
  for v_nombre in
    select conname from pg_constraint
    where conrelid = 'public.compras'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%estado%pendiente%'
  loop
    execute format('alter table public.compras drop constraint %I', v_nombre);
  end loop;

  -- `expirada`: nadie acreditó a tiempo y la reserva soltó el cupo.
  -- `por_reembolsar`: hay plata recibida que hay que devolver (la academia
  -- canceló, o se acreditó sin cupo). Admin la cierra con registrar_reembolso.
  alter table public.compras add constraint compras_estado_valido
    check (estado in ('pendiente', 'pagada', 'rechazada', 'reembolsada',
                      'expirada', 'por_reembolsar'));

  -- O es de un plan o es de una clase, nunca las dos ni ninguna.
  if not exists (select 1 from pg_constraint where conname = 'compras_plan_o_clase') then
    alter table public.compras add constraint compras_plan_o_clase check (
      (plan_id is not null and clase_id is null) or (plan_id is null and clase_id is not null)
    );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'compras_reembolso_coherente') then
    alter table public.compras add constraint compras_reembolso_coherente check (
      reembolso_monto_clp is null
      or (reembolso_monto_clp >= 0 and reembolso_monto_clp <= monto_clp)
    );
  end if;
end $$;

create index if not exists compras_clase_idx
  on public.compras (clase_id) where clase_id is not null;

comment on column public.compras.clase_id is
  'Compra de una clase especial (PRD-0018). No acredita créditos: acreditar_compra confirma la reserva.';

-- ---------------------------------------------------------------------------
-- 3. reservas: pendiente de pago, sin crédito
-- ---------------------------------------------------------------------------

alter table public.reservas
  alter column credito_id drop not null;

alter table public.reservas
  add column if not exists compra_id uuid references public.compras (id) on delete restrict,
  -- Hasta cuándo una pendiente ocupa cupo (PRD-0018 §8.2).
  add column if not exists expira_at timestamptz;

do $$
declare
  v_nombre text;
begin
  for v_nombre in
    select conname from pg_constraint
    where conrelid = 'public.reservas'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%estado%confirmada%'
  loop
    execute format('alter table public.reservas drop constraint %I', v_nombre);
  end loop;

  -- `liberada` es un estado propio y no un `cancelada` más: ver la cabecera.
  alter table public.reservas add constraint reservas_estado_valido
    check (estado in ('confirmada', 'cancelada', 'asistio', 'no_asistio',
                      'pendiente_pago', 'expirada', 'liberada'));

  -- Una reserva se paga con un crédito o con una compra, nunca las dos.
  if not exists (select 1 from pg_constraint where conname = 'reservas_credito_o_compra') then
    alter table public.reservas add constraint reservas_credito_o_compra check (
      (credito_id is not null and compra_id is null) or (credito_id is null and compra_id is not null)
    );
  end if;

  -- Una pendiente sin vencimiento tomaría el cupo para siempre.
  if not exists (select 1 from pg_constraint where conname = 'reservas_pendiente_con_vencimiento') then
    alter table public.reservas add constraint reservas_pendiente_con_vencimiento check (
      estado <> 'pendiente_pago' or expira_at is not null
    );
  end if;
end $$;

-- Una persona, una clase: también mientras está pendiente de pago.
drop index if exists public.reservas_una_por_clase;
create unique index reservas_una_por_clase
  on public.reservas (perfil_id, clase_id)
  where estado in ('confirmada', 'asistio', 'pendiente_pago');

drop index if exists public.reservas_clase_idx;
create index reservas_clase_idx
  on public.reservas (clase_id) where estado in ('confirmada', 'asistio', 'pendiente_pago');

create index if not exists reservas_pendientes_vencen_idx
  on public.reservas (expira_at) where estado = 'pendiente_pago';

comment on column public.reservas.estado is
  $e$confirmada · asistio · no_asistio · pendiente_pago (especial sin aprobar) · liberada (la alumna soltó el cupo pendiente) · expirada (venció el plazo o cayó la clase) · cancelada (se cayó una que ya estaba en pie). Las tres últimas no son intercambiables: PRD-0018 §8.3.b.$e$;

comment on column public.reservas.cancelada_at is
  'Cuándo dejó de estar en pie, sea porque la cancelaron, la soltaron o se venció. Lo escriben cancelar_reserva, expirar_reservas_pendientes y devolver_creditos_de_clase, y es el eje temporal del tablero.';

-- ---------------------------------------------------------------------------
-- 4. parametros
-- ---------------------------------------------------------------------------
-- La retención es el mecanismo de §8.2; el número lo edita owner. 24 h es una
-- propuesta, no un dato del negocio.
--
-- El precio por defecto (`especial_precio_default_clp`) NO lo inserta esta
-- migración: no se inventa un precio. Lo carga owner (PRD-0009 §8.1, $12.000
-- confirmado). Mientras no exista la fila, admin no puede crear especiales y
-- owner tiene que pasar el precio a mano.

insert into public.parametros (clave, valor, descripcion) values
  ('especial_retencion_horas', '24',
   'Horas que una reserva pendiente de pago de una clase especial retiene el cupo. PRD-0018 §8.2.')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Storage: el bucket de portadas, privado
-- ---------------------------------------------------------------------------
-- Decidido por Felipe el 10/09/2026: privado, con URL firmada desde el
-- servidor. Sin políticas sobre storage.objects para anon ni authenticated:
-- solo la service role lee y escribe, y RLS niega el resto por defecto.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portadas-especiales', 'portadas-especiales', false, 1048576,
        array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 6. RLS de clases: los borradores no son públicos, y las especiales no se
--    escriben por PostgREST
-- ---------------------------------------------------------------------------
-- Políticas de `clases` hoy: clases_lectura_publica (anon + authenticated),
-- clases_admin_todo (select), clases_admin_crea (insert), clases_admin_edita
-- (update). Se suman con OR, así que se revisan las cuatro:
--
--   · lectura pública: pasa de `true` a "parrilla, o especial publicada". Los
--     borradores quedan solo para admin, por clases_admin_todo.
--   · insert/update de admin: se limitan a la parrilla. Si un admin pudiera
--     insertar una especial directo, la regla "solo owner fija el precio" y la
--     validación de solape quedarían en el formulario, y eso no es una regla.
--     Todo lo que toca especiales pasa por las funciones de §7, que reciben al
--     actor y validan rol.

drop policy if exists clases_lectura_publica on public.clases;
create policy clases_lectura_publica on public.clases
  for select to anon, authenticated
  using (tipo = 'parrilla' or publicada_at is not null);

drop policy if exists clases_admin_crea on public.clases;
create policy clases_admin_crea on public.clases
  for insert to authenticated
  with check (public.tiene_nivel('admin') and tipo = 'parrilla');

drop policy if exists clases_admin_edita on public.clases;
create policy clases_admin_edita on public.clases
  for update to authenticated
  using (public.tiene_nivel('admin') and tipo = 'parrilla')
  with check (public.tiene_nivel('admin') and tipo = 'parrilla');

comment on table public.clases is
  $c$La parrilla es PÚBLICA por diseño, canceladas incluidas. Las clases especiales se ven solo
publicadas; los borradores los ve admin. Ninguna escritura sobre especiales pasa por PostgREST:
crear_especial, editar_especial, publicar_especial y reservar_especial validan rol, solape y
precio. Lo que sí protege la base es quién está inscrito: ver inscritas_de_clase.$c$;

-- ---------------------------------------------------------------------------
-- 7. Funciones
-- ---------------------------------------------------------------------------

-- 7.1 El conteo de cupo, una sola vez ------------------------------------------
-- Es `cupoTomado` de lib/dominio/especiales.ts. Lo usan reservar y
-- reservar_especial con la clase ya bloqueada; también sirve para mostrar
-- "quedan N cupos" desde el servidor.

create or replace function public.cupo_tomado(p_clase_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.reservas r
  where r.clase_id = p_clase_id
    and (r.estado in ('confirmada', 'asistio')
         or (r.estado = 'pendiente_pago' and r.expira_at > now()));
$$;

comment on function public.cupo_tomado(uuid) is
  'Cupos tomados: confirmadas + asistió + pendientes de pago vigentes (expira_at > now(), estricto). Una liberada, expirada o cancelada no toma cupo. Contrato en lib/dominio/especiales.ts (cupoTomado).';

-- 7.2 Helpers: slug, código de Reel, solape -------------------------------------

create or replace function public.slug_de(p_texto text)
returns text language sql immutable as $$
  select btrim(regexp_replace(public.normalizar_nombre(p_texto), '[^a-z0-9]+', '-', 'g'), '-');
$$;

/** El código de un Reel a partir del link. Mismo contrato que codigoDeReel(). */
create or replace function public.codigo_de_reel(p_url text)
returns text language sql immutable as $$
  select (regexp_match(
    btrim(coalesce(p_url, '')),
    '^https?://(?:www\.)?instagram\.com/(?:reel|p)/([A-Za-z0-9_-]{5,40})/?(?:\?.*)?$'
  ))[1];
$$;

/**
 * Otra clase, en la misma sede o con la misma profesora, que se pise con el
 * bloque [p_inicio, p_fin). Mira la parrilla programada y las especiales
 * publicadas. Una de parrilla dura 60 minutos (fin en null).
 */
create or replace function public.solape_de_especial(
  p_clase_id uuid,
  p_sede_id uuid,
  p_profesora_id uuid,
  p_inicio timestamptz,
  p_fin timestamptz
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.clases c
  where c.id is distinct from p_clase_id
    and c.estado = 'programada'
    and (c.tipo = 'parrilla' or c.publicada_at is not null)
    and (c.sede_id = p_sede_id or c.profesora_id = p_profesora_id)
    and c.inicio < p_fin
    and coalesce(c.fin, c.inicio + interval '60 minutes') > p_inicio
  order by c.inicio
  limit 1;
$$;

-- 7.3 Crear y editar -----------------------------------------------------------
-- Admin y owner crean. **Solo owner fija el precio**: si un admin manda
-- precio, se ignora y se usa el default de parametros; si no hay default, la
-- función falla con un mensaje claro en vez de inventar un número.

create or replace function public.crear_especial(
  p_actor_user_id uuid,
  p_titulo text,
  p_curso_id uuid,
  p_profesora_id uuid,
  p_sede_id uuid,
  p_inicio timestamptz,
  p_duracion_min int default 60,
  p_cupo_maximo int default 22,
  p_cancion text default null,
  p_descripcion text default null,
  p_dificultad text default null,
  p_reel_url text default null,
  p_portada_path text default null,
  p_precio_clp int default null,
  p_minimo_alumnas int default null
)
returns public.clases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_precio int;
  v_reel text;
  v_fin timestamptz;
  v_slug text;
  v_base text;
  v_n int := 1;
  v_choca uuid;
  v_clase public.clases;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  if coalesce(btrim(p_titulo), '') = '' then
    raise exception 'La clase necesita un título' using errcode = '23514';
  end if;
  if p_inicio is null then
    raise exception 'La clase necesita fecha y hora' using errcode = '23514';
  end if;
  if p_duracion_min is null or p_duracion_min < 30 or p_duracion_min > 180 then
    raise exception 'La duración va de 30 a 180 minutos' using errcode = '23514';
  end if;
  -- El cupo por defecto es 22, el de la sala. Se puede bajar; no subir (§9.8).
  if p_cupo_maximo is null or p_cupo_maximo < 1 or p_cupo_maximo > 22 then
    raise exception 'El cupo va de 1 a 22' using errcode = '23514';
  end if;
  if p_dificultad is not null
     and p_dificultad not in ('principiante', 'intermedio', 'avanzado') then
    raise exception 'Dificultad inválida' using errcode = '23514';
  end if;
  if not exists (select 1 from public.cursos where id = p_curso_id and deleted_at is null) then
    raise exception 'El curso no existe' using errcode = 'P0002';
  end if;
  -- Las especiales son para 15+ (§4). El formulario no ofrece Teens; la base
  -- tampoco lo acepta.
  if exists (select 1 from public.cursos where id = p_curso_id and slug = 'teens') then
    raise exception 'Las clases especiales no son para Teens' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profesoras where id = p_profesora_id and deleted_at is null) then
    raise exception 'La profesora no existe' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.sedes where id = p_sede_id and deleted_at is null) then
    raise exception 'La sede no existe' using errcode = 'P0002';
  end if;

  -- El precio: owner lo fija; admin usa el default, y sin default no crea.
  if p_precio_clp is not null and public.nivel_rol(v_actor.rol) >= public.nivel_rol('owner') then
    v_precio := p_precio_clp;
  else
    v_precio := public.parametro_int('especial_precio_default_clp', null);
  end if;
  if v_precio is null then
    raise exception 'Falta el precio por defecto: lo carga owner en parámetros (especial_precio_default_clp), o crea la clase con precio'
      using errcode = '23514';
  end if;
  if v_precio < 0 then
    raise exception 'El precio no puede ser negativo' using errcode = '23514';
  end if;

  if p_reel_url is not null then
    v_reel := public.codigo_de_reel(p_reel_url);
    if v_reel is null then
      raise exception 'El link tiene que ser un Reel o un post de Instagram' using errcode = '23514';
    end if;
  end if;

  v_fin := p_inicio + make_interval(mins => p_duracion_min);

  -- Nada se guarda si se pisa con otra clase, ni como borrador (§9.3).
  v_choca := public.solape_de_especial(null, p_sede_id, p_profesora_id, p_inicio, v_fin);
  if v_choca is not null then
    raise exception 'Se pisa con otra clase en esa sede o de esa profesora a esa hora'
      using errcode = '23514', detail = v_choca::text;
  end if;

  -- Slug: el título más la fecha en Santiago; si ya existe, se numera.
  v_base := public.slug_de(p_titulo) || '-'
            || to_char(p_inicio at time zone 'America/Santiago', 'YYYYMMDD');
  v_slug := v_base;
  while exists (select 1 from public.clases where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.clases
    (tipo, horario_id, fecha, inicio, fin, curso_id, profesora_id, sede_id, cupo_maximo,
     slug, titulo, cancion, descripcion, dificultad, reel_codigo, portada_path,
     precio_clp, minimo_alumnas, creada_por)
  values
    ('especial', null, (p_inicio at time zone 'America/Santiago')::date, p_inicio, v_fin,
     p_curso_id, p_profesora_id, p_sede_id, p_cupo_maximo,
     v_slug, btrim(p_titulo), nullif(btrim(p_cancion), ''), nullif(btrim(p_descripcion), ''),
     p_dificultad, v_reel, nullif(btrim(p_portada_path), ''),
     v_precio, p_minimo_alumnas, v_actor.id)
  returning * into v_clase;

  return v_clase;
end;
$$;

/**
 * Edita una especial. Un parámetro en null significa "no cambiar". El precio
 * solo lo cambia owner; si lo manda un admin, se ignora. Cambiar fecha u hora
 * con reservas hechas se permite: el aviso es de la interfaz (§6).
 */
create or replace function public.editar_especial(
  p_actor_user_id uuid,
  p_clase_id uuid,
  p_titulo text default null,
  p_curso_id uuid default null,
  p_profesora_id uuid default null,
  p_sede_id uuid default null,
  p_inicio timestamptz default null,
  p_duracion_min int default null,
  p_cupo_maximo int default null,
  p_cancion text default null,
  p_descripcion text default null,
  p_dificultad text default null,
  p_reel_url text default null,
  p_portada_path text default null,
  p_precio_clp int default null,
  p_minimo_alumnas int default null
)
returns public.clases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_clase public.clases;
  v_inicio timestamptz;
  v_fin timestamptz;
  v_duracion int;
  v_reel text;
  v_choca uuid;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  select * into v_clase from public.clases where id = p_clase_id for update;

  if v_clase is null or v_clase.tipo <> 'especial' then
    raise exception 'La clase especial no existe' using errcode = 'P0002';
  end if;
  if v_clase.estado = 'cancelada' then
    raise exception 'Una clase cancelada no se edita' using errcode = '22023';
  end if;

  if p_titulo is not null and btrim(p_titulo) = '' then
    raise exception 'La clase necesita un título' using errcode = '23514';
  end if;
  if p_duracion_min is not null and (p_duracion_min < 30 or p_duracion_min > 180) then
    raise exception 'La duración va de 30 a 180 minutos' using errcode = '23514';
  end if;
  if p_cupo_maximo is not null and (p_cupo_maximo < 1 or p_cupo_maximo > 22) then
    raise exception 'El cupo va de 1 a 22' using errcode = '23514';
  end if;
  if p_cupo_maximo is not null and p_cupo_maximo < public.cupo_tomado(v_clase.id) then
    raise exception 'Hay más reservas que ese cupo' using errcode = '23514';
  end if;
  if p_dificultad is not null
     and p_dificultad not in ('principiante', 'intermedio', 'avanzado') then
    raise exception 'Dificultad inválida' using errcode = '23514';
  end if;
  if p_curso_id is not null then
    if not exists (select 1 from public.cursos where id = p_curso_id and deleted_at is null) then
      raise exception 'El curso no existe' using errcode = 'P0002';
    end if;
    if exists (select 1 from public.cursos where id = p_curso_id and slug = 'teens') then
      raise exception 'Las clases especiales no son para Teens' using errcode = '23514';
    end if;
  end if;
  if p_profesora_id is not null
     and not exists (select 1 from public.profesoras where id = p_profesora_id and deleted_at is null) then
    raise exception 'La profesora no existe' using errcode = 'P0002';
  end if;
  if p_sede_id is not null
     and not exists (select 1 from public.sedes where id = p_sede_id and deleted_at is null) then
    raise exception 'La sede no existe' using errcode = 'P0002';
  end if;
  if p_precio_clp is not null and p_precio_clp < 0 then
    raise exception 'El precio no puede ser negativo' using errcode = '23514';
  end if;

  if p_reel_url is not null then
    v_reel := public.codigo_de_reel(p_reel_url);
    if v_reel is null then
      raise exception 'El link tiene que ser un Reel o un post de Instagram' using errcode = '23514';
    end if;
  end if;

  v_inicio := coalesce(p_inicio, v_clase.inicio);
  v_duracion := coalesce(p_duracion_min,
                         (extract(epoch from (v_clase.fin - v_clase.inicio)) / 60)::int);
  v_fin := v_inicio + make_interval(mins => v_duracion);

  v_choca := public.solape_de_especial(
    v_clase.id,
    coalesce(p_sede_id, v_clase.sede_id),
    coalesce(p_profesora_id, v_clase.profesora_id),
    v_inicio, v_fin);
  if v_choca is not null then
    raise exception 'Se pisa con otra clase en esa sede o de esa profesora a esa hora'
      using errcode = '23514', detail = v_choca::text;
  end if;

  update public.clases
  set titulo = coalesce(nullif(btrim(p_titulo), ''), titulo),
      curso_id = coalesce(p_curso_id, curso_id),
      profesora_id = coalesce(p_profesora_id, profesora_id),
      sede_id = coalesce(p_sede_id, sede_id),
      inicio = v_inicio,
      fin = v_fin,
      fecha = (v_inicio at time zone 'America/Santiago')::date,
      cupo_maximo = coalesce(p_cupo_maximo, cupo_maximo),
      cancion = coalesce(nullif(btrim(p_cancion), ''), cancion),
      descripcion = coalesce(nullif(btrim(p_descripcion), ''), descripcion),
      dificultad = coalesce(p_dificultad, dificultad),
      reel_codigo = coalesce(v_reel, reel_codigo),
      portada_path = coalesce(nullif(btrim(p_portada_path), ''), portada_path),
      -- Solo owner. Un admin que manda precio no cambia nada.
      precio_clp = case
        when p_precio_clp is not null
             and public.nivel_rol(v_actor.rol) >= public.nivel_rol('owner')
          then p_precio_clp
        else precio_clp end,
      minimo_alumnas = coalesce(p_minimo_alumnas, minimo_alumnas)
  where id = v_clase.id
  returning * into v_clase;

  return v_clase;
end;
$$;

/** Publica: exige Reel, portada, profesora, sede, fecha futura y precio (§9.2). */
create or replace function public.publicar_especial(
  p_actor_user_id uuid,
  p_clase_id uuid
)
returns public.clases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_clase public.clases;
  v_faltan text[] := '{}';
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  select * into v_clase from public.clases where id = p_clase_id for update;

  if v_clase is null or v_clase.tipo <> 'especial' then
    raise exception 'La clase especial no existe' using errcode = 'P0002';
  end if;
  if v_clase.estado = 'cancelada' then
    raise exception 'Una clase cancelada no se publica' using errcode = '22023';
  end if;
  if v_clase.publicada_at is not null then
    return v_clase;
  end if;

  if v_clase.reel_codigo is null then v_faltan := v_faltan || 'reel'; end if;
  if v_clase.portada_path is null then v_faltan := v_faltan || 'portada'; end if;
  if v_clase.profesora_id is null then v_faltan := v_faltan || 'profesora'; end if;
  if v_clase.sede_id is null then v_faltan := v_faltan || 'sede'; end if;
  if v_clase.inicio <= now() then v_faltan := v_faltan || 'fecha'; end if;
  if v_clase.precio_clp is null then v_faltan := v_faltan || 'precio'; end if;

  if array_length(v_faltan, 1) > 0 then
    raise exception 'Falta para publicar: %', array_to_string(v_faltan, ', ')
      using errcode = '23514', detail = array_to_string(v_faltan, ',');
  end if;

  update public.clases
  set publicada_at = now()
  where id = v_clase.id
  returning * into v_clase;

  return v_clase;
end;
$$;

/** Un borrador sin reservas se puede borrar de verdad (§6). Publicada, se cancela. */
create or replace function public.borrar_borrador_especial(
  p_actor_user_id uuid,
  p_clase_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_clase public.clases;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  select * into v_clase from public.clases where id = p_clase_id for update;

  if v_clase is null or v_clase.tipo <> 'especial' then
    raise exception 'La clase especial no existe' using errcode = 'P0002';
  end if;
  if v_clase.publicada_at is not null then
    raise exception 'Una especial publicada no se borra: se cancela con motivo' using errcode = '22023';
  end if;
  if exists (select 1 from public.reservas where clase_id = v_clase.id) then
    raise exception 'Tiene reservas: se cancela, no se borra' using errcode = '22023';
  end if;

  delete from public.clases where id = v_clase.id;
end;
$$;

-- 7.4 Expirar pendientes ---------------------------------------------------------
-- Perezosa más barrido (§8.2): la llama reservar_especial para esa clase antes
-- de contar cupo, y el cron diario para todas. Idempotente.

create or replace function public.expirar_reservas_pendientes(p_clase_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  -- `cancelada_at` marca cuándo se cayó, que es lo que el tablero mira para
  -- separar las que expiraron de las que la alumna soltó (§8.3.b).
  with vencidas as (
    update public.reservas
    set estado = 'expirada', cancelada_at = now()
    where estado = 'pendiente_pago'
      and expira_at <= now()
      and (p_clase_id is null or clase_id = p_clase_id)
    returning id, compra_id
  ),
  cerradas as (
    update public.compras c
    set estado = 'expirada'
    from vencidas v
    where c.id = v.compra_id
      and c.estado = 'pendiente'
    returning c.id
  )
  -- Cuenta reservas, no compras: antes devolvía el row_count del update de
  -- `compras`, que es otro número cuando alguna ya no estaba pendiente.
  select count(*)::int into v_n from vencidas;

  return v_n;
end;
$$;

-- 7.5 Reservar una especial ------------------------------------------------------
-- Es reservar() con otro medio de pago: comparte el bloqueo de la fila y el
-- conteo. En una transacción: expira las vencidas de esa clase, bloquea, cuenta
-- cupo con pendientes vigentes, crea la compra pendiente con clase_id y la
-- reserva pendiente_pago con expira_at.

create or replace function public.reservar_especial(
  p_clase_id uuid,
  p_actor_user_id uuid,
  p_titular_declarado text default null,
  p_nota_alumna text default null,
  p_perfil_id uuid default null,
  p_origen text default 'web'
)
returns public.reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_perfil_id uuid;
  v_clase public.clases;
  v_retencion int := public.parametro_int('especial_retencion_horas', 24);
  v_expira timestamptz;
  v_compra public.compras;
  v_reserva public.reservas;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null then
    raise exception 'Necesitas una cuenta para reservar' using errcode = '42501';
  end if;

  v_perfil_id := coalesce(p_perfil_id, v_actor.id);

  if v_perfil_id <> v_actor.id
     and public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'No puedes reservar a nombre de otra persona' using errcode = '42501';
  end if;

  -- Bloquear la clase serializa a quienes reservan esa clase: lo que se
  -- expira y se cuenta abajo no puede quedar obsoleto entre leer y escribir.
  select * into v_clase from public.clases where id = p_clase_id for update;

  if v_clase is null or v_clase.tipo <> 'especial' then
    raise exception 'La clase especial no existe' using errcode = 'P0002';
  end if;
  if v_clase.publicada_at is null then
    raise exception 'Esa clase todavía no está publicada' using errcode = '22023';
  end if;
  if v_clase.estado <> 'programada' then
    raise exception 'Esa clase está cancelada' using errcode = '22023';
  end if;
  if v_clase.inicio <= now() then
    raise exception 'Esa clase ya empezó' using errcode = '22023';
  end if;
  if v_clase.precio_clp = 0 then
    -- Anotado en PRD-0018 §6: cuando haga falta, nace pagada y confirmada.
    -- Hasta entonces el camino no existe a medias.
    raise exception 'Las clases gratis todavía no se pueden reservar por acá' using errcode = '22023';
  end if;

  if v_retencion is null or v_retencion <= 0 then
    raise exception 'especial_retencion_horas tiene que ser un número de horas positivo'
      using errcode = '22023';
  end if;

  -- min(declarada + retención, inicio − 2 h). Es expiraAt() de lib/dominio.
  v_expira := least(now() + make_interval(hours => v_retencion),
                    v_clase.inicio - interval '2 hours');
  if v_expira <= now() then
    raise exception 'Ya estamos muy encima de la clase para reservar por transferencia'
      using errcode = '22023';
  end if;

  -- Perezosa: las pendientes vencidas de esta clase sueltan el cupo ahora.
  perform public.expirar_reservas_pendientes(v_clase.id);

  if exists (
    select 1 from public.reservas
    where perfil_id = v_perfil_id and clase_id = v_clase.id
      and estado in ('confirmada', 'asistio', 'pendiente_pago')
  ) then
    raise exception 'Ya tienes una reserva en esa clase' using errcode = '23505';
  end if;

  if public.cupo_tomado(v_clase.id) >= v_clase.cupo_maximo then
    raise exception 'La clase está llena' using errcode = '23514';
  end if;

  -- El monto queda congelado al precio de la clase en este instante.
  insert into public.compras
    (perfil_id, plan_id, clase_id, cantidad_clases, monto_clp, estado, medio_pago,
     titular_declarado, nota_alumna)
  values
    (v_perfil_id, null, v_clase.id, 1, v_clase.precio_clp, 'pendiente', 'transferencia',
     nullif(btrim(p_titular_declarado), ''), nullif(btrim(p_nota_alumna), ''))
  returning * into v_compra;

  insert into public.reservas
    (perfil_id, clase_id, credito_id, compra_id, estado, expira_at, origen)
  values
    (v_perfil_id, v_clase.id, null, v_compra.id, 'pendiente_pago', v_expira, p_origen)
  returning * into v_reserva;

  return v_reserva;
end;
$$;

-- 7.6 reservar(): usa el conteo compartido y rechaza especiales -------------------
-- Cuerpo idéntico al de PRD-0017 salvo dos líneas: el conteo pasa por
-- cupo_tomado (las pendientes vigentes cuentan también acá) y una especial no
-- se paga con créditos (§8.1).

create or replace function public.reservar(
  p_clase_id uuid,
  p_actor_user_id uuid,
  p_perfil_id uuid default null,
  p_origen text default 'web'
)
returns public.reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_perfil_id uuid;
  v_clase public.clases;
  v_credito public.creditos;
  v_reserva public.reservas;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null then
    raise exception 'Necesitas una cuenta para reservar' using errcode = '42501';
  end if;

  v_perfil_id := coalesce(p_perfil_id, v_actor.id);

  if v_perfil_id <> v_actor.id
     and public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'No puedes reservar a nombre de otra persona' using errcode = '42501';
  end if;

  select * into v_clase from public.clases where id = p_clase_id for update;

  if v_clase is null then
    raise exception 'La clase no existe' using errcode = 'P0002';
  end if;
  if v_clase.tipo <> 'parrilla' then
    raise exception 'Las clases especiales se pagan aparte, no con tus clases del pack'
      using errcode = '22023';
  end if;
  if v_clase.estado <> 'programada' then
    raise exception 'Esa clase está cancelada' using errcode = '22023';
  end if;
  if v_clase.inicio <= now() then
    raise exception 'Esa clase ya empezó' using errcode = '22023';
  end if;

  if public.cupo_tomado(v_clase.id) >= v_clase.cupo_maximo then
    raise exception 'La clase está llena' using errcode = '23514';
  end if;

  select * into v_credito from public.creditos
  where perfil_id = v_perfil_id
    and cantidad_disponible > 0
    and fecha_vencimiento > now()
  order by fecha_vencimiento asc
  limit 1
  for update;

  if v_credito is null then
    raise exception 'No tienes clases disponibles' using errcode = '23514';
  end if;

  update public.creditos
  set cantidad_disponible = cantidad_disponible - 1
  where id = v_credito.id;

  insert into public.reservas (perfil_id, clase_id, credito_id, origen)
  values (v_perfil_id, v_clase.id, v_credito.id, p_origen)
  returning * into v_reserva;

  insert into public.movimientos_credito
    (perfil_id, credito_id, reserva_id, tipo, cantidad, saldo_resultante, creado_por)
  values
    (v_perfil_id, v_credito.id, v_reserva.id, 'reserva', -1,
     public.saldo_creditos(v_perfil_id), v_actor.id);

  return v_reserva;
end;
$$;

-- 7.7 acreditar_compra(): con clase_id confirma la reserva, no crea lotes ----------
-- El camino de los packs queda idéntico. El de las clases:
--   · reserva pendiente_pago → confirmada; compra → pagada. Cero lotes, cero
--     movimientos de crédito.
--   · reserva ya expirada (la alumna transfirió y nadie aprobó a tiempo): si
--     hay cupo, se reactiva; si no, la compra queda `por_reembolsar` —hay plata
--     recibida sin cupo que dar— y aparece en la bandeja para devolverla.
--   · reserva **`liberada`**: no se reactiva nunca, haya cupo o no. La alumna
--     soltó ese cupo a propósito; si igual transfirió, lo que corresponde es
--     devolverle la plata, no meterla de vuelta a una clase que no quiere.
--     Acá se ve para qué sirve el estado propio: con un `cancelada` genérico
--     esta rama no se podría distinguir de una expiración.
-- Por eso acá se aceptan compras `expirada` además de `pendiente`.

create or replace function public.acreditar_compra(
  p_compra_id uuid,
  p_actor_user_id uuid,
  p_motivo text default null
)
returns public.compras
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_compra public.compras;
  v_plan public.planes;
  v_credito public.creditos;
  v_clase public.clases;
  v_reserva public.reservas;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  select * into v_compra from public.compras where id = p_compra_id for update;

  if v_compra is null then
    raise exception 'La compra no existe' using errcode = 'P0002';
  end if;

  if v_compra.estado = 'pagada' then
    return v_compra;
  end if;

  -- ----- Compra de una clase especial -----
  if v_compra.clase_id is not null then
    if v_compra.estado not in ('pendiente', 'expirada') then
      raise exception 'Solo se puede acreditar una compra pendiente o expirada (está en %)', v_compra.estado
        using errcode = '22023';
    end if;

    select * into v_clase from public.clases where id = v_compra.clase_id for update;
    select * into v_reserva from public.reservas where compra_id = v_compra.id for update;

    if v_reserva is null then
      raise exception 'La compra no tiene reserva asociada' using errcode = 'P0002';
    end if;

    -- `liberada` no entra en ninguna de las dos ramas de arriba: cae al else.
    if v_reserva.estado = 'pendiente_pago'
       or (v_reserva.estado = 'expirada'
           and v_clase.estado = 'programada'
           and v_clase.inicio > now()
           and public.cupo_tomado(v_clase.id) < v_clase.cupo_maximo) then
      update public.reservas
      set estado = 'confirmada'
      where id = v_reserva.id;

      update public.compras
      set estado = 'pagada', aprobada_por = v_actor.id, aprobada_at = now()
      where id = v_compra.id
      returning * into v_compra;
    else
      -- Plata recibida y ningún cupo que dar —o que ella ya no quiere—: queda
      -- marcada para devolver.
      update public.compras
      set estado = 'por_reembolsar', aprobada_por = v_actor.id, aprobada_at = now()
      where id = v_compra.id
      returning * into v_compra;
    end if;

    return v_compra;
  end if;

  -- ----- Compra de un pack: idéntico a PRD-0017 -----
  if v_compra.estado <> 'pendiente' then
    raise exception 'Solo se puede acreditar una compra pendiente (está en %)', v_compra.estado
      using errcode = '22023';
  end if;

  select * into v_plan from public.planes where id = v_compra.plan_id;

  insert into public.creditos
    (perfil_id, compra_id, cantidad_inicial, cantidad_disponible, fecha_vencimiento)
  values
    (v_compra.perfil_id, v_compra.id, v_compra.cantidad_clases, v_compra.cantidad_clases,
     now() + make_interval(days => coalesce(v_plan.vigencia_dias, 60)))
  returning * into v_credito;

  update public.compras
  set estado = 'pagada', aprobada_por = v_actor.id, aprobada_at = now()
  where id = v_compra.id
  returning * into v_compra;

  insert into public.movimientos_credito
    (perfil_id, credito_id, tipo, cantidad, saldo_resultante, motivo, creado_por)
  values
    (v_compra.perfil_id, v_credito.id, 'compra', v_compra.cantidad_clases,
     public.saldo_creditos(v_compra.perfil_id), p_motivo, v_actor.id);

  return v_compra;
end;
$$;

-- 7.8 cancelar_reserva(): con compra libera el cupo y no toca plata --------------
-- Con compra:
--   · pendiente_pago → **`liberada`**, y la compra pendiente → `expirada`
--     (nunca se aprobó, no hay plata que devolver). Estado propio a propósito:
--     que la alumna se arrepienta no es lo mismo que que no alcancemos a
--     aprobarle, y esa diferencia se mira en el tablero (§8.3.b).
--   · confirmada → `cancelada`; la compra sigue `pagada`. La ventana de 30 min
--     no aplica al dinero (§8.3): si la alumna pide devolución, admin la
--     registra a mano.
--
-- El camino con crédito queda igual salvo **el bloqueo del lote antes de
-- devolverle la clase**. Es el defecto de PRD-0017 §18: el `for update` se
-- había puesto donde se descuenta (`reservar`) y no donde se devuelve, y el
-- `saldo_resultante` que se escribe en el libro se lee justo después.

create or replace function public.cancelar_reserva(
  p_reserva_id uuid,
  p_actor_user_id uuid
)
returns public.reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_reserva public.reservas;
  v_clase public.clases;
  v_minutos int := public.parametro_int('cancelacion_minutos', 30);
  v_a_tiempo boolean;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null then
    raise exception 'Necesitas una cuenta' using errcode = '42501';
  end if;

  select * into v_reserva from public.reservas where id = p_reserva_id for update;

  if v_reserva is null then
    raise exception 'La reserva no existe' using errcode = 'P0002';
  end if;

  if v_reserva.perfil_id <> v_actor.id
     and public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Esa reserva no es tuya' using errcode = '42501';
  end if;

  -- Idempotente: una reserva que ya se cayó, se cayó, y el motivo con el que
  -- se cayó no se pisa.
  if v_reserva.estado in ('cancelada', 'expirada', 'liberada') then
    return v_reserva;
  end if;

  select * into v_clase from public.clases where id = v_reserva.clase_id;

  -- ----- Reserva pagada con una compra de clase -----
  if v_reserva.compra_id is not null then
    -- Soltó el cupo antes de que la aprobaran: `liberada`, no `cancelada`.
    if v_reserva.estado = 'pendiente_pago' then
      update public.compras
      set estado = 'expirada'
      where id = v_reserva.compra_id and estado = 'pendiente';

      update public.reservas
      set estado = 'liberada', cancelada_at = now(), credito_devuelto = false
      where id = v_reserva.id
      returning * into v_reserva;

      return v_reserva;
    end if;

    update public.reservas
    set estado = 'cancelada', cancelada_at = now(), credito_devuelto = false
    where id = v_reserva.id
    returning * into v_reserva;

    return v_reserva;
  end if;

  -- ----- Reserva con crédito: idéntico a PRD-0017 -----
  v_a_tiempo := now() < v_clase.inicio - make_interval(mins => v_minutos);

  update public.reservas
  set estado = 'cancelada', cancelada_at = now(), credito_devuelto = v_a_tiempo
  where id = v_reserva.id
  returning * into v_reserva;

  if v_a_tiempo then
    -- PRD-0017 §18: el lote se bloquea **antes** de devolverle la clase. El
    -- saldo que va al libro se lee dos líneas más abajo y el libro no se edita.
    -- Orden de bloqueo reserva → lote, el mismo de devolver_creditos_de_clase.
    perform 1 from public.creditos where id = v_reserva.credito_id for update;

    update public.creditos
    set cantidad_disponible = cantidad_disponible + 1
    where id = v_reserva.credito_id;

    insert into public.movimientos_credito
      (perfil_id, credito_id, reserva_id, tipo, cantidad, saldo_resultante, motivo, creado_por)
    values
      (v_reserva.perfil_id, v_reserva.credito_id, v_reserva.id, 'cancelacion', 1,
       public.saldo_creditos(v_reserva.perfil_id),
       case when (select fecha_vencimiento from public.creditos where id = v_reserva.credito_id) <= now()
            then 'Devuelto a un lote ya vencido' else null end,
       v_actor.id);
  end if;

  return v_reserva;
end;
$$;

-- 7.9 devolver_creditos_de_clase(): la academia cancela ---------------------------
-- La llama el trigger clases_al_cancelar, se cancele como se cancele. Para la
-- parrilla devuelve créditos, idéntico a antes. Para reservas con compra:
--   · confirmada y pagada → cancelada; compra → por_reembolsar. Nada de plata
--     se mueve sola: admin la devuelve y la registra.
--   · pendiente_pago → expirada; compra pendiente → expirada. Es `expirada` y
--     no `liberada`: la soltó la academia al caerse la clase, no la alumna
--     (§8.3.b). Cuáles fueron por clase caída se ve por `clases.estado`.
-- Las `liberada` no entran: ese cupo ya se había soltado.
-- Devuelve cuántas reservas tocó.

create or replace function public.devolver_creditos_de_clase(
  p_clase_id uuid,
  p_actor_perfil_id uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserva record;
  v_devueltas int := 0;
begin
  for v_reserva in
    select id, perfil_id, credito_id, compra_id, estado
    from public.reservas
    where clase_id = p_clase_id
      and estado in ('confirmada', 'pendiente_pago')
    for update
  loop
    if v_reserva.compra_id is not null then
      if v_reserva.estado = 'pendiente_pago' then
        update public.reservas
        set estado = 'expirada', cancelada_at = now()
        where id = v_reserva.id;

        update public.compras
        set estado = 'expirada'
        where id = v_reserva.compra_id and estado = 'pendiente';
      else
        update public.reservas
        set estado = 'cancelada', cancelada_at = now(), credito_devuelto = false
        where id = v_reserva.id;

        update public.compras
        set estado = 'por_reembolsar'
        where id = v_reserva.compra_id and estado = 'pagada';
      end if;
    else
      update public.reservas
      set estado = 'cancelada', cancelada_at = now(), credito_devuelto = true
      where id = v_reserva.id;

      -- Mismo bloqueo que cancelar_reserva, por lo mismo (PRD-0017 §18): el
      -- saldo del libro se lee justo después de devolver.
      perform 1 from public.creditos where id = v_reserva.credito_id for update;

      update public.creditos
      set cantidad_disponible = cantidad_disponible + 1
      where id = v_reserva.credito_id;

      insert into public.movimientos_credito
        (perfil_id, credito_id, reserva_id, tipo, cantidad, saldo_resultante, motivo, creado_por)
      values
        (v_reserva.perfil_id, v_reserva.credito_id, v_reserva.id, 'cancelacion', 1,
         public.saldo_creditos(v_reserva.perfil_id),
         'La academia canceló la clase', p_actor_perfil_id);
    end if;

    v_devueltas := v_devueltas + 1;
  end loop;

  return v_devueltas;
end;
$$;

-- 7.10 Registrar un reembolso, siempre a mano -------------------------------------

create or replace function public.registrar_reembolso(
  p_compra_id uuid,
  p_actor_user_id uuid,
  p_monto_clp int,
  p_nota text default null
)
returns public.compras
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_compra public.compras;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  select * into v_compra from public.compras where id = p_compra_id for update;

  if v_compra is null then
    raise exception 'La compra no existe' using errcode = 'P0002';
  end if;
  if v_compra.clase_id is null then
    -- Devolver un pack implica retirar créditos; no es este camino.
    raise exception 'Solo se registran reembolsos de clases especiales' using errcode = '22023';
  end if;
  if v_compra.estado not in ('pagada', 'por_reembolsar') then
    raise exception 'Solo se reembolsa una compra pagada o por reembolsar (está en %)', v_compra.estado
      using errcode = '22023';
  end if;
  if p_monto_clp is null or p_monto_clp < 0 or p_monto_clp > v_compra.monto_clp then
    raise exception 'El monto va de 0 a lo que pagó ($%)', v_compra.monto_clp using errcode = '23514';
  end if;

  update public.compras
  set estado = 'reembolsada',
      reembolso_monto_clp = p_monto_clp,
      reembolsada_por = v_actor.id,
      reembolsada_at = now(),
      reembolso_nota = nullif(btrim(p_nota), '')
  where id = v_compra.id
  returning * into v_compra;

  return v_compra;
end;
$$;

-- 7.11 metricas_demanda(): pendientes vigentes en el cupo, compras en la atribución
-- Tres cambios sobre PRD-0010:
--   · `ocupadas` cuenta como cupo_tomado (pendientes vigentes incluidas).
--   · `atribucion` suma la rama de reservas con compra de clase: monto entero
--     de la compra, neto de reembolso, con clases_compra = 1. Un reembolso
--     total deja monto 0. Las canceladas con compra siguen atribuyendo si la
--     plata no se devolvió (recupero_credito = false).
--   · `pendientes` es nuevo: cómo terminaron las reservas pendientes de pago.
--     Soltadas por la alumna, expiradas por plazo, y cuántas de esas expiraron
--     porque cayó la clase. Es la pregunta de §8.3.b puesta en un número: si
--     suben las soltadas, el problema es la oferta o el precio; si suben las
--     expiradas, el problema es que no aprobamos a tiempo. Sin estados
--     distintos, las dos serían la misma barra.
-- `por_horario` hace join con horarios y deja fuera a las especiales, que es
-- lo correcto: no tienen horario.

create or replace function public.metricas_demanda(
  p_desde timestamptz,
  p_hasta timestamptz
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_salida jsonb;
begin
  if not public.tiene_nivel('owner') then
    raise exception 'Solo el owner ve las metricas del negocio'
      using errcode = '42501';
  end if;

  if p_hasta <= p_desde then
    raise exception 'El periodo termina antes de empezar' using errcode = '22023';
  end if;

  with
  clases_periodo as (
    select cl.id, cl.horario_id, cl.fecha, cl.inicio, cl.estado, cl.cupo_maximo,
           cl.profesora_id, cl.curso_id, cl.sede_id, cl.tipo, cl.titulo
    from public.clases cl
    where cl.inicio >= p_desde and cl.inicio < p_hasta
      and (cl.tipo = 'parrilla' or cl.publicada_at is not null)
  ),
  -- Mismo contrato que cupo_tomado / cupoTomado.
  ocupadas as (
    select r.clase_id, count(*)::int as reservas
    from public.reservas r
    where r.estado in ('confirmada', 'asistio')
       or (r.estado = 'pendiente_pago' and r.expira_at > now())
    group by r.clase_id
  ),
  detalle as (
    select cp.id, cp.horario_id, cp.fecha, cp.inicio, cp.estado, cp.cupo_maximo,
           cp.profesora_id, cp.tipo,
           -- Una especial se llama por su coreografía, no por el curso.
           coalesce(cp.titulo, cu.nombre) as curso,
           pr.nombre as profesora, se.nombre as sede,
           coalesce(oc.reservas, 0) as reservas,
           (cp.estado <> 'cancelada' and cp.inicio < now()) as dictada
    from clases_periodo cp
    join public.cursos cu on cu.id = cp.curso_id
    join public.profesoras pr on pr.id = cp.profesora_id
    join public.sedes se on se.id = cp.sede_id
    left join ocupadas oc on oc.clase_id = cp.id
  ),
  por_horario as (
    select d.horario_id, h.dia_semana, h.hora,
           min(d.curso) as curso, min(d.profesora) as profesora, min(d.sede) as sede,
           (count(*) filter (where d.dictada))::int as clases_dictadas,
           coalesce(sum(d.reservas) filter (where d.dictada), 0)::int as reservas,
           coalesce(sum(d.cupo_maximo) filter (where d.dictada), 0)::int as cupos
    from detalle d
    join public.horarios h on h.id = d.horario_id
    group by d.horario_id, h.dia_semana, h.hora
  ),
  reservas_por_profesora as (
    select d.profesora_id, coalesce(sum(d.reservas), 0)::int as reservas
    from detalle d
    group by d.profesora_id
  ),
  atribucion as (
    select cl.profesora_id,
           case when r.compra_id is not null
                then co_cl.monto_clp - coalesce(co_cl.reembolso_monto_clp, 0)
                else co.monto_clp end as monto_compra_clp,
           case when r.compra_id is not null then 1 else co.cantidad_clases end as clases_compra,
           r.credito_devuelto as recupero_credito,
           (cl.inicio < now()) as clase_ya_ocurrio,
           count(*)::int as n
    from public.reservas r
    join public.clases cl on cl.id = r.clase_id
    left join public.creditos cr on cr.id = r.credito_id
    left join public.compras co on co.id = cr.compra_id and co.deleted_at is null
    left join public.compras co_cl on co_cl.id = r.compra_id
      and co_cl.deleted_at is null
      and co_cl.estado in ('pagada', 'reembolsada', 'por_reembolsar')
    where r.created_at >= p_desde and r.created_at < p_hasta
      -- Una pendiente, una expirada o una que la alumna soltó no trajo plata:
      -- no atribuye.
      and r.estado not in ('pendiente_pago', 'expirada', 'liberada')
    group by cl.profesora_id, 2, 3, r.credito_devuelto, (cl.inicio < now())
  ),
  -- Cómo se cayeron las pendientes de pago. El eje del período es
  -- `cancelada_at` —cuándo dejó de estar en pie—, igual que las cancelaciones
  -- de metricas_resumen, y no `inicio` como el resto de esta función.
  pendientes as (
    select
      (count(*) filter (where r.estado = 'liberada'))::int as soltadas,
      (count(*) filter (where r.estado = 'expirada'))::int as expiradas,
      (count(*) filter (where r.estado = 'expirada' and cl.estado = 'cancelada'))::int
        as expiradas_por_clase_cancelada
    from public.reservas r
    join public.clases cl on cl.id = r.clase_id
    where r.estado in ('liberada', 'expirada')
      and r.cancelada_at >= p_desde and r.cancelada_at < p_hasta
  ),
  -- Cupos tomados ahora mismo por alguien que todavía no transfiere. No lleva
  -- período: es una foto, y es lo que hay que mirar antes de decir que una
  -- clase está llena.
  pendientes_vigentes as (
    select count(*)::int as n
    from public.reservas r
    where r.estado = 'pendiente_pago' and r.expira_at > now()
  )

  select jsonb_build_object(
    'meta', jsonb_build_object('desde', p_desde, 'hasta', p_hasta, 'generado_at', now()),
    'pendientes', jsonb_build_object(
      'soltadas', (select soltadas from pendientes),
      'expiradas', (select expiradas from pendientes),
      'expiradas_por_clase_cancelada', (select expiradas_por_clase_cancelada from pendientes),
      'vigentes_ahora', (select n from pendientes_vigentes)
    ),
    'por_clase', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'clase_id', id, 'fecha', fecha, 'inicio', inicio, 'estado', estado,
         'curso', curso, 'profesora', profesora, 'sede', sede, 'tipo', tipo,
         'cupo', cupo_maximo, 'reservas', reservas, 'dictada', dictada
       ) order by inicio) from detalle),
      '[]'::jsonb),
    'por_horario', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'horario_id', horario_id, 'dia_semana', dia_semana, 'hora', hora,
         'curso', curso, 'profesora', profesora, 'sede', sede,
         'clases_dictadas', clases_dictadas, 'reservas', reservas, 'cupos', cupos
       ) order by dia_semana, hora) from por_horario),
      '[]'::jsonb),
    'por_profesora', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'profesora_id', pr.id, 'slug', pr.slug, 'nombre', pr.nombre,
         'reservas', coalesce(rp.reservas, 0),
         'atribucion', coalesce(
           (select jsonb_agg(jsonb_build_object(
              'monto_compra_clp', a.monto_compra_clp,
              'clases_compra', a.clases_compra,
              'recupero_credito', a.recupero_credito,
              'clase_ya_ocurrio', a.clase_ya_ocurrio,
              'n', a.n
            )) from atribucion a where a.profesora_id = pr.id),
           '[]'::jsonb)
       ) order by pr.orden, pr.nombre)
       from public.profesoras pr
       left join reservas_por_profesora rp on rp.profesora_id = pr.id
       where pr.activa or rp.reservas is not null),
      '[]'::jsonb)
  )
  into v_salida;

  return v_salida;
end;
$$;

comment on function public.metricas_demanda(timestamptz, timestamptz) is
  'Ocupación por clase y por horario, ranking de profesoras y desenlace de las pendientes de pago (soltadas vs expiradas). El cupo cuenta pendientes vigentes; la atribución incluye compras de clases especiales netas de reembolso. Solo owner.';

-- ---------------------------------------------------------------------------
-- 8. Permisos, escritos y no heredados del default
-- ---------------------------------------------------------------------------
-- `revoke ... from public` NO es `revoke ... from anon`: PUBLIC cubre a todos,
-- authenticated incluido, y ya rompió el login una vez (PRD-0008 §15). Por eso
-- cada función lleva su revoke y su grant explícitos.
--
-- Las que mueven plata o cupo se llaman desde Server Actions con la service
-- role y reciben al actor como parámetro: solo service_role. `cupo_tomado` y
-- `codigo_de_reel` no exponen nada de nadie y las usa también la sesión.
-- Ninguna va a `anon`: la página pública corre en el servidor.

revoke all on function public.cupo_tomado(uuid) from public, anon;
revoke all on function public.slug_de(text) from public, anon;
revoke all on function public.codigo_de_reel(text) from public, anon;
revoke all on function public.solape_de_especial(uuid, uuid, uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.crear_especial(uuid, text, uuid, uuid, uuid, timestamptz, int, int,
  text, text, text, text, text, int, int) from public, anon, authenticated;
revoke all on function public.editar_especial(uuid, uuid, text, uuid, uuid, uuid, timestamptz, int,
  int, text, text, text, text, text, int, int) from public, anon, authenticated;
revoke all on function public.publicar_especial(uuid, uuid) from public, anon, authenticated;
revoke all on function public.borrar_borrador_especial(uuid, uuid) from public, anon, authenticated;
revoke all on function public.expirar_reservas_pendientes(uuid) from public, anon, authenticated;
revoke all on function public.reservar_especial(uuid, uuid, text, text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.registrar_reembolso(uuid, uuid, int, text) from public, anon, authenticated;
revoke all on function public.reservar(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.cancelar_reserva(uuid, uuid) from public, anon, authenticated;
revoke all on function public.acreditar_compra(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.devolver_creditos_de_clase(uuid, uuid) from public, anon, authenticated;
revoke all on function public.metricas_demanda(timestamptz, timestamptz) from public, anon;

grant execute on function public.cupo_tomado(uuid) to authenticated, service_role;
grant execute on function public.slug_de(text) to authenticated, service_role;
grant execute on function public.codigo_de_reel(text) to authenticated, service_role;
grant execute on function public.solape_de_especial(uuid, uuid, uuid, timestamptz, timestamptz)
  to service_role;
grant execute on function public.crear_especial(uuid, text, uuid, uuid, uuid, timestamptz, int, int,
  text, text, text, text, text, int, int) to service_role;
grant execute on function public.editar_especial(uuid, uuid, text, uuid, uuid, uuid, timestamptz, int,
  int, text, text, text, text, text, int, int) to service_role;
grant execute on function public.publicar_especial(uuid, uuid) to service_role;
grant execute on function public.borrar_borrador_especial(uuid, uuid) to service_role;
grant execute on function public.expirar_reservas_pendientes(uuid) to service_role;
grant execute on function public.reservar_especial(uuid, uuid, text, text, uuid, text) to service_role;
grant execute on function public.registrar_reembolso(uuid, uuid, int, text) to service_role;
grant execute on function public.reservar(uuid, uuid, uuid, text) to service_role;
grant execute on function public.cancelar_reserva(uuid, uuid) to service_role;
grant execute on function public.acreditar_compra(uuid, uuid, text) to service_role;
grant execute on function public.devolver_creditos_de_clase(uuid, uuid) to service_role;
grant execute on function public.metricas_demanda(timestamptz, timestamptz)
  to authenticated, service_role;

-- La alumna sigue insertando compras de pack directo (PRD-0017); las de clase
-- nacen solo en reservar_especial. `clase_id` no está en el grant de columnas,
-- y compras_plan_o_clase obliga a que plan_id venga: no hay forma de declarar
-- una compra de clase por PostgREST.

-- ---------------------------------------------------------------------------
-- 9. Lo que esta migración NO hace
-- ---------------------------------------------------------------------------
-- · No inserta `especial_precio_default_clp`. Lo carga owner (PRD-0009 §8.1).
-- · No agenda el barrido diario: `expirar_reservas_pendientes()` la llama el
--   cron de generación de clases desde el código, y ese cambio va con la fase
--   4, después de que esta migración corra en producción. Mientras tanto la
--   expiración perezosa de reservar_especial mantiene el cupo correcto.
-- · No toca `metricas_resumen`: `pagadas` ya suma toda compra pagada, con o sin
--   plan, así que los ingresos incluyen las especiales; `por_plan` hace join
--   con planes y las deja fuera, que es lo correcto. Su bloque `cancelaciones`
--   filtra `estado = 'cancelada'`, así que las soltadas y las expiradas no lo
--   ensucian: se cuentan aparte, en `metricas_demanda.pendientes`.
-- · No toca `inscritas_de_clase`: lista confirmadas y asistió, sin pendientes.
