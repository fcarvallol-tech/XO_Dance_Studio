-- Preventa del martes 03/11/2026 (Felipe): pack de 4 a $26.000 y pack de 8 a
-- $45.000, solo para compras hechas hasta el final del martes 3. La clase
-- suelta y el pack de 2 no cambian.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, con
-- aprobación de Felipe en ese mismo mensaje.
--
-- 🔴 DEUDA: es un cambio de precio a mano, exactamente lo que PRD-0012 existe
-- para reemplazar. Se revierte el miércoles 04/11 con
-- `supabase/pendientes/20261104120000_fin_preventa_noviembre.sql`.
--
-- ---------------------------------------------------------------------------
-- Precios de lista, leídos de producción el 03/11/2026 antes de tocar nada
-- ---------------------------------------------------------------------------
--   suelta   1 clase    $8.500    (no cambia)
--   pack-2   2 clases   $16.000   (no cambia)
--   pack-4   4 clases   $28.000   → preventa $26.000
--   pack-8   8 clases   $48.000   → preventa $45.000
--
-- **La lista no se toca.** La preventa va en `precio_promocional`, `promo_hasta`
-- y `promo_nombre`, las columnas provisionales de 20260831130000 que existen
-- justo para esto hasta que llegue PRD-0012. `precio_clp` sigue diciendo
-- $28.000 y $48.000, así que no hay nada que recordar el miércoles: el precio de
-- lista nunca se fue. Y la migración lo comprueba: si la lista no es la que se
-- leyó, aborta en vez de montar la preventa sobre un precio que no es.
--
-- Cómo se comporta:
--   · El sitio tacha el precio de lista y dice hasta cuándo, en Comprar, en el
--     link de cada oferta y en el formulario de transferencia.
--   · `promo_hasta = 2026-11-03` es el último día en que vale, entero, en hora
--     de Santiago (`promoVigente` en lib/dominio/ofertas.ts). Se apaga sola a
--     medianoche del martes; la reversión del miércoles es limpieza.
--   · El precio se fija **al declarar la transferencia** (`declararTransferencia`
--     lo calcula en el servidor y lo guarda en `compras.monto_clp`): cuenta el
--     día de la compra, no el de uso ni el de aprobación (Felipe). Los créditos
--     vencen a los 30 días de acreditados, como siempre.
--   · `promo_nombre` lleva la cantidad de clases porque la oferta se titula con
--     él: dos filas que dijeran solo "Preventa" no se distinguirían en Comprar.

do $$
begin
  if (select precio_clp from public.planes where slug = 'pack-4') is distinct from 28000
     or (select precio_clp from public.planes where slug = 'pack-8') is distinct from 48000 then
    raise exception 'El precio de lista no es el que se leyó (pack-4 $28.000, pack-8 $48.000). No se monta la preventa.';
  end if;

  update public.planes
  set precio_promocional = 26000, promo_hasta = date '2026-11-03',
      promo_nombre = '4 clases en preventa', updated_at = now()
  where slug = 'pack-4';

  update public.planes
  set precio_promocional = 45000, promo_hasta = date '2026-11-03',
      promo_nombre = '8 clases en preventa', updated_at = now()
  where slug = 'pack-8';

  if (select count(*) from public.planes
      where slug in ('pack-4', 'pack-8') and promo_hasta = date '2026-11-03'
        and precio_promocional = case slug when 'pack-4' then 26000 else 45000 end) <> 2 then
    raise exception 'La preventa no quedó en los dos packs.';
  end if;

  -- La suelta y el pack de 2 no tienen nada vigente.
  if exists (select 1 from public.planes
             where slug in ('suelta', 'pack-2') and promo_hasta >= date '2026-11-03') then
    raise exception 'La clase suelta o el pack de 2 tienen una promoción vigente.';
  end if;
end $$;
