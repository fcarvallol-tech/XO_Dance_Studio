-- La vigencia de los créditos pasa de 45 a 30 días (Felipe, 02/11/2026), **solo
-- para los que se emitan desde ahora**, como el cambio de 60 a 45 del 05/10.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, con
-- aprobación de Felipe en ese mismo mensaje.
--
-- `acreditar_compra` lee `planes.vigencia_dias` y `regalar_creditos` lee el
-- parámetro `regalo_vigencia_dias`, los dos **al emitir**, y guardan la fecha en
-- `creditos.fecha_vencimiento`. Nada recalcula esa fecha después, así que lo ya
-- emitido no cambia. Se comprueba igual: se suman los vencimientos antes y
-- después, y si cambia uno solo se aborta todo.
--
-- Lo que lee la alumna sale de la base: Ayuda, Comprar y el link de cada oferta
-- leen `planes.vigencia_dias`, y los correos dicen la fecha de vencimiento del
-- lote, no un número de días.
--
-- Idempotente.

do $$
declare
  v_vencimientos_antes numeric;
  v_vencimientos_despues numeric;
  v_lotes_antes int;
  v_lotes_despues int;
begin
  select coalesce(sum(extract(epoch from fecha_vencimiento)), 0), count(*)
  into v_vencimientos_antes, v_lotes_antes
  from public.creditos;

  update public.planes set vigencia_dias = 30 where vigencia_dias <> 30;

  update public.parametros set valor = '30', updated_at = now()
  where clave = 'regalo_vigencia_dias' and valor <> '30';
  if not found and not exists (select 1 from public.parametros where clave = 'regalo_vigencia_dias') then
    raise exception 'No existe el parámetro regalo_vigencia_dias.';
  end if;

  select coalesce(sum(extract(epoch from fecha_vencimiento)), 0), count(*)
  into v_vencimientos_despues, v_lotes_despues
  from public.creditos;
  if v_vencimientos_despues <> v_vencimientos_antes or v_lotes_despues <> v_lotes_antes then
    raise exception 'Algo cambió el vencimiento de créditos ya emitidos: se aborta todo.';
  end if;

  if exists (select 1 from public.planes where vigencia_dias <> 30) then
    raise exception 'Quedó un plan con vigencia distinta de 30.';
  end if;
end $$;
