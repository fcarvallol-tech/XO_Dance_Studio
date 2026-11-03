-- La ventana de cancelación pasa de 30 minutos a 12 horas (Felipe, 02/11/2026).
-- Cierra la decisión que estaba abierta en CONTEXT.md §12.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, con
-- aprobación de Felipe en ese mismo mensaje.
--
-- Hasta hoy la regla era 30 minutos: `cancelar_reserva()` devuelve el crédito
-- si `now() < inicio - cancelacion_minutos`, y el parámetro valía 30 desde
-- 20260831120000. La función no cambia; cambia el parámetro.
--
-- Los textos del sitio dicen lo mismo desde `lib/dominio/reservas.ts`
-- (`HORAS_PARA_CANCELAR = 12`). Si alguien vuelve a mover el parámetro, tiene
-- que mover también esa constante.
--
-- Una reserva con compra (clase especial) no se rige por esta ventana: su plata
-- no se devuelve sola (PRD-0018 §8.3). Eso no cambia.
--
-- Idempotente.

update public.parametros
set valor = '720', updated_at = now()
where clave = 'cancelacion_minutos' and valor <> '720';

do $$
begin
  if public.parametro_int('cancelacion_minutos', 30) <> 720 then
    raise exception 'cancelacion_minutos no quedó en 720 (12 horas).';
  end if;
end $$;
