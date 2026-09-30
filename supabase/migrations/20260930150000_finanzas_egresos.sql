-- PRD-0010 parte 2 — Egresos, costos de profesora y caja neta.
--
-- NO ejecutar a mano: se aplica con `supabase db push`, primero a staging y a
-- producción solo con aprobación de Felipe en ese mismo mensaje.
--
-- ---------------------------------------------------------------------------
-- QUÉ PROBLEMA RESUELVE
-- ---------------------------------------------------------------------------
-- El tablero de owner muestra ingresos brutos rotulados como brutos, porque no
-- hay dónde anotar lo que sale. Sin egresos no hay caja neta, y sin el costo de
-- la profesora en la base no hay margen por clase: `sedes.costo_hora_clp` ya
-- está desde PRD-0021; el de la profesora no estaba en ninguna parte, solo en
-- CONTEXT.md §5.b.
--
-- ---------------------------------------------------------------------------
-- CUATRO DECISIONES (Felipe, 30/09/2026)
-- ---------------------------------------------------------------------------
-- 1. La caja neta resta EGRESOS REGISTRADOS, no costos calculados. Si Carla
--    anota el arriendo que pagó y el sistema además lo calcula por clase, se
--    descuenta dos veces. La caja mide lo que salió de la cuenta; el margen por
--    clase mide la economía unitaria. Son dos preguntas distintas.
-- 2. `metricas_finanzas` es `security definer`, a diferencia de las dos de la
--    parte 1: lee `sedes.costo_hora_clp`, que NO está concedido a
--    `authenticated`, y las tablas de acá. Con invoker fallaría con "permission
--    denied for column". Lo que definer anula de RLS lo compensa el chequeo de
--    owner en la primera línea y el `search_path` fijo.
-- 3. Un egreso se registra y se anula; no se edita ni se borra. Como el libro
--    de créditos. Borrado lógico con `deleted_at`, autor y motivo.
-- 4. Las categorías son EDITABLES: viven en una tabla y no en un `check`,
--    porque Felipe las va a revisar con Carla. Se editan desde el Table Editor;
--    desactivar una la saca del formulario sin romper los egresos que la usan.
--
-- Lo que esta migración NO hace: no calcula el pago de las clases especiales
-- (50% de lo recaudado tras descontar la sala, sin base — regla de Felipe del
-- 30/09/2026). El margen por clase es solo de la parrilla y la página lo dice.

-- ---------------------------------------------------------------------------
-- 1. Las categorías, editables
-- ---------------------------------------------------------------------------

