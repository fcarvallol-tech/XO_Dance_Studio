-- PRD-0030, parte 1: la reserva retroactiva.
--
-- Una alumna bailó en una clase que ya pasó y no tenía reserva. Quitarle el
-- crédito no sirve: la cuenta queda cuadrada y la clase mal registrada, y la
-- profesora no cobra los $250 de esa alumna ni la cuenta para el promedio.
-- Lo que falta es **la reserva**, que es lo que consume el crédito y lo que
-- paga (Felipe, 08/11/2026; PRD-0024 §8.6.a).
--
-- Tres decisiones que alguien va a querer "arreglar" después. No se arreglan:
--
-- 1. **El crédito se evalúa con la fecha de la CLASE, no con la de hoy.** La
--    pregunta es "¿tenía crédito el día que bailó?". Se buscan los lotes que
--    ya existían y no habían vencido al inicio de la clase, y se descuenta el
--    que vencía primero entre esos. El movimiento del libro va **fechado al
--    inicio de la clase**. **La fecha de vencimiento del lote no se toca**: no
--    se revive nada y no hay lista paralela de vencidos. Un lote que venció con
--    una clase sin usar, consumida por una clase anterior a su vencimiento,
--    **nunca estuvo realmente sin usar**: la alumna la usó a tiempo, y lo que
--    llegó tarde fue el registro.
--
-- 2. **El cupo no se valida.** Es una clase que ya pasó: si fueron 17 en una
--    sala de 16, fueron 17. Bloquear acá no protege ningún cupo —ya no hay
--    nada que reservar— y deja la clase mal registrada.
--
-- 3. **Si ese día no tenía crédito, no se inventa uno.** En esta parte la
--    función responde `sin_credito_ese_dia` y el owner decide: usar un crédito
--    que la alumna tiene **hoy** (`p_usar_credito_de_hoy`), o no registrar. La
--    deuda automática es la parte 2 del PRD y no está acá.
--
-- Solo owner, verificado adentro. Una transacción: el lote, la reserva y el
-- movimiento, o nada. El libro solo se agrega.
--
-- No depende de la liquidación (20261105140000 / 20261106130000): si la tabla
-- `liquidaciones_profesoras` existe, una clase de un mes ya cerrado se rechaza;
-- si no existe, no hay cierre que proteger. Se pregunta con `to_regclass`.

-- ---------------------------------------------------------------------------
-- 1. reservas: quién la creó, por qué, y el origen `retroactiva`
-- ---------------------------------------------------------------------------

alter table public.reservas
  add column if not exists creada_por uuid references public.perfiles (id) on delete restrict,
  add column if not exists motivo text;

do $$
declare
  v_nombre text;
begin
  for v_nombre in
    select conname from pg_constraint
    where conrelid = 'public.reservas'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%origen%'
  loop
    execute format('alter table public.reservas drop constraint %I', v_nombre);
  end loop;
end $$;

alter table public.reservas add constraint reservas_origen_valido
  check (origen in ('web', 'admin', 'importacion', 'retroactiva'));

-- Una retroactiva sin autor o sin motivo es justo lo que no tiene que existir.
alter table public.reservas add constraint reservas_retroactiva_con_autor
  check (origen <> 'retroactiva'
         or (creada_por is not null and char_length(btrim(coalesce(motivo, ''))) >= 5));

create index if not exists reservas_retroactivas_idx
  on public.reservas (created_at desc) where origen = 'retroactiva';

-- ---------------------------------------------------------------------------
-- 2. reservar_retroactiva()
-- ---------------------------------------------------------------------------

