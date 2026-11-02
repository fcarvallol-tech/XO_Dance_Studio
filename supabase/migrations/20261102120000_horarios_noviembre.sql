-- Cinco cambios de horario que rigen desde el lunes 09/11/2026 (Felipe, 02/11/2026).
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, con
-- aprobación de Felipe en ese mismo mensaje.
--
--   1. Lina, Slow Femme, sábado:   17:00 → 17:30, Los Leones (misma sede).
--   2. Carli, Girly, sábado:       18:00 → 18:30, Los Leones (misma sede).
--   3. Drimy, Reggaeton Femme:     lunes 17:00 → jueves 17:00, Los Leones (misma sede).
--   4. Pau, Girly:                 martes 20:00 Diaguitas → martes 18:00 Los Leones.
--                                  Su Reggaeton Femme del jueves no se toca.
--   5. Carli, Girly, viernes:      20:00 Los Leones → 20:30 Studio 98.
--      Excepción de una fecha: el viernes 13/11 es a las 18:30, misma sala.
--
-- "Los Leones" es la sede `seduccion-latina`. "Manuel Montt" es `studio-98` y
-- "Los Dominicos" es `diaguitas`: no se crea ninguna sede (CONTEXT.md).
--
-- ---------------------------------------------------------------------------
-- El corte, y por qué hace falta `horarios.vigente_desde`
-- ---------------------------------------------------------------------------
-- La semana del 2 al 8 de noviembre se dicta con la parrilla vieja, tal cual:
-- la última clase vieja es el domingo 8, la primera nueva el lunes 9 (Felipe).
-- Cambiar una clase con horas de aviso es cómo se pierden alumnas.
--
-- El precedente (20260908150000) no tenía este problema porque su corte ya
-- había pasado. Acá el corte es futuro, y `generar_clases()` —que corre todos
-- los días por cron— materializa cada horario activo **desde hoy**. Sin un
-- límite, el cron del martes crearía la Reggaeton de Drimy del jueves 05/11 en
-- el horario nuevo, y la Girly de Pau del martes 03/11 a las 18:00 en Los
-- Leones, encima de la que se dicta a las 20:00 en Diaguitas. Por eso los
-- horarios tienen ahora `vigente_desde`, y `generar_clases()` no crea clases
-- de un horario antes de esa fecha. `null` es "desde siempre": los horarios
-- que ya existían no cambian de comportamiento.
--
-- ---------------------------------------------------------------------------
-- Qué hace, en orden
-- ---------------------------------------------------------------------------
--   1. Agrega `horarios.vigente_desde` y hace que `generar_clases()` lo respete.
--   2. Corta las clases de los cinco horarios viejos desde el 09/11:
--      · las que tienen alguna reserva se CANCELAN con motivo legible, y el
--        trigger `clases_al_cancelar` devuelve los créditos;
--      · las que nadie reservó se BORRAN, como en el precedente.
--      Al 02/11, en producción, son 46 clases y ninguna tiene reservas: las alumnas todavía
--      coordinan por redes y no usan las reservas (Felipe). Las del 2 al 8 de
--      noviembre no se tocan.
--   3. Desactiva los cinco horarios viejos, sin borrarlos: las clases pasadas
--      apuntan a ellos.
--   4. Crea los cinco nuevos con `vigente_desde = 2026-11-09`.
--   5. `generar_clases()`. El cupo sale de `sedes.capacidad`: 35 en Studio 98
--      para el viernes de Carli (Felipe: "la capacidad real de la sala") y 22
--      en Los Leones.
--   6. Mueve la clase del viernes 13/11 de Carli a las 18:30, sobre esa fila.
--      No es una regla de horario: la fila conserva su `horario_id`.
--   7. Verifica la parrilla final —choques de sala y de profesora— y aborta si
--      algo no cuadra.
--
-- Idempotente: si se vuelve a correr, no encuentra nada que cortar, no
-- reinserta horarios, no duplica clases y la excepción ya está aplicada.
--
-- ---------------------------------------------------------------------------
-- Costo: dos clases pasan a costar más
-- ---------------------------------------------------------------------------
-- `metricas_finanzas` lee `sedes.costo_hora_clp` por `clases.sede_id`, sin
-- copiarlo, así que las clases nuevas se costean con su sede nueva:
--   · Girly de Pau: Diaguitas $0/h → Los Leones $17.000/h. Costo fijo de
--     $18.000 a $35.000; piso con pack de 8, de 3 a 6 alumnas.
--   · Girly del viernes de Carli: Los Leones → Studio 98 $23.500/h. Costo fijo
--     de $35.000 a $41.500; piso con pack de 8, de 6 a 7 alumnas.

