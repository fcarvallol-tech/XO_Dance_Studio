-- El costo por hora de las dos salas viejas — PRD-0010 parte 2, cierre.
--
-- NO ejecutar a mano: se aplica con `supabase db push`, primero a staging y a
-- producción solo con aprobación de Felipe en ese mismo mensaje.
--
-- QUÉ PROBLEMA RESUELVE
-- PRD-0021 agregó `sedes.costo_hora_clp` y cargó solo EB Dance Studio
-- ($27.000). Seducción Latina y Diaguitas quedaron en NULL, así que
-- `/owner/finanzas` decía "sin costo cargado" en cada clase de esas sedes y el
-- margen del mes las dejaba fuera. Felipe confirmó los valores el 30/09/2026:
-- son los de CONTEXT.md §5.b.

update public.sedes set costo_hora_clp = v.costo
from (values
  ('seduccion-latina', 17000),
  ('diaguitas', 0)
) as v(slug, costo)
where public.sedes.slug = v.slug;