create or replace function public.reservar_retroactiva(
  p_actor_user_id uuid,
  p_perfil_id uuid,
  p_clase_id uuid,
  p_motivo text,
  p_usar_credito_de_hoy boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_alumna public.perfiles;
  v_clase public.clases;
  v_credito public.creditos;
  v_reserva public.reservas;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_mes date;
  v_cerrada boolean := false;
  v_de text;
  v_hoy int;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;
  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('owner') then
    raise exception 'Solo el owner puede registrar una asistencia pasada' using errcode = '42501';
  end if;

  if char_length(v_motivo) < 5 then
    raise exception 'Escribe por qué se registra (al menos 5 caracteres)' using errcode = '22023';
  end if;

  -- El perfil primero y bloqueado, como en revocar y regalar: una reserva o
  -- una revocación al mismo tiempo espera.
  select * into v_alumna from public.perfiles
  where id = p_perfil_id and deleted_at is null
  for update;
  if v_alumna is null then
    raise exception 'Esa persona no existe' using errcode = 'P0002';
  end if;

  select * into v_clase from public.clases where id = p_clase_id for update;
  if v_clase is null then
    raise exception 'La clase no existe' using errcode = 'P0002';
  end if;
  if v_clase.tipo = 'especial' then
    raise exception 'Las clases especiales se pagan aparte, no con clases del pack'
      using errcode = '22023';
  end if;
  if v_clase.estado <> 'programada' then
    raise exception 'Esa clase se canceló: nadie pudo bailar en ella' using errcode = '22023';
  end if;
  if v_clase.inicio > now() then
    raise exception 'Esa clase todavía no empieza: se reserva normal' using errcode = '22023';
  end if;

  -- Un mes cerrado no se toca por el costado: hay que anular el cierre.
  v_mes := date_trunc('month', v_clase.inicio at time zone 'America/Santiago')::date;
  if to_regclass('public.liquidaciones_profesoras') is not null then
    execute $q$
      select exists (
        select 1 from public.liquidaciones_profesoras
        where profesora_id = $1 and mes = $2
          and anulada_at is null and deleted_at is null
      )
    $q$ into v_cerrada using v_clase.profesora_id, v_mes;
    if v_cerrada then
      raise exception 'La liquidación de esa profesora para ese mes ya está cerrada. Anula el cierre, registra la asistencia y vuelve a cerrar'
        using errcode = '23514';
    end if;
  end if;

  if exists (
    select 1 from public.reservas
    where perfil_id = v_alumna.id and clase_id = v_clase.id
      and estado in ('confirmada', 'asistio', 'no_asistio')
  ) then
    -- `no_asistio` también: esa reserva ya consumió su crédito, y otra encima
    -- le cobraría dos veces la misma clase.
    raise exception 'Ya tiene una reserva en esa clase' using errcode = '23514';
  end if;

  -- Sin validación de cupo, a propósito: ver la cabecera, punto 2.

  -- El lote que vencía primero **entre los vigentes el día de la clase**: ya
  -- existía al empezar y todavía no vencía. Hoy puede estar vencido; no
  -- importa, y su vencimiento no se toca (cabecera, punto 1).
  select * into v_credito from public.creditos
  where perfil_id = v_alumna.id
    and cantidad_disponible > 0
    and created_at <= v_clase.inicio
    and fecha_vencimiento > v_clase.inicio
  order by fecha_vencimiento asc, id
  limit 1
  for update;
  v_de := 'dia_de_la_clase';

  if v_credito is null then
    select coalesce(sum(cantidad_disponible), 0)::int into v_hoy
    from public.creditos
    where perfil_id = v_alumna.id and cantidad_disponible > 0 and fecha_vencimiento > now();

    if not coalesce(p_usar_credito_de_hoy, false) then
      -- No es un error: es la pregunta que el owner tiene que contestar.
      return jsonb_build_object('ok', false, 'motivo', 'sin_credito_ese_dia', 'vigentes_hoy', v_hoy);
    end if;

    select * into v_credito from public.creditos
    where perfil_id = v_alumna.id and cantidad_disponible > 0 and fecha_vencimiento > now()
    order by fecha_vencimiento asc, id
    limit 1
    for update;
    v_de := 'hoy';

    if v_credito is null then
      return jsonb_build_object('ok', false, 'motivo', 'sin_credito', 'vigentes_hoy', 0);
    end if;
  end if;

  update public.creditos
  set cantidad_disponible = cantidad_disponible - 1
  where id = v_credito.id;

  insert into public.reservas (perfil_id, clase_id, credito_id, estado, origen, creada_por, motivo)
  values (v_alumna.id, v_clase.id, v_credito.id, 'asistio', 'retroactiva', v_actor.id, v_motivo)
  returning * into v_reserva;

  -- Fechado al inicio de la clase, no a hoy: es cuándo se consumió. Lo que se
  -- registró hoy lo dice `reservas.created_at`. `saldo_resultante` es el saldo
  -- de hoy, que es el único que se puede calcular sin reescribir el libro.
  insert into public.movimientos_credito
    (perfil_id, credito_id, reserva_id, tipo, cantidad, saldo_resultante, motivo, creado_por, created_at)
  values
    (v_alumna.id, v_credito.id, v_reserva.id, 'reserva', -1,
     public.saldo_creditos(v_alumna.id), v_motivo, v_actor.id, v_clase.inicio);

  return jsonb_build_object(
    'ok', true,
    'reserva_id', v_reserva.id,
    'credito_id', v_credito.id,
    'credito_de', v_de,
    'lote_vence', v_credito.fecha_vencimiento,
    'lote_vencido_hoy', v_credito.fecha_vencimiento <= now()
  );
end;
$$;

comment on function public.reservar_retroactiva(uuid, uuid, uuid, text, boolean) is
  'PRD-0030: registra que una alumna bailó en una clase pasada sin reserva. Descuenta del lote vigente el día de la clase que vencía primero, fecha el movimiento al inicio de la clase, no valida cupo y no toca vencimientos. Sin crédito ese día devuelve sin_credito_ese_dia, salvo p_usar_credito_de_hoy. Solo owner, verificado adentro.';

revoke all on function public.reservar_retroactiva(uuid, uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.reservar_retroactiva(uuid, uuid, uuid, text, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3. reservas_retroactivas(): la lista y la cuenta del mes, para el owner
-- ---------------------------------------------------------------------------
-- Si un mes aparecen veinte, el problema no es esta herramienta: es que nadie
-- está marcando asistencia (Felipe, 08/11/2026).

create or replace function public.reservas_retroactivas(p_desde timestamptz, p_hasta timestamptz)
returns table (
  reserva_id uuid,
  registrada_at timestamptz,
  clase_inicio timestamptz,
  curso text,
  profesora text,
  alumna text,
  motivo text,
  autor text,
  lote_vencido_hoy boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.tiene_nivel('owner') then
    raise exception 'Solo el owner ve las asistencias registradas después' using errcode = '42501';
  end if;

  return query
  select r.id, r.created_at, c.inicio, cu.nombre, pr.nombre, p.nombre, r.motivo, a.nombre,
         cr.fecha_vencimiento <= now()
  from public.reservas r
  join public.clases c on c.id = r.clase_id
  join public.cursos cu on cu.id = c.curso_id
  join public.profesoras pr on pr.id = c.profesora_id
  join public.perfiles p on p.id = r.perfil_id
  left join public.perfiles a on a.id = r.creada_por
  left join public.creditos cr on cr.id = r.credito_id
  where r.origen = 'retroactiva'
    and c.inicio >= p_desde and c.inicio < p_hasta
  order by c.inicio desc, r.created_at desc;
end;
$$;

comment on function public.reservas_retroactivas(timestamptz, timestamptz) is
  'PRD-0030: las reservas retroactivas de las clases entre p_desde y p_hasta, con motivo y autor. Solo owner, verificado adentro.';

revoke all on function public.reservas_retroactivas(timestamptz, timestamptz) from public, anon;
grant execute on function public.reservas_retroactivas(timestamptz, timestamptz)
  to authenticated, service_role;
