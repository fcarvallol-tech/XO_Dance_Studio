-- La duración de las clases, en los datos (Felipe, 06/11/2026).
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, con
-- aprobación de Felipe en ese mismo mensaje, por el nombre de este archivo.
--
-- `horarios` tenía la hora de inicio y nada más, así que `clases.fin` nacía nulo
-- y la hora por defecto de `horas()` decidía el sueldo. El día de una clase de 90
-- minutos, la base se habría calculado como una hora, en silencio, contra la
-- profesora.
--
--  1. horarios.duracion_min, **sin default**: un horario nuevo tiene que decirla.
--     Los 15 de abajo los confirmó Felipe uno por uno el 06/11/2026.
--  2. clases.fin se rellena desde su horario.
--  3. generar_clases() lo calcula de ahora en adelante.
--  4. Una clase de parrilla ya no puede quedar sin `fin`. Las especiales no
--     cambian: ya nacen con fin, y la regla no las nombra.
--
-- ⚠️ Rellenar `fin` mueve la huella de la liquidación, aunque no el monto: un mes
-- cerrado antes de esta migración no se puede pagar sin anular y volver a cerrar.
-- Aplicarla antes de cerrar noviembre.
--
-- No depende de las migraciones de esta tanda. Idempotente.

-- ---------------------------------------------------------------------------
-- 1. horarios.duracion_min
-- ---------------------------------------------------------------------------

alter table public.horarios add column if not exists duracion_min int;

with confirmadas (dia_semana, hora, curso, profesora, sede, minutos) as (
  values
    (1, time '17:00', 'reggaeton-femme', 'drimy', 'seduccion-latina', 60),
    (1, time '18:00', 'teens', 'carli', 'diaguitas', 60),
    (1, time '20:00', 'girly', 'pau', 'diaguitas', 60),
    (2, time '18:00', 'reggaeton-femme', 'pau', 'seduccion-latina', 60),
    (2, time '20:00', 'girly', 'pau', 'diaguitas', 60),
    (3, time '20:00', 'reggaeton-femme', 'pau', 'diaguitas', 60),
    (4, time '17:00', 'reggaeton', 'drimy', 'seduccion-latina', 60),
    (4, time '19:30', 'reggaeton-femme', 'pau', 'diaguitas', 60),
    (5, time '17:00', 'reggaeton-antiguo', 'isi', 'studio-98', 60),
    (5, time '20:00', 'girly', 'carli', 'seduccion-latina', 60),
    (5, time '20:30', 'girly', 'carli', 'studio-98', 60),
    (6, time '17:00', 'slow-femme', 'lina', 'seduccion-latina', 60),
    (6, time '17:30', 'slow-femme', 'lina', 'seduccion-latina', 60),
    (6, time '18:00', 'girly', 'carli', 'seduccion-latina', 60),
    (6, time '18:30', 'girly', 'carli', 'seduccion-latina', 60)
)
update public.horarios h
set duracion_min = c.minutos
from confirmadas c
join public.cursos cu on cu.slug = c.curso
join public.profesoras p on p.slug = c.profesora
join public.sedes s on s.slug = c.sede
where h.duracion_min is null
  and h.dia_semana = c.dia_semana
  and h.hora = c.hora
  and h.curso_id = cu.id
  and h.profesora_id = p.id
  and h.sede_id = s.id;

-- Un horario que no está en la lista nadie confirmó cuánto dura: se aborta, no
-- se le inventa un número.
do $$
declare
  v_faltan int;
begin
  select count(*) into v_faltan from public.horarios where duracion_min is null;
  if v_faltan > 0 then
    raise exception '% horarios sin duración confirmada: hay que preguntarle a Felipe.', v_faltan;
  end if;
end $$;

alter table public.horarios alter column duracion_min set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'horarios_duracion_valida') then
    alter table public.horarios add constraint horarios_duracion_valida
      check (duracion_min between 15 and 240);
  end if;
end $$;

comment on column public.horarios.duracion_min is
  'Cuánto dura la clase, en minutos. Sin default a propósito: de acá sale clases.fin, y de clases.fin la base de la profesora.';

-- ---------------------------------------------------------------------------
-- 2. clases.fin, desde su horario
-- ---------------------------------------------------------------------------

update public.clases cl
set fin = cl.inicio + make_interval(mins => h.duracion_min)
from public.horarios h
where h.id = cl.horario_id
  and cl.tipo = 'parrilla'
  and cl.fin is null;

-- ---------------------------------------------------------------------------
-- 3. generar_clases()
-- ---------------------------------------------------------------------------
-- Igual a la versión de 20260926120000, más `fin`.

create or replace function public.generar_clases(p_dias integer default null)
returns integer
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
           h.duracion_min, s.capacidad, d::date as fecha
    from public.horarios h
    -- El cupo de cada clase sale de su sala (PRD-0021 §8.1).
    join public.sedes s on s.id = h.sede_id and s.deleted_at is null
    cross join generate_series(current_date, current_date + v_dias, interval '1 day') d
    where h.activo
      and h.deleted_at is null
      -- ISO: extract(isodow) da 1 = lunes … 7 = domingo, igual que dia_semana.
      and extract(isodow from d) = h.dia_semana
  )
  insert into public.clases
    (horario_id, fecha, inicio, fin, curso_id, profesora_id, sede_id, cupo_maximo)
  select
    f.horario_id,
    f.fecha,
    -- Las clases se piensan en hora de Santiago; se guardan en UTC.
    (f.fecha + f.hora) at time zone 'America/Santiago',
    ((f.fecha + f.hora) at time zone 'America/Santiago') + make_interval(mins => f.duracion_min),
    f.curso_id, f.profesora_id, f.sede_id, f.capacidad
  from fechas f
  on conflict (horario_id, fecha) do nothing;

  get diagnostics v_creadas = row_count;
  return v_creadas;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Una clase de parrilla no queda sin fin
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clases_parrilla_con_fin') then
    alter table public.clases add constraint clases_parrilla_con_fin
      check (tipo <> 'parrilla' or fin is not null);
  end if;
end $$;
