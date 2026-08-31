-- PRD-0017 — Compras por transferencia, créditos y reservas.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`.
--
-- Esta es la parte del sistema donde un bug le cuesta plata real a alguien.
-- Tres reglas que atraviesan todo el archivo:
--
--   1. Ninguna operación que toque créditos o cupos se ejecuta desde el
--      cliente. `authenticated` no tiene insert ni update sobre creditos,
--      reservas ni compras: todo pasa por las funciones de §7.
--   2. Reservar y descontar el crédito ocurren en una sola transacción.
--   3. El cupo se valida en la base, con la fila de la clase bloqueada, no
--      leyendo un conteo y escribiendo después.

-- ---------------------------------------------------------------------------
-- 1. planes
-- ---------------------------------------------------------------------------
-- Lo que se vende. El precio vive acá y no en el código: cambia, y no puede
-- hacer falta un deploy para subirlo.
--
-- ⚠️ Mientras tanto `lib/planes.ts` sigue siendo lo que dibuja la sección
-- Planes del sitio. Son dos fuentes para el mismo dato y hay que unificarlas
-- en la parte 2 de PRD-0017, antes de que se desincronicen.

create table if not exists public.planes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  cantidad_clases int not null check (cantidad_clases > 0),
  precio_clp int not null check (precio_clp >= 0),
  -- 60 días: la vigencia del crédito, y la misma ventana que muestra el
  -- calendario. Que coincidan no es casualidad, ver PRD-0017 §6.
  vigencia_dias int not null default 60 check (vigencia_dias > 0),
  orden int not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists planes_updated_at on public.planes;
create trigger planes_updated_at before update on public.planes
  for each row execute function public.tocar_updated_at();

drop trigger if exists planes_slug_inmutable on public.planes;
create trigger planes_slug_inmutable before update on public.planes
  for each row execute function public.slug_inmutable();

-- Precios de lista. Las promociones son PRD-0012 y no entran acá; una compra
-- congela su monto igual, así que un precio promocional se registra sin
-- problema en compras.monto_clp.
insert into public.planes (slug, nombre, cantidad_clases, precio_clp, orden)
values
  ('suelta', '1 clase',  1,  8500, 1),
  ('pack-2', '2 clases', 2, 16000, 2),
  ('pack-4', '4 clases', 4, 28000, 3),
  ('pack-8', '8 clases', 8, 48000, 4)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2. compras
-- ---------------------------------------------------------------------------

create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles (id) on delete restrict,
  plan_id uuid not null references public.planes (id) on delete restrict,
  -- Congelados al comprar: el plan puede cambiar de precio después y una
  -- compra pasada nunca se recalcula.
  cantidad_clases int not null check (cantidad_clases > 0),
  monto_clp int not null check (monto_clp >= 0),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'pagada', 'rechazada', 'reembolsada')),
  -- `pendiente` significa "esperando confirmación de pago", venga de un admin
  -- mirando la cuenta o de un webhook de Flow. Ver PRD-0017 §5.4.
  medio_pago text not null default 'transferencia'
    check (medio_pago in ('transferencia', 'flow', 'importacion')),

  -- Lo que declara la alumna. No se le pide adjuntar comprobante: el admin va
  -- a mirar la cuenta igual.
  declarada_at timestamptz not null default now(),
  titular_declarado text,
  nota_alumna text,

  -- Lo que hace quien revisa.
  aprobada_por uuid references public.perfiles (id),
  aprobada_at timestamptz,
  motivo_rechazo text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.compras is
  'Una transacción. El monto queda congelado: nunca se recalcula, ni por cambio de precio ni por promoción posterior.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'compras_rechazo_con_motivo') then
    alter table public.compras add constraint compras_rechazo_con_motivo
      -- Un rechazo sin motivo es un callejón sin salida para quien pagó.
      check (estado <> 'rechazada' or motivo_rechazo is not null);
  end if;
end $$;

create index if not exists compras_pendientes_idx
  on public.compras (declarada_at) where estado = 'pendiente';
create index if not exists compras_perfil_idx on public.compras (perfil_id, created_at desc);

drop trigger if exists compras_updated_at on public.compras;
create trigger compras_updated_at before update on public.compras
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- 3. creditos y movimientos_credito
-- ---------------------------------------------------------------------------
-- El saldo NO es un int en el perfil. Son lotes con vencimiento propio, y todo
-- cambio queda en un libro que solo se agrega.

create table if not exists public.creditos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles (id) on delete restrict,
  -- Nulo solo para un regalo: un lote sin compra detrás.
  compra_id uuid references public.compras (id) on delete restrict,
  cantidad_inicial int not null check (cantidad_inicial > 0),
  cantidad_disponible int not null check (cantidad_disponible >= 0),
  fecha_vencimiento timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creditos_disponible_no_supera_inicial
    check (cantidad_disponible <= cantidad_inicial)
);

create index if not exists creditos_consumo_idx
  on public.creditos (perfil_id, fecha_vencimiento)
  where cantidad_disponible > 0;

drop trigger if exists creditos_updated_at on public.creditos;
create trigger creditos_updated_at before update on public.creditos
  for each row execute function public.tocar_updated_at();

create table if not exists public.movimientos_credito (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles (id) on delete restrict,
  credito_id uuid references public.creditos (id) on delete restrict,
  reserva_id uuid,
  tipo text not null
    check (tipo in ('compra', 'reserva', 'cancelacion', 'expiracion', 'ajuste', 'regalo')),
  cantidad int not null check (cantidad <> 0),
  saldo_resultante int not null,
  motivo text,
  creado_por uuid references public.perfiles (id),
  created_at timestamptz not null default now()
);

comment on table public.movimientos_credito is
  'Libro mayor de créditos. Solo se agrega: nunca se edita ni se borra, ni con la service role key.';

create index if not exists movimientos_perfil_idx
  on public.movimientos_credito (perfil_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. clases
-- ---------------------------------------------------------------------------
-- `horarios` es la plantilla semanal; `clases` es cada ocurrencia con fecha.
-- Las reservas apuntan acá, nunca a horarios.

create table if not exists public.clases (
  id uuid primary key default gen_random_uuid(),
  horario_id uuid not null references public.horarios (id) on delete restrict,
  fecha date not null,
  inicio timestamptz not null,
  -- Se COPIAN del horario al generar, no se leen por join. Si mañana cambia el
  -- horario o la capacidad de la sala, una clase ya reservada no se mueve sola
  -- ni queda sobrevendida de golpe.
  curso_id uuid not null references public.cursos (id) on delete restrict,
  profesora_id uuid not null references public.profesoras (id) on delete restrict,
  sede_id uuid not null references public.sedes (id) on delete restrict,
  cupo_maximo int not null default 22 check (cupo_maximo > 0),
  estado text not null default 'programada'
    check (estado in ('programada', 'cancelada')),
  motivo_cancelacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hace idempotente a generar_clases: correrla dos veces no duplica nada.
create unique index if not exists clases_horario_fecha
  on public.clases (horario_id, fecha);
create index if not exists clases_inicio_idx
  on public.clases (inicio) where estado = 'programada';

drop trigger if exists clases_updated_at on public.clases;
create trigger clases_updated_at before update on public.clases
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- 5. reservas
-- ---------------------------------------------------------------------------

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles (id) on delete restrict,
  clase_id uuid not null references public.clases (id) on delete restrict,
  -- De qué lote salió el crédito. Sin esto, cancelar no sabría a dónde
  -- devolverlo, y devolverlo a un lote nuevo extendería el vencimiento por el
  -- solo hecho de cancelar.
  credito_id uuid not null references public.creditos (id) on delete restrict,
  estado text not null default 'confirmada'
    check (estado in ('confirmada', 'cancelada', 'asistio', 'no_asistio')),
  cancelada_at timestamptz,
  credito_devuelto boolean not null default false,
  origen text not null default 'web'
    check (origen in ('web', 'admin', 'importacion')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Una persona, una clase. Parcial: cancelar y volver a reservar debe poderse.
create unique index if not exists reservas_una_por_clase
  on public.reservas (perfil_id, clase_id)
  where estado in ('confirmada', 'asistio');

create index if not exists reservas_clase_idx
  on public.reservas (clase_id) where estado in ('confirmada', 'asistio');

drop trigger if exists reservas_updated_at on public.reservas;
create trigger reservas_updated_at before update on public.reservas
  for each row execute function public.tocar_updated_at();

alter table public.movimientos_credito
  drop constraint if exists movimientos_reserva_fk;
alter table public.movimientos_credito
  add constraint movimientos_reserva_fk
  foreign key (reserva_id) references public.reservas (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- 6. parametros
-- ---------------------------------------------------------------------------
-- Lo que se ajusta sin desplegar. PRD-0006 §8 lo pide como criterio de
-- aceptación para la ventana de cancelación.

create table if not exists public.parametros (
  clave text primary key,
  valor text not null,
  descripcion text,
  updated_at timestamptz not null default now()
);

insert into public.parametros (clave, valor, descripcion) values
  ('cancelacion_minutos', '30',
   'Minutos antes del inicio hasta los cuales cancelar devuelve el crédito.'),
  ('calendario_dias', '60',
   'Cuántos días hacia adelante muestra el calendario. Coincide con la vigencia del crédito.'),
  ('generar_dias', '70',
   'Cuántos días de clases se materializan. Mayor que calendario_dias, como margen si el cron falla.')
on conflict (clave) do nothing;

create or replace function public.parametro_int(p_clave text, p_default int)
returns int language sql stable as $$
  select coalesce((select valor::int from public.parametros where clave = p_clave), p_default);
$$;

-- ---------------------------------------------------------------------------
-- 7. Las funciones que concentran la plata
-- ---------------------------------------------------------------------------

/**
 * Materializa clases desde los horarios activos.
 *
 * Idempotente por el índice único: correrla dos veces no duplica. Se corre a
 * diario, a mano desde admin, y antes de importar.
 */
create or replace function public.generar_clases(p_dias int default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dias int := coalesce(p_dias, public.parametro_int('generar_dias', 70));
  v_creadas int;
begin
  with fechas as (
    select h.id as horario_id, h.curso_id, h.profesora_id, h.sede_id, h.hora, d::date as fecha
    from public.horarios h
    cross join generate_series(current_date, current_date + v_dias, interval '1 day') d
    where h.activo
      and h.deleted_at is null
      -- ISO: extract(isodow) da 1 = lunes … 7 = domingo, igual que dia_semana.
      and extract(isodow from d) = h.dia_semana
  )
  insert into public.clases
    (horario_id, fecha, inicio, curso_id, profesora_id, sede_id)
  select
    f.horario_id,
    f.fecha,
    -- Las clases se piensan en hora de Santiago; se guardan en UTC.
    (f.fecha + f.hora) at time zone 'America/Santiago',
    f.curso_id, f.profesora_id, f.sede_id
  from fechas f
  on conflict (horario_id, fecha) do nothing;

  get diagnostics v_creadas = row_count;
  return v_creadas;
end;
$$;

/** Saldo disponible: la suma de los lotes vigentes. Nunca un contador. */
create or replace function public.saldo_creditos(p_perfil_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(cantidad_disponible), 0)::int
  from public.creditos
  where perfil_id = p_perfil_id and fecha_vencimiento > now();
$$;

/**
 * Acredita una compra: cambia el estado, crea el lote y escribe el asiento, o
 * no hace nada.
 *
 * **Es el único punto de acreditación del sistema.** Hoy la llama la bandeja
 * de admin; el webhook de Flow la va a llamar igual. Cambia quién confirma el
 * pago, no qué pasa después. Ver PRD-0017 §5.4.
 */
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
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  -- Bloqueada: dos admin aprobando la misma compra a la vez no acreditan dos
  -- veces. El segundo encuentra el estado ya cambiado y sale.
  select * into v_compra from public.compras where id = p_compra_id for update;

  if v_compra is null then
    raise exception 'La compra no existe' using errcode = 'P0002';
  end if;

  if v_compra.estado = 'pagada' then
    -- Idempotente a propósito: reintentar no duplica créditos.
    return v_compra;
  end if;

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

/** Rechaza una compra. El motivo es obligatorio: quien pagó tiene que saber. */
create or replace function public.rechazar_compra(
  p_compra_id uuid,
  p_actor_user_id uuid,
  p_motivo text
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

  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Un rechazo necesita motivo' using errcode = '23514';
  end if;

  select * into v_compra from public.compras where id = p_compra_id for update;

  if v_compra is null then
    raise exception 'La compra no existe' using errcode = 'P0002';
  end if;
  if v_compra.estado <> 'pendiente' then
    raise exception 'Solo se puede rechazar una compra pendiente (está en %)', v_compra.estado
      using errcode = '22023';
  end if;

  update public.compras
  set estado = 'rechazada', motivo_rechazo = btrim(p_motivo),
      aprobada_por = v_actor.id, aprobada_at = now()
  where id = v_compra.id
  returning * into v_compra;

  return v_compra;
end;
$$;

/**
 * Reserva: valida cupo, consume del lote que vence antes, crea la reserva y
 * escribe el asiento. Todo o nada.
 *
 * `p_perfil_id` permite que un admin reserve a nombre de alguien; si va nulo,
 * reserva quien llama.
 */
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
  v_tomados int;
  v_credito public.creditos;
  v_reserva public.reservas;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null then
    raise exception 'Necesitas una cuenta para reservar' using errcode = '42501';
  end if;

  v_perfil_id := coalesce(p_perfil_id, v_actor.id);

  -- Reservar por otra persona es cosa de admin.
  if v_perfil_id <> v_actor.id
     and public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'No puedes reservar a nombre de otra persona' using errcode = '42501';
  end if;

  -- **Acá se resuelve la concurrencia del último cupo.** Bloquear la fila de
  -- la clase serializa a quienes reservan esa clase: el conteo de abajo no
  -- puede quedar obsoleto entre que se lee y se escribe.
  select * into v_clase from public.clases where id = p_clase_id for update;

  if v_clase is null then
    raise exception 'La clase no existe' using errcode = 'P0002';
  end if;
  if v_clase.estado <> 'programada' then
    raise exception 'Esa clase está cancelada' using errcode = '22023';
  end if;
  if v_clase.inicio <= now() then
    raise exception 'Esa clase ya empezó' using errcode = '22023';
  end if;

  select count(*) into v_tomados from public.reservas
  where clase_id = v_clase.id and estado in ('confirmada', 'asistio');

  if v_tomados >= v_clase.cupo_maximo then
    raise exception 'La clase está llena' using errcode = '23514';
  end if;

  -- FIFO por vencimiento: se gasta primero lo que vence antes.
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

/**
 * Cancela: libera el cupo siempre, y devuelve el crédito **a su lote original**
 * si está dentro de la ventana. Devolverlo a un lote nuevo extendería el
 * vencimiento por el solo hecho de cancelar.
 */
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

  if v_reserva.estado = 'cancelada' then
    return v_reserva;
  end if;

  select * into v_clase from public.clases where id = v_reserva.clase_id;

  v_a_tiempo := now() < v_clase.inicio - make_interval(mins => v_minutos);

  update public.reservas
  set estado = 'cancelada', cancelada_at = now(), credito_devuelto = v_a_tiempo
  where id = v_reserva.id
  returning * into v_reserva;

  if v_a_tiempo then
    update public.creditos
    set cantidad_disponible = cantidad_disponible + 1
    where id = v_reserva.credito_id;

    insert into public.movimientos_credito
      (perfil_id, credito_id, reserva_id, tipo, cantidad, saldo_resultante, motivo, creado_por)
    values
      (v_reserva.perfil_id, v_reserva.credito_id, v_reserva.id, 'cancelacion', 1,
       public.saldo_creditos(v_reserva.perfil_id),
       -- Puede volver a un lote ya vencido: se devuelve igual, y queda dicho.
       case when (select fecha_vencimiento from public.creditos where id = v_reserva.credito_id) <= now()
            then 'Devuelto a un lote ya vencido' else null end,
       v_actor.id);
  end if;

  return v_reserva;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Detectar cuentas duplicadas de alumnas importadas
-- ---------------------------------------------------------------------------
-- Las alumnas importadas sin correo entran con uno temporal en `.invalid`. Si
-- alguna se registra sola con su correo real antes de que un admin cargue el
-- suyo, queda con dos cuentas: una con sus créditos y reservas, otra vacía.
--
-- Con 36 alumnas sin correo, alguna lo va a hacer. Esto no fusiona nada: hace
-- que el problema no pase inadvertido.

alter table public.perfiles
  add column if not exists pendiente_de_correo boolean not null default false;

comment on column public.perfiles.pendiente_de_correo is
  'Alumna importada con correo temporal .invalid. Se apaga cuando un admin carga su correo real.';

create index if not exists perfiles_pendiente_correo_idx
  on public.perfiles (pendiente_de_correo) where pendiente_de_correo;

/** Nombre comparable: sin tildes, sin mayúsculas y sin espacios de más. */
create or replace function public.normalizar_nombre(p_nombre text)
returns text language sql immutable as $$
  select btrim(regexp_replace(
    lower(translate(coalesce(p_nombre, ''), 'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
                                           'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')),
    '\s+', ' ', 'g'));
$$;

-- security_invoker: la vista respeta el RLS de perfiles, así que solo admin ve
-- filas. Sin esto, una vista filtra la tabla entera.
create or replace view public.duplicados_probables
with (security_invoker = true) as
select
  imp.id            as perfil_importado_id,
  imp.nombre        as nombre_importado,
  imp.email         as correo_temporal,
  nuevo.id          as perfil_nuevo_id,
  nuevo.email       as correo_nuevo,
  nuevo.created_at  as se_registro_at,
  public.saldo_creditos(imp.id)   as clases_del_importado,
  public.saldo_creditos(nuevo.id) as clases_del_nuevo
from public.perfiles imp
join public.perfiles nuevo
  on nuevo.id <> imp.id
 and public.normalizar_nombre(nuevo.nombre) = public.normalizar_nombre(imp.nombre)
 and coalesce(btrim(nuevo.nombre), '') <> ''
where imp.pendiente_de_correo
  and not nuevo.pendiente_de_correo
  and imp.deleted_at is null
  and nuevo.deleted_at is null;

comment on view public.duplicados_probables is
  'Alumnas importadas sin correo cuyo nombre coincide con una cuenta que se registró sola. Señal para revisar a mano, no fusión automática.';

-- La otra mitad de la señal: cuentas recién creadas que no tienen nada. Una
-- alumna que ya pagó y se registra sola aparece acá antes de que alguien note
-- que le faltan sus clases.
create or replace view public.perfiles_sin_actividad
with (security_invoker = true) as
select p.id, p.nombre, p.email, p.created_at
from public.perfiles p
where p.rol = 'alumna'
  and not p.pendiente_de_correo
  and p.deleted_at is null
  and not exists (select 1 from public.creditos c where c.perfil_id = p.id)
  and not exists (select 1 from public.reservas r where r.perfil_id = p.id);

-- ---------------------------------------------------------------------------
-- 9. RLS
-- ---------------------------------------------------------------------------
-- Ninguna tabla de plata o cupo acepta insert/update directo de authenticated.
-- Todo pasa por las funciones de §7. Es la regla de CLAUDE.md aplicada con
-- grants y no con confianza.

alter table public.planes enable row level security;
alter table public.compras enable row level security;
alter table public.creditos enable row level security;
alter table public.movimientos_credito enable row level security;
alter table public.clases enable row level security;
alter table public.reservas enable row level security;
alter table public.parametros enable row level security;

revoke all on public.planes, public.compras, public.creditos,
  public.movimientos_credito, public.clases, public.reservas, public.parametros
  from anon, authenticated;

-- Los planes y el calendario son públicos: se ven antes de tener cuenta.
grant select on public.planes to anon, authenticated;
grant select on public.clases to anon, authenticated;
grant select on public.parametros to anon, authenticated;

grant select on public.compras, public.creditos,
  public.movimientos_credito, public.reservas to authenticated;

-- Declarar una compra es lo ÚNICO que la alumna inserta directamente, y no
-- mueve plata ni cupo: solo deja una fila pendiente de revisión.
grant insert (perfil_id, plan_id, cantidad_clases, monto_clp, medio_pago,
              titular_declarado, nota_alumna) on public.compras to authenticated;

grant update on public.parametros to authenticated;
grant insert, update on public.clases to authenticated;

grant select, insert, update on public.planes, public.compras, public.creditos,
  public.clases, public.reservas to service_role;
grant select, insert on public.movimientos_credito to service_role;
-- El libro es solo agregar, también para service_role: salta RLS, no grants.
revoke update, delete on public.movimientos_credito from service_role;

drop policy if exists planes_lectura_publica on public.planes;
create policy planes_lectura_publica on public.planes
  for select to anon, authenticated using (activo and deleted_at is null);

drop policy if exists clases_lectura_publica on public.clases;
create policy clases_lectura_publica on public.clases
  for select to anon, authenticated using (estado = 'programada');

drop policy if exists clases_admin_todo on public.clases;
create policy clases_admin_todo on public.clases
  for select to authenticated using (public.tiene_nivel('admin'));

drop policy if exists clases_admin_crea on public.clases;
create policy clases_admin_crea on public.clases
  for insert to authenticated with check (public.tiene_nivel('admin'));

drop policy if exists clases_admin_edita on public.clases;
create policy clases_admin_edita on public.clases
  for update to authenticated
  using (public.tiene_nivel('admin')) with check (public.tiene_nivel('admin'));

drop policy if exists parametros_lectura on public.parametros;
create policy parametros_lectura on public.parametros
  for select to anon, authenticated using (true);

drop policy if exists parametros_admin_edita on public.parametros;
create policy parametros_admin_edita on public.parametros
  for update to authenticated
  using (public.tiene_nivel('admin')) with check (public.tiene_nivel('admin'));

drop policy if exists compras_propias on public.compras;
create policy compras_propias on public.compras
  for select to authenticated
  using (perfil_id in (select id from public.perfiles where user_id = (select auth.uid())));

drop policy if exists compras_declara_la_suya on public.compras;
create policy compras_declara_la_suya on public.compras
  for insert to authenticated
  with check (
    perfil_id in (select id from public.perfiles where user_id = (select auth.uid()))
  );

drop policy if exists compras_admin_lee on public.compras;
create policy compras_admin_lee on public.compras
  for select to authenticated using (public.tiene_nivel('admin'));

drop policy if exists creditos_propios on public.creditos;
create policy creditos_propios on public.creditos
  for select to authenticated
  using (perfil_id in (select id from public.perfiles where user_id = (select auth.uid())));

drop policy if exists creditos_admin_lee on public.creditos;
create policy creditos_admin_lee on public.creditos
  for select to authenticated using (public.tiene_nivel('admin'));

drop policy if exists movimientos_propios on public.movimientos_credito;
create policy movimientos_propios on public.movimientos_credito
  for select to authenticated
  using (perfil_id in (select id from public.perfiles where user_id = (select auth.uid())));

drop policy if exists movimientos_admin_lee on public.movimientos_credito;
create policy movimientos_admin_lee on public.movimientos_credito
  for select to authenticated using (public.tiene_nivel('admin'));

drop policy if exists reservas_propias on public.reservas;
create policy reservas_propias on public.reservas
  for select to authenticated
  using (perfil_id in (select id from public.perfiles where user_id = (select auth.uid())));

drop policy if exists reservas_admin_lee on public.reservas;
create policy reservas_admin_lee on public.reservas
  for select to authenticated using (public.tiene_nivel('admin'));

-- ---------------------------------------------------------------------------
-- 10. Permisos de ejecución
-- ---------------------------------------------------------------------------
-- reservar y cancelar_reserva las llama la alumna desde el servidor, con su
-- sesión: van a authenticated. acreditar y rechazar mueven plata a partir de
-- una revisión humana y pasan por Route Handler con la service role key.

revoke all on function public.acreditar_compra(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.rechazar_compra(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.generar_clases(int) from public, anon, authenticated;
revoke all on function public.reservar(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.cancelar_reserva(uuid, uuid) from public, anon, authenticated;

grant execute on function public.acreditar_compra(uuid, uuid, text) to service_role;
grant execute on function public.rechazar_compra(uuid, uuid, text) to service_role;
grant execute on function public.generar_clases(int) to service_role;
grant execute on function public.reservar(uuid, uuid, uuid, text) to service_role;
grant execute on function public.cancelar_reserva(uuid, uuid) to service_role;

grant execute on function public.saldo_creditos(uuid) to authenticated, service_role;
grant execute on function public.parametro_int(text, int) to anon, authenticated, service_role;
grant execute on function public.normalizar_nombre(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11. Primera generación
-- ---------------------------------------------------------------------------
-- Deja el calendario poblado apenas se aplique la migración. Después la repite
-- el cron. ⚠️ pg_cron todavía está por confirmar: ver PRD-0017 §13.

select public.generar_clases();
