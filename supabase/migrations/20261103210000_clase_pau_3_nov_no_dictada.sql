-- La Reggaeton Femme de Pau del martes 03/11/2026, 18:00, Los Leones, no se
-- dictó: muchas alumnas no alcanzaron a llegar. Se va a recuperar, y la sala
-- de la recuperación no se cobra (Felipe, 03/11/2026).
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, con
-- aprobación de Felipe en ese mismo mensaje.
--
-- ---------------------------------------------------------------------------
-- Lo urgente son los créditos, no el registro
-- ---------------------------------------------------------------------------
-- Hay alumnas que reservaron esta clase y gastaron un crédito en ella. Pasarla
-- a `cancelada` dispara `clases_al_cancelar` (20260904130000), que llama a
-- `devolver_creditos_de_clase` (versión de 20260910120000): cada reserva
-- `confirmada` pasa a `cancelada` con `credito_devuelto`, su lote original
-- recupera el crédito y queda una fila `cancelacion` en `movimientos_credito`.
--
-- **El disparador no mira la fecha**, así que actúa igual sobre una clase que
-- ya pasó. Lo que sí mira es el estado de la reserva: solo devuelve las
-- `confirmada` (y `pendiente_pago`, que es de especiales). Una reserva marcada
-- `asistio` o `no_asistio` quedaría afuera sin crédito. Al 03/11 nada en el
-- código escribe esos dos estados —no hay pantalla de asistencia y
-- `registrar_asistencia` solo toca `clases`—, pero se comprueba igual: si
-- aparece alguna, la migración **aborta antes de cancelar** y se resuelve
-- distinto.
--
-- El motivo es "Cancelada", sin nada más (Felipe, 03/11/2026): nada de
-- explicaciones en ese campo. Lo que importa es que el crédito vuelva, y eso
-- lo hace el disparador.
--
-- ---------------------------------------------------------------------------
-- Lo que esta migración NO resuelve: el pago a Pau
-- ---------------------------------------------------------------------------
-- Pau no faltó. La clase no se dictó por asistencia, y esa causa no existe en
-- el modelo: queda pendiente de clasificar para la liquidación, anotado en
-- PRD-0010 parte 3. Tampoco se crea la clase de recuperación: no tiene fecha.
--
-- Idempotente: si la clase ya está cancelada, no vuelve a tocar nada.

do $$
declare
  v_fecha constant date := '2026-11-03';
  v_motivo constant text := 'Cancelada';

  v_clase public.clases;
  v_confirmadas int;
  v_pendientes int;
  v_fuera int;
  v_devueltas int;
  v_movimientos int;
begin
  select cl.* into v_clase
  from public.clases cl
  join public.profesoras p on p.id = cl.profesora_id
  join public.cursos cu on cu.id = cl.curso_id
  join public.sedes s on s.id = cl.sede_id
  where p.slug = 'pau'
    and cu.slug = 'reggaeton-femme'
    and s.slug = 'seduccion-latina'
    and cl.fecha = v_fecha
    and (cl.inicio at time zone 'America/Santiago')::time = '18:00';

  if v_clase.id is null then
    raise exception 'No está la Reggaeton Femme de Pau del % a las 18:00 en Los Leones.', v_fecha;
  end if;

  if v_clase.estado = 'cancelada' then
    raise notice 'La clase % ya estaba cancelada. No se toca nada.', v_clase.id;
    return;
  end if;

  select
    count(*) filter (where estado = 'confirmada'),
    count(*) filter (where estado = 'pendiente_pago'),
    count(*) filter (where estado in ('asistio', 'no_asistio'))
  into v_confirmadas, v_pendientes, v_fuera
  from public.reservas
  where clase_id = v_clase.id;

  if v_fuera > 0 then
    raise exception '% reservas de esta clase están en asistio/no_asistio: el disparador no les devolvería el crédito. No se cancela nada.', v_fuera;
  end if;

  raise notice 'Reservas en pie antes de cancelar: % confirmadas, % pendientes de pago.',
    v_confirmadas, v_pendientes;

  -- El disparador `clases_al_cancelar` devuelve los créditos en este update.
  update public.clases
  set estado = 'cancelada', motivo_cancelacion = v_motivo
  where id = v_clase.id;

  -- Comprobar lo que hizo el disparador, no suponerlo.
  select count(*) into v_devueltas
  from public.reservas
  where clase_id = v_clase.id
    and estado = 'cancelada'
    and credito_devuelto
    and cancelada_at >= now() - interval '1 minute';

  select count(*) into v_movimientos
  from public.movimientos_credito m
  join public.reservas r on r.id = m.reserva_id
  where r.clase_id = v_clase.id
    and m.tipo = 'cancelacion'
    and m.cantidad = 1
    and m.created_at >= now() - interval '1 minute';

  if exists (
    select 1 from public.reservas
    where clase_id = v_clase.id and estado in ('confirmada', 'pendiente_pago')
  ) then
    raise exception 'Quedó una reserva en pie en una clase cancelada.';
  end if;

  if v_devueltas <> v_confirmadas or v_movimientos <> v_confirmadas then
    raise exception 'Eran % reservas confirmadas y volvieron % créditos con % movimientos. No cuadra.',
      v_confirmadas, v_devueltas, v_movimientos;
  end if;

  raise notice 'Clase % cancelada. % reservas devueltas, % créditos de vuelta a su lote.',
    v_clase.id, v_devueltas, v_movimientos;

  -- El crédito vuelve a su lote original. Si ese lote ya venció, la alumna lo
  -- tiene en el papel y no lo puede usar. No se aborta —devolverlo es lo
  -- correcto igual—, pero se avisa, porque eso pide un regalo a mano.
  select count(*) into v_fuera
  from public.reservas r
  join public.creditos c on c.id = r.credito_id
  where r.clase_id = v_clase.id
    and r.credito_devuelto
    and c.fecha_vencimiento <= now();

  if v_fuera > 0 then
    raise warning '% créditos volvieron a un lote ya vencido: esas alumnas no los pueden usar.', v_fuera;
  end if;
end $$;