-- ---------------------------------------------------------------------------
-- 1. vigente_desde y generar_clases
-- ---------------------------------------------------------------------------

alter table public.horarios
  add column if not exists vigente_desde date;

comment on column public.horarios.vigente_desde is
  'Primer día en que el horario genera clases. null = desde siempre. Existe para poder cargar un cambio de parrilla antes de que rija sin que el cron materialice clases en la semana de transición (20261102120000).';

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
    select h.id as horario_id, h.curso_id, h.profesora_id, h.sede_id, h.hora,
           s.capacidad, d::date as fecha
    from public.horarios h
    -- El cupo de cada clase sale de su sala (PRD-0021 §8.1). Antes no se
    -- seteaba y caía al default de la columna, que era 22 para todas.
    join public.sedes s on s.id = h.sede_id and s.deleted_at is null
    cross join generate_series(current_date, current_date + v_dias, interval '1 day') d
    where h.activo
      and h.deleted_at is null
      -- ISO: extract(isodow) da 1 = lunes … 7 = domingo, igual que dia_semana.
      and extract(isodow from d) = h.dia_semana
      -- Un horario cargado por adelantado no genera antes de regir.
      and (h.vigente_desde is null or d::date >= h.vigente_desde)
  )
  insert into public.clases
    (horario_id, fecha, inicio, curso_id, profesora_id, sede_id, cupo_maximo)
  select
    f.horario_id,
    f.fecha,
    -- Las clases se piensan en hora de Santiago; se guardan en UTC.
    (f.fecha + f.hora) at time zone 'America/Santiago',
    f.curso_id, f.profesora_id, f.sede_id, f.capacidad
  from fechas f
  on conflict (horario_id, fecha) do nothing;

  get diagnostics v_creadas = row_count;
  return v_creadas;
end;
$$;

-- Escrito y no heredado: `create or replace` conserva los permisos, pero lo que
-- funciona por defecto se rompe al primer revoke (CLAUDE.md).
revoke all on function public.generar_clases(int) from public, anon, authenticated;
grant execute on function public.generar_clases(int) to service_role;

-- ---------------------------------------------------------------------------
-- 2 a 7. Los cinco cambios
-- ---------------------------------------------------------------------------

do $$
declare
  v_corte constant date := '2026-11-09';
  v_excepcion constant date := '2026-11-13';
  v_hora_excepcion constant time := '18:30';

  v_viejos uuid[];
  v_nuevos uuid[];
  v_carli_viernes uuid;

  v_canceladas int;
  v_borradas int;
  v_generadas int;
  v_n int;
  fila record;
