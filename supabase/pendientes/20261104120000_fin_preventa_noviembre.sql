-- Fin de la preventa del 03/11/2026. Para el MIÉRCOLES 04/11.
--
-- ⚠️ VIVE FUERA DE supabase/migrations/ A PROPÓSITO. `db push` aplica todo lo
-- pendiente: si estuviera allá se iría en el mismo push que monta la preventa y
-- la desarmaría en el acto. El miércoles se mueve a supabase/migrations/ y se
-- aplica con `supabase db push`, **con aprobación de Felipe por nombre**.
--
-- Qué hace: limpia `precio_promocional`, `promo_hasta` y `promo_nombre` de los
-- packs de 4 y de 8. La preventa ya se apagó sola a medianoche del martes —el
-- sitio compara `promo_hasta` con el día en Santiago—, así que esto no cambia
-- ningún precio que se vea: deja la tabla sin una promoción vencida colgando,
-- que la próxima vez se confunde con una vigente.
--
-- Precios de lista, que nunca se tocaron (`precio_clp`), y que esto comprueba:
--   suelta $8.500 · pack-2 $16.000 · pack-4 $28.000 · pack-8 $48.000
--
-- Solo borra la preventa del 03/11: si para entonces alguien cargó otra
-- promoción en esas filas, no la pisa. Idempotente.

update public.planes
set precio_promocional = null, promo_hasta = null, promo_nombre = null, updated_at = now()
where slug in ('pack-4', 'pack-8')
  and promo_hasta = date '2026-11-03'
  and promo_nombre in ('4 clases en preventa', '8 clases en preventa');

do $$
begin
  if exists (select 1 from public.planes
             where slug in ('pack-4', 'pack-8') and promo_nombre like '% en preventa'
               and promo_hasta = date '2026-11-03') then
    raise exception 'Quedó la preventa del 03/11 en algún pack.';
  end if;

  if (select precio_clp from public.planes where slug = 'suelta') is distinct from 8500
     or (select precio_clp from public.planes where slug = 'pack-2') is distinct from 16000
     or (select precio_clp from public.planes where slug = 'pack-4') is distinct from 28000
     or (select precio_clp from public.planes where slug = 'pack-8') is distinct from 48000 then
    raise exception 'Un precio de lista no es el que había antes de la preventa.';
  end if;
end $$;
