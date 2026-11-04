-- Los Leones baja de 18 a 16 (Felipe, 03/11/2026): llegaron reclamos de que
-- la sala queda muy llena. Es el segundo cambio en dos días: 22 → 18 el 02/11
-- (20261102130000) y 18 → 16 hoy.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, con
-- aprobación de Felipe en ese mismo mensaje.
--
-- Mismo caso que el 02/11: `clases.cupo_maximo` se copia de `sedes.capacidad`
-- al generar cada clase, así que las clases futuras ya materializadas traen 18
-- adentro y hay que bajarlas también. Solo las programadas que **no han
-- empezado**; las pasadas conservan su cupo (PRD-0021: "no se aplica hacia
-- atrás"). `least()` para que una especial con cupo menor lo conserve.
--
-- **Nadie pierde su reserva.** Si alguna clase futura de Los Leones tiene más
-- de 16 reservas en pie, la migración aborta sin bajar nada: dejarla
-- sobrevendida lo decide Felipe. Al 03/11 a las 21:00, el calendario público
-- de producción da como máximo 9 (Girly de Carli, sábado 07/11).
--
-- Idempotente.

do $$
declare
  v_bajadas int;
  v_n int;
begin
  if not exists (select 1 from public.sedes where slug = 'seduccion-latina' and deleted_at is null) then
    raise exception 'Falta la sede seduccion-latina (Los Leones).';
  end if;

  -- Primero se comprueba, después se baja: si no cabe, no se toca nada.
  select count(*) into v_n
  from public.clases cl
  join public.sedes s on s.id = cl.sede_id
  where s.slug = 'seduccion-latina'
    and cl.estado = 'programada'
    and cl.inicio > now()
    and (select count(*) from public.reservas r
         where r.clase_id = cl.id
           and r.estado in ('confirmada', 'pendiente_pago', 'asistio', 'no_asistio')) > 16;
  if v_n > 0 then
    raise exception '% clases futuras de Los Leones tienen más de 16 reservas en pie. No se baja nada: lo decide Felipe.', v_n;
  end if;

  update public.sedes set capacidad = 16, updated_at = now()
  where slug = 'seduccion-latina' and capacidad <> 16;

  update public.clases cl
  set cupo_maximo = least(cl.cupo_maximo, s.capacidad)
  from public.sedes s
  where s.id = cl.sede_id
    and s.slug = 'seduccion-latina'
    and cl.estado = 'programada'
    and cl.inicio > now()
    and cl.cupo_maximo > s.capacidad;

  get diagnostics v_bajadas = row_count;
  raise notice 'Clases futuras de Los Leones con el cupo bajado a 16: %.', v_bajadas;

  if exists (
    select 1 from public.clases cl join public.sedes s on s.id = cl.sede_id
    where cl.estado = 'programada' and cl.inicio > now() and cl.cupo_maximo > s.capacidad
  ) then
    raise exception 'Quedó una clase futura con más cupo que su sala.';
  end if;
end $$;