begin
  -- -------------------------------------------------------------------------
  -- 0. Los cambios, por slug. Se escribe por slug y no por uuid para no
  --    depender de los identificadores de una base en particular.
  -- -------------------------------------------------------------------------
  create temp table _cambios (
    n int primary key,
    profesora text, curso text,
    sede_vieja text, dia_viejo smallint, hora_vieja time,
    sede_nueva text, dia_nuevo smallint, hora_nueva time,
    motivo text,
    profesora_id uuid, curso_id uuid, sede_vieja_id uuid, sede_nueva_id uuid,
    horario_viejo uuid, horario_nuevo uuid
  ) on commit drop;

  insert into _cambios (n, profesora, curso, sede_vieja, dia_viejo, hora_vieja,
                        sede_nueva, dia_nuevo, hora_nueva, motivo) values
    (1, 'lina',  'slow-femme',      'seduccion-latina', 6, '17:00', 'seduccion-latina', 6, '17:30',
        'Cambio de horario: Slow Femme con Lina pasa a los sábados a las 17:30, en la misma sede'),
    (2, 'carli', 'girly',           'seduccion-latina', 6, '18:00', 'seduccion-latina', 6, '18:30',
        'Cambio de horario: Girly con Carli pasa a los sábados a las 18:30, en la misma sede'),
    (3, 'drimy', 'reggaeton-femme', 'seduccion-latina', 1, '17:00', 'seduccion-latina', 4, '17:00',
        'Cambio de horario: Reggaeton Femme con Drimy pasa a los jueves a las 17:00, en la misma sede'),
    (4, 'pau',   'girly',           'diaguitas',        2, '20:00', 'seduccion-latina', 2, '18:00',
        'Cambio de horario: Girly con Pau pasa a los martes a las 18:00, en Seducción Latina (Los Leones)'),
    (5, 'carli', 'girly',           'seduccion-latina', 5, '20:00', 'studio-98',        5, '20:30',
        'Cambio de horario: Girly del viernes con Carli pasa a las 20:30, en Studio 98');

  update _cambios c set
    profesora_id  = (select id from public.profesoras where slug = c.profesora),
    curso_id      = (select id from public.cursos     where slug = c.curso),
    sede_vieja_id = (select id from public.sedes      where slug = c.sede_vieja and deleted_at is null),
    sede_nueva_id = (select id from public.sedes      where slug = c.sede_nueva and deleted_at is null);

  if exists (select 1 from _cambios
             where profesora_id is null or curso_id is null
                or sede_vieja_id is null or sede_nueva_id is null) then
    raise exception 'Falta algún slug (lina, carli, drimy, pau, slow-femme, girly, reggaeton-femme, seduccion-latina, diaguitas, studio-98).';
  end if;

  -- Los horarios viejos. Pueden estar ya inactivos si esto ya corrió.
  update _cambios c set horario_viejo = (
    select h.id from public.horarios h
    where h.profesora_id = c.profesora_id and h.curso_id = c.curso_id
      and h.sede_id = c.sede_vieja_id and h.dia_semana = c.dia_viejo
      and h.hora = c.hora_vieja and h.deleted_at is null
  );

  for fila in select * from _cambios where horario_viejo is null loop
    raise exception 'No se encontró el horario viejo del cambio % (% · % · día % a las %, en %).',
      fila.n, fila.profesora, fila.curso, fila.dia_viejo, fila.hora_vieja, fila.sede_vieja;
  end loop;

  select array_agg(horario_viejo order by n) into v_viejos from _cambios;

  -- -------------------------------------------------------------------------
  -- 2. Cortar las clases viejas desde el 09/11. Por fecha, no por reloj: si
  --    esto se aplica después del corte, las clases viejas posteriores al 9
  --    salen igual. Las del 2 al 8 de noviembre se quedan.
  -- -------------------------------------------------------------------------
  update public.clases cl
  set estado = 'cancelada',
      motivo_cancelacion = c.motivo
  from _cambios c
  where cl.horario_id = c.horario_viejo
    and cl.estado = 'programada'
    and cl.fecha >= v_corte
    and exists (select 1 from public.reservas r where r.clase_id = cl.id);

  get diagnostics v_canceladas = row_count;

  -- La FK de `reservas` a `clases` es `on delete restrict`: si algo se colara
  -- acá con una reserva, la base rechaza el borrado y todo se revierte.
  delete from public.clases cl
  where cl.horario_id = any (v_viejos)
    and cl.estado = 'programada'
    and cl.fecha >= v_corte
    and not exists (select 1 from public.reservas r where r.clase_id = cl.id);

  get diagnostics v_borradas = row_count;

  raise notice 'Clases viejas desde el %: % canceladas (con reservas), % borradas (sin reservas).',
    v_corte, v_canceladas, v_borradas;

  -- -------------------------------------------------------------------------
  -- 3. Desactivar los horarios viejos.
  -- -------------------------------------------------------------------------
  update public.horarios set activo = false
  where id = any (v_viejos) and activo;

  -- -------------------------------------------------------------------------
  -- 4. Crear los horarios nuevos. `where not exists` en vez de `on conflict`
  --    porque los únicos son índices parciales.
  -- -------------------------------------------------------------------------
  insert into public.horarios (curso_id, profesora_id, sede_id, dia_semana, hora, vigente_desde)
  select c.curso_id, c.profesora_id, c.sede_nueva_id, c.dia_nuevo, c.hora_nueva, v_corte
  from _cambios c
  where not exists (
    select 1 from public.horarios h
    where h.curso_id = c.curso_id and h.profesora_id = c.profesora_id
      and h.sede_id = c.sede_nueva_id and h.dia_semana = c.dia_nuevo
      and h.hora = c.hora_nueva and h.activo and h.deleted_at is null
  );

  update _cambios c set horario_nuevo = (
    select h.id from public.horarios h
    where h.curso_id = c.curso_id and h.profesora_id = c.profesora_id
      and h.sede_id = c.sede_nueva_id and h.dia_semana = c.dia_nuevo
      and h.hora = c.hora_nueva and h.activo and h.deleted_at is null
  );

  select array_agg(horario_nuevo order by n) into v_nuevos from _cambios;
  select horario_nuevo into v_carli_viernes from _cambios where n = 5;

  -- -------------------------------------------------------------------------
  -- 5. Materializar. Respeta `vigente_desde`: nada antes del 09/11.
  -- -------------------------------------------------------------------------
  select public.generar_clases() into v_generadas;
  raise notice 'generar_clases() creó % clases.', v_generadas;

  -- -------------------------------------------------------------------------
  -- 6. La excepción del viernes 13/11: Carli a las 18:30, en Studio 98.
  -- -------------------------------------------------------------------------
  update public.clases
  set inicio = (v_excepcion + v_hora_excepcion) at time zone 'America/Santiago'
  where horario_id = v_carli_viernes
    and fecha = v_excepcion
    and estado = 'programada'
    and inicio <> (v_excepcion + v_hora_excepcion) at time zone 'America/Santiago';

  if not exists (
    select 1 from public.clases
    where horario_id = v_carli_viernes and fecha = v_excepcion and estado = 'programada'
      and inicio = (v_excepcion + v_hora_excepcion) at time zone 'America/Santiago'
  ) then
    raise exception 'La clase de Carli del viernes % no quedó a las %.', v_excepcion, v_hora_excepcion;
  end if;

  -- -------------------------------------------------------------------------
  -- 7. Verificar. Si algo no cuadra, se aborta y no queda nada a medias.
  -- -------------------------------------------------------------------------
  if exists (select 1 from public.horarios where id = any (v_viejos) and activo) then
    raise exception 'Quedó activo alguno de los horarios viejos.';
  end if;

  if array_position(v_nuevos, null) is not null then
    raise exception 'Falta alguno de los cinco horarios nuevos.';
  end if;

  select count(*) into v_n from public.clases
  where horario_id = any (v_viejos) and estado = 'programada' and fecha >= v_corte;
  if v_n > 0 then
    raise exception 'Quedaron % clases programadas en los horarios viejos desde el %.', v_n, v_corte;
  end if;

  select count(*) into v_n from public.clases
  where horario_id = any (v_nuevos) and fecha < v_corte;
  if v_n > 0 then
    raise exception 'Se crearon % clases de los horarios nuevos antes del corte %.', v_n, v_corte;
  end if;

  -- Cada horario nuevo tiene su primera clase: la del primer día que le toca
  -- desde el corte (o desde hoy, si esto se aplica después).
  for fila in
    select c.n, c.horario_nuevo, d::date as primera
    from _cambios c
    cross join lateral (
      select d from generate_series(greatest(v_corte, current_date), greatest(v_corte, current_date) + 6, interval '1 day') d
      where extract(isodow from d) = c.dia_nuevo
    ) d
  loop
    if not exists (select 1 from public.clases where horario_id = fila.horario_nuevo and fecha = fila.primera) then
      raise exception 'El cambio % no tiene su clase del %.', fila.n, fila.primera;
    end if;
  end loop;

  -- El cupo es el de la sala nueva: 35 en Studio 98, 22 en Los Leones.
  if exists (
    select 1 from public.clases cl join public.sedes s on s.id = cl.sede_id
    where cl.horario_id = any (v_nuevos) and cl.cupo_maximo <> s.capacidad
  ) then
    raise exception 'Hay clases nuevas cuyo cupo no es la capacidad de su sala.';
  end if;

  -- Choques en la parrilla final: misma sala o misma profesora, mismo día, a
  -- menos de una hora. El índice único solo mira la hora exacta. Lina 17:30 y
  -- Carli 18:30 el sábado quedan seguidas, sin margen, a propósito (Felipe).
  if exists (
    select 1
    from public.horarios a
    join public.horarios b
      on a.id < b.id and a.dia_semana = b.dia_semana
     and (a.sede_id = b.sede_id or a.profesora_id = b.profesora_id)
    where a.activo and a.deleted_at is null and b.activo and b.deleted_at is null
      and abs(extract(epoch from (a.hora - b.hora))) < 3600
  ) then
    raise exception 'La parrilla final tiene dos clases a menos de una hora en la misma sala o de la misma profesora.';
  end if;

  -- Y el viernes 13/11, contra las clases de ese día y no contra los horarios:
  -- Carli a las 18:30 en Studio 98, donde Isi dicta a las 17:00.
  if exists (
    select 1
    from public.clases ex
    join public.clases o
      on o.id <> ex.id and o.fecha = ex.fecha and o.estado = 'programada'
     and (o.sede_id = ex.sede_id or o.profesora_id = ex.profesora_id)
     and abs(extract(epoch from (o.inicio - ex.inicio))) < 3600
    where ex.horario_id = v_carli_viernes and ex.fecha = v_excepcion
  ) then
    raise exception 'La clase de Carli del % a las % choca con otra clase.', v_excepcion, v_hora_excepcion;
  end if;

  select count(*) into v_n from public.clases
  where horario_id = any (v_nuevos) and estado = 'programada';
  raise notice 'Listo: % clases programadas en los cinco horarios nuevos.', v_n;
end $$;
