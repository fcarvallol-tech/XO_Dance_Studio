-- Salas más chicas: Studio 98 de 35 a 30, Los Leones de 22 a 18 (Felipe,
-- 02/11/2026).
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, con
-- aprobación de Felipe en ese mismo mensaje.
--
-- `clases.cupo_maximo` se copia de `sedes.capacidad` al generar cada clase, así
-- que bajar la sala no baja las clases ya materializadas: hay que bajarlas
-- también. Solo las que **no han empezado** y están programadas; las dictadas
-- se quedan con su cupo, como dice PRD-0021 ("no se aplica hacia atrás").
--
-- `least(cupo_maximo, capacidad)` y no `= capacidad`: una clase especial con un
-- cupo menor que la sala lo conserva. El trigger `clases_cupo_cabe_en_la_sala`
-- igual rechazaría cualquier cupo por encima de la sala nueva.
--
-- Se aborta si alguna clase futura tiene más reservas en pie que su cupo nuevo:
-- al 02/11 en producción no hay ninguna reserva, pero se comprueba igual.
--
-- La dirección de Los Leones no se toca acá: sigue siendo
-- "Av. Nueva Providencia 2260, local 130, piso 3" (20260929120000).
--
-- Idempotente.

do $$
declare
  v_bajadas int;
  v_n int;
begin
  if (select count(*) from public.sedes where slug in ('studio-98', 'seduccion-latina') and deleted_at is null) <> 2 then
    raise exception 'Falta alguna de las sedes studio-98 o seduccion-latina.';
  end if;

  update public.sedes set capacidad = 30, updated_at = now()
  where slug = 'studio-98' and capacidad <> 30;

  update public.sedes set capacidad = 18, updated_at = now()
  where slug = 'seduccion-latina' and capacidad <> 18;

  -- Lo que ya está tomado en cada clase futura de esas dos salas, contra el
  -- cupo nuevo. Una reserva "en pie" es la que ocupa lugar.
  select count(*) into v_n
  from public.clases cl
  join public.sedes s on s.id = cl.sede_id
  where s.slug in ('studio-98', 'seduccion-latina')
    and cl.estado = 'programada'
    and cl.inicio > now()
    and (select count(*) from public.reservas r
         where r.clase_id = cl.id
           and r.estado in ('confirmada', 'pendiente_pago', 'asistio', 'no_asistio')) > s.capacidad;
  if v_n > 0 then
    raise exception '% clases futuras tienen más reservas que el cupo nuevo de su sala. No se baja nada.', v_n;
  end if;

  update public.clases cl
  set cupo_maximo = least(cl.cupo_maximo, s.capacidad)
  from public.sedes s
  where s.id = cl.sede_id
    and s.slug in ('studio-98', 'seduccion-latina')
    and cl.estado = 'programada'
    and cl.inicio > now()
    and cl.cupo_maximo > s.capacidad;

  get diagnostics v_bajadas = row_count;
  raise notice 'Clases futuras con el cupo bajado: %.', v_bajadas;

  if exists (
    select 1 from public.clases cl join public.sedes s on s.id = cl.sede_id
    where cl.estado = 'programada' and cl.inicio > now() and cl.cupo_maximo > s.capacidad
  ) then
    raise exception 'Quedó una clase futura con más cupo que su sala.';
  end if;
end $$;