create table if not exists public.categorias_egreso (
  slug text primary key check (slug ~ '^[a-z][a-z0-9_]*$'),
  nombre text not null check (btrim(nombre) <> ''),
  orden smallint not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.categorias_egreso is
  'En qué se gasta. Editable desde el Table Editor: el slug es la llave y no se cambia; el nombre sí. Desactivar una la saca del formulario sin tocar los egresos viejos (PRD-0010 parte 2).';

insert into public.categorias_egreso (slug, nombre, orden) values
  ('arriendo_sala',     'Arriendo de sala',     1),
  ('sueldo_profesora',  'Sueldo de profesora',  2),
  ('marketing',         'Marketing',            3),
  ('insumos',           'Insumos',              4),
  ('servicios',         'Servicios',            5),
  ('otro',              'Otro',                 9)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Los egresos
-- ---------------------------------------------------------------------------

create table if not exists public.egresos (
  id uuid primary key default gen_random_uuid(),
  -- Un día de Santiago, no un instante: un egreso se pagó "el 12", no "a las
  -- 15:42:07 UTC".
  fecha date not null,
  categoria text not null references public.categorias_egreso (slug) on delete restrict,
  descripcion text not null check (btrim(descripcion) <> ''),
  monto_clp int not null check (monto_clp > 0),
  sede_id uuid references public.sedes (id) on delete restrict,
  comprobante_path text,
  registrado_por uuid not null references public.perfiles (id),
  anulado_por uuid references public.perfiles (id),
  motivo_anulacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.egresos is
  'Lo que sale de la caja, registrado a mano por el owner. Borrado lógico: se anula con autor y motivo, no se edita ni se borra (PRD-0010 parte 2).';

create index if not exists egresos_fecha_idx
  on public.egresos (fecha) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3. Lo que se le paga a cada profesora
-- ---------------------------------------------------------------------------

create table if not exists public.costos_profesoras (
  profesora_id uuid primary key references public.profesoras (id) on delete restrict,
  base_hora_clp int not null check (base_hora_clp >= 0),
  variable_credito_clp int not null check (variable_credito_clp >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.costos_profesoras is
  'Lo que la academia le paga a cada profesora por una clase de la parrilla: base por hora más variable por crédito consumido (CONTEXT.md §5.b). Solo owner. Sin fila no hay margen, no hay cero. Las especiales se pagan con otra regla que todavía no está construida.';

-- Todas parten con la regla general del 08/09/2026, Carli incluida (Felipe,
-- 30/09/2026). Si alguna difiere, se cambia con una migración, no a mano.
insert into public.costos_profesoras (profesora_id, base_hora_clp, variable_credito_clp)
select id, 18000, 250 from public.profesoras
on conflict (profesora_id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. updated_at, RLS y grants
-- ---------------------------------------------------------------------------
-- public.tocar_updated_at() existe desde la migración de perfiles.

drop trigger if exists categorias_egreso_updated_at on public.categorias_egreso;
create trigger categorias_egreso_updated_at
  before update on public.categorias_egreso
  for each row execute function public.tocar_updated_at();

drop trigger if exists egresos_updated_at on public.egresos;
create trigger egresos_updated_at
  before update on public.egresos
  for each row execute function public.tocar_updated_at();

drop trigger if exists costos_profesoras_updated_at on public.costos_profesoras;
create trigger costos_profesoras_updated_at
  before update on public.costos_profesoras
  for each row execute function public.tocar_updated_at();

alter table public.categorias_egreso enable row level security;
alter table public.egresos enable row level security;
alter table public.costos_profesoras enable row level security;

-- Las primeras tablas del proyecto con RLS de solo owner. Ninguna otra
-- política sobre ellas: lo que se suma con OR es cero. Solo `select` para
-- `authenticated`; toda escritura pasa por las funciones de abajo, que van
-- concedidas solo a `service_role` y reciben al actor.
revoke all on public.categorias_egreso, public.egresos, public.costos_profesoras
  from anon, authenticated;
grant select on public.categorias_egreso, public.egresos, public.costos_profesoras
  to authenticated;
grant all on public.categorias_egreso, public.egresos, public.costos_profesoras
  to service_role;

drop policy if exists categorias_egreso_owner_lee on public.categorias_egreso;
create policy categorias_egreso_owner_lee on public.categorias_egreso
  for select to authenticated using (public.tiene_nivel('owner'));

drop policy if exists egresos_owner_lee on public.egresos;
create policy egresos_owner_lee on public.egresos
  for select to authenticated using (public.tiene_nivel('owner'));

drop policy if exists costos_profesoras_owner_lee on public.costos_profesoras;
create policy costos_profesoras_owner_lee on public.costos_profesoras
  for select to authenticated using (public.tiene_nivel('owner'));

-- ---------------------------------------------------------------------------
-- 5. Registrar, anular y adjuntar comprobante
-- ---------------------------------------------------------------------------
-- Con la forma de `crear_especial`: `security definer`, el actor como
-- parámetro, rol verificado adentro. Se llaman con el cliente admin desde una
-- Server Action que ya sabe quién pide, y vuelven a validar todo, porque son
-- la única capa que resiste una llamada directa.

create or replace function public.registrar_egreso(
  p_actor_user_id uuid,
  p_fecha date,
  p_categoria text,
  p_descripcion text,
  p_monto_clp int,
  p_sede_id uuid default null,
  p_comprobante_path text default null
)
returns public.egresos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_egreso public.egresos;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('owner') then
    raise exception 'Solo el owner registra egresos' using errcode = '42501';
  end if;
  if p_fecha is null then
    raise exception 'El egreso necesita fecha' using errcode = '23514';
  end if;
  if p_fecha > (now() at time zone 'America/Santiago')::date then
    raise exception 'La fecha no puede ser futura: un egreso es algo que ya se pagó'
      using errcode = '23514';
  end if;
  if p_monto_clp is null or p_monto_clp <= 0 then
    raise exception 'El monto tiene que ser mayor que cero' using errcode = '23514';
  end if;
  if coalesce(btrim(p_descripcion), '') = '' then
    raise exception 'Di qué se pagó' using errcode = '23514';
  end if;
  if not exists (select 1 from public.categorias_egreso where slug = p_categoria and activa) then
    raise exception 'Esa categoría no existe o está desactivada' using errcode = '23514';
  end if;
  if p_sede_id is not null
     and not exists (select 1 from public.sedes where id = p_sede_id and deleted_at is null) then
    raise exception 'La sede no existe' using errcode = 'P0002';
  end if;

  insert into public.egresos
    (fecha, categoria, descripcion, monto_clp, sede_id, comprobante_path, registrado_por)
  values
    (p_fecha, p_categoria, btrim(p_descripcion), p_monto_clp, p_sede_id,
     nullif(btrim(p_comprobante_path), ''), v_actor.id)
  returning * into v_egreso;

  return v_egreso;
end;
$$;

create or replace function public.anular_egreso(
  p_actor_user_id uuid,
  p_egreso_id uuid,
  p_motivo text
)
returns public.egresos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_egreso public.egresos;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('owner') then
    raise exception 'Solo el owner anula egresos' using errcode = '42501';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Di por qué se anula' using errcode = '23514';
  end if;

  select * into v_egreso from public.egresos where id = p_egreso_id for update;
  if v_egreso is null then
    raise exception 'El egreso no existe' using errcode = 'P0002';
  end if;
  if v_egreso.deleted_at is not null then
    raise exception 'Ese egreso ya estaba anulado' using errcode = '22023';
  end if;

  update public.egresos
  set deleted_at = now(), anulado_por = v_actor.id, motivo_anulacion = btrim(p_motivo)
  where id = v_egreso.id
  returning * into v_egreso;

  return v_egreso;
end;
$$;

-- La columna del comprobante la escribe una función, no un update directo:
-- así queda sujeta al mismo chequeo de rol que el resto.
create or replace function public.adjuntar_comprobante_egreso(
  p_actor_user_id uuid,
  p_egreso_id uuid,
  p_path text
)
returns public.egresos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_egreso public.egresos;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('owner') then
    raise exception 'Solo el owner adjunta comprobantes' using errcode = '42501';
  end if;
  if coalesce(btrim(p_path), '') = '' then
    raise exception 'Falta la ruta del comprobante' using errcode = '23514';
  end if;

  update public.egresos
  set comprobante_path = btrim(p_path)
  where id = p_egreso_id and deleted_at is null
  returning * into v_egreso;

  if v_egreso is null then
    raise exception 'El egreso no existe o está anulado' using errcode = 'P0002';
  end if;

  return v_egreso;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. metricas_finanzas — egresos de dos períodos y el costo de cada clase dictada
-- ---------------------------------------------------------------------------
-- Agrega y agrupa; NO divide. La caja neta, las horas de una clase, su costo
-- y su margen los calcula `lib/dominio/finanzas.ts`, que tiene tests. La
-- atribución de ingreso se devuelve agrupada por los atributos que definen su
-- valor, igual que en `metricas_demanda`.

create or replace function public.metricas_finanzas(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_desde_ant timestamptz,
  p_hasta_ant timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_salida jsonb;
begin
  -- Primera línea, porque esta función es `security definer` y RLS no la frena.
  if not public.tiene_nivel('owner') then
    raise exception 'Solo el owner ve las finanzas del negocio' using errcode = '42501';
  end if;
  if p_hasta <= p_desde or p_hasta_ant <= p_desde_ant then
    raise exception 'El periodo termina antes de empezar' using errcode = '22023';
  end if;

  with
  -- `fecha` es un día de Santiago; el período llega en timestamptz. Se
  -- convierte el borde, no cada fila.
  bordes as (
    select (p_desde at time zone 'America/Santiago')::date as d1,
           (p_hasta at time zone 'America/Santiago')::date as d2,
           (p_desde_ant at time zone 'America/Santiago')::date as a1,
           (p_hasta_ant at time zone 'America/Santiago')::date as a2
  ),
  vigentes as (
    select e.id, e.fecha, e.categoria, ce.nombre as categoria_nombre, e.descripcion,
           e.monto_clp, e.sede_id, e.comprobante_path, s.nombre as sede
    from public.egresos e
    join public.categorias_egreso ce on ce.slug = e.categoria
    left join public.sedes s on s.id = e.sede_id
    where e.deleted_at is null
  ),
  eg_act as (
    select coalesce(sum(monto_clp), 0)::bigint as total_clp, count(*)::int as n
    from vigentes, bordes where fecha >= d1 and fecha < d2
  ),
  eg_ant as (
    select coalesce(sum(monto_clp), 0)::bigint as total_clp, count(*)::int as n
    from vigentes, bordes where fecha >= a1 and fecha < a2
  ),
  eg_hist as (
    select coalesce(sum(monto_clp), 0)::bigint as total_clp, count(*)::int as n,
           max(fecha) as ultimo_egreso
    from vigentes
  ),
  -- Clases de parrilla del período que ya ocurrieron y no se cancelaron. Las
  -- especiales quedan fuera: se pagan con otra regla (50% de lo recaudado tras
  -- la sala) que todavía no está construida.
  dictadas as (
    select cl.id, cl.inicio, cl.fin, cl.profesora_id, cl.sede_id,
           cu.nombre as curso, pr.nombre as profesora, se.nombre as sede,
           se.costo_hora_clp,
           cp.base_hora_clp, cp.variable_credito_clp
    -- Se devuelven `inicio` y `fin`; las horas las calcula `horasDeClase` en
    -- lib/dominio/finanzas.ts. Acá no se divide.
    from public.clases cl
    join public.cursos cu on cu.id = cl.curso_id
    join public.profesoras pr on pr.id = cl.profesora_id
    join public.sedes se on se.id = cl.sede_id
    left join public.costos_profesoras cp on cp.profesora_id = cl.profesora_id
    where cl.tipo = 'parrilla'
      and cl.estado <> 'cancelada'
      and cl.inicio >= p_desde and cl.inicio < p_hasta
      and cl.inicio < now()
  ),
  -- El mismo predicado que atribuye ingreso (PRD §7.1.3): consumió y no
  -- recuperó. Una cancelación tardía consume y paga; una a tiempo no.
  consumidas as (
    select r.clase_id, count(*)::int as n
    from public.reservas r
    join dictadas d on d.id = r.clase_id
    where r.credito_id is not null
      and r.credito_devuelto = false
      and r.estado not in ('pendiente_pago', 'expirada', 'liberada')
    group by r.clase_id
  ),
  atribucion as (
    select r.clase_id,
           co.monto_clp as monto_compra_clp,
           co.cantidad_clases as clases_compra,
           r.credito_devuelto as recupero_credito,
           count(*)::int as n
    from public.reservas r
    join dictadas d on d.id = r.clase_id
    join public.creditos cr on cr.id = r.credito_id
    left join public.compras co on co.id = cr.compra_id and co.deleted_at is null
    where r.estado not in ('pendiente_pago', 'expirada', 'liberada')
    group by r.clase_id, co.monto_clp, co.cantidad_clases, r.credito_devuelto
  )
  select jsonb_build_object(
    'meta', jsonb_build_object(
      'desde', p_desde, 'hasta', p_hasta,
      'desde_anterior', p_desde_ant, 'hasta_anterior', p_hasta_ant,
      'generado_at', now()
    ),
    'egresos', jsonb_build_object(
      'total_clp', (select total_clp from eg_act),
      'n', (select n from eg_act),
      'lista', coalesce(
        (select jsonb_agg(jsonb_build_object(
           'id', id, 'fecha', fecha, 'categoria', categoria,
           'categoria_nombre', categoria_nombre, 'descripcion', descripcion,
           'monto_clp', monto_clp, 'sede', sede,
           'tiene_comprobante', comprobante_path is not null
         ) order by fecha desc, monto_clp desc)
         from vigentes, bordes where fecha >= d1 and fecha < d2),
        '[]'::jsonb)
    ),
    'egresos_anterior', jsonb_build_object(
      'total_clp', (select total_clp from eg_ant), 'n', (select n from eg_ant)
    ),
    'desde_siempre', jsonb_build_object(
      'total_clp', (select total_clp from eg_hist), 'n', (select n from eg_hist),
      'ultimo_egreso', (select ultimo_egreso from eg_hist)
    ),
    'por_clase', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'clase_id', d.id, 'inicio', d.inicio, 'fin', d.fin, 'curso', d.curso,
         'profesora', d.profesora, 'sede', d.sede,
         'costo_hora_sala_clp', d.costo_hora_clp,
         'base_hora_profesora_clp', d.base_hora_clp,
         'variable_credito_clp', d.variable_credito_clp,
         'creditos_consumidos', coalesce(c.n, 0),
         'atribucion', coalesce(
           (select jsonb_agg(jsonb_build_object(
              'monto_compra_clp', a.monto_compra_clp, 'clases_compra', a.clases_compra,
              'recupero_credito', a.recupero_credito, 'n', a.n
            )) from atribucion a where a.clase_id = d.id),
           '[]'::jsonb)
       ) order by d.inicio)
       from dictadas d left join consumidas c on c.clase_id = d.id),
      '[]'::jsonb)
  )
  into v_salida;

  return v_salida;
end;
$$;

comment on function public.metricas_finanzas(timestamptz, timestamptz, timestamptz, timestamptz) is
  'Egresos de un período y del anterior, y el costo de cada clase de parrilla dictada. Agrega y agrupa; no divide: caja neta, horas y margen salen de lib/dominio/finanzas.ts. security definer porque lee sedes.costo_hora_clp; solo owner, verificado adentro.';

-- ---------------------------------------------------------------------------
-- 7. Storage: el bucket de comprobantes, privado
-- ---------------------------------------------------------------------------
-- Igual que las portadas de especiales: sin políticas sobre storage.objects
-- para anon ni authenticated; solo la service role lee y escribe.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes-egresos', 'comprobantes-egresos', false, 2097152,
        array['application/pdf', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 8. Permisos, escritos y no heredados del default
-- ---------------------------------------------------------------------------
-- `revoke ... from public` NO es `revoke ... from anon`: PUBLIC cubre a todos
-- los roles y las funciones nacen con EXECUTE para PUBLIC (PRD-0008 §15).

revoke all on function public.metricas_finanzas(timestamptz, timestamptz, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.metricas_finanzas(timestamptz, timestamptz, timestamptz, timestamptz)
  to authenticated, service_role;

revoke all on function public.registrar_egreso(uuid, date, text, text, int, uuid, text)
  from public, anon, authenticated;
grant execute on function public.registrar_egreso(uuid, date, text, text, int, uuid, text)
  to service_role;

revoke all on function public.anular_egreso(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.anular_egreso(uuid, uuid, text)
  to service_role;

revoke all on function public.adjuntar_comprobante_egreso(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.adjuntar_comprobante_egreso(uuid, uuid, text)
  to service_role;
