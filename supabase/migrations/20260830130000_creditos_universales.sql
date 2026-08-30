-- Créditos universales: un pack sirve para cualquier clase de la parrilla.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`.
--
-- Aclaración de negocio del 30/08/2026: los créditos no están atados a un
-- curso. Alguien compra cuatro clases y las gasta en la misma semana yendo a
-- una de Pau, una de Drimy, una de Lina y una de Carli.

-- ---------------------------------------------------------------------------
-- cursos.formato deja de existir
-- ---------------------------------------------------------------------------
-- La columna existía para una sola cosa: el "intensivo mensual por artista" de
-- los Girly viejos —un artista al mes, cuatro clases, inscripción a un mes
-- concreto—. Ese formato murió con el catálogo nuevo, y los créditos
-- universales lo contradicen de raíz: si una clase se paga con un crédito que
-- sirve para cualquier otra, no hay a qué "inscribirse por un mes".
--
-- Está en null en las siete filas, así que no se pierde nada. Se borra en vez
-- de dejarla comentada como se hizo con `horario`, porque ahí el dato se mudó
-- a otra tabla y acá el concepto simplemente ya no existe: dejarla invita a
-- llenarla, y la UI la renderizaba en un bloque destacado hecho para una
-- promesa que el negocio ya no hace.
--
-- Si algún día hace falta una nota por curso, es un `add column` de una línea.

alter table public.cursos drop column if exists formato;

-- ---------------------------------------------------------------------------
-- Que quede escrito dónde importa
-- ---------------------------------------------------------------------------
-- No hay cambio de esquema en créditos: `creditos` nunca tuvo `curso_id`. El
-- comentario existe para que nadie se lo agregue creyendo que falta.

comment on table public.cursos is
  'Catálogo de cursos. Un curso que sale de la oferta se desactiva, nunca se borra: hay leads que apuntan a su slug. Los créditos NO se asocian a un curso: ver comment de public.horarios.';

comment on table public.horarios is
  'Cuándo y dónde se dicta cada curso. Reemplaza a cursos.horario y a cursos_profesoras. Una reserva se hace contra un horario, no contra un curso: los créditos son universales y sirven para cualquier clase de la parrilla.';
