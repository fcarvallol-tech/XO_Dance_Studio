-- La grilla semanal necesita ver las clases canceladas.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`.
--
-- `clases_lectura_publica` exponía solo `estado = 'programada'`, así que una
-- clase cancelada **desaparecía** del calendario en vez de mostrarse tachada.
-- Eso es peor que mostrarla:
--
--   · Para la alumna que ya reservó, la clase se esfuma sin explicación.
--   · Para la profesora que va a pedir un horario, un bloque cancelado es
--     justamente la información que busca: esa sala está libre a esa hora.
--
-- El estado de una clase no es dato sensible —la parrilla ya es pública— así
-- que se expone completa y **la interfaz decide qué mostrar**, que es donde esa
-- decisión pertenece.
--
-- ⚠️ Esto amplía lo que ve `anon`, y eso se decide, no se deja pasar: lo que se
-- agrega es "esta clase de la parrilla pública está cancelada". No hay nada de
-- nadie ahí. Las inscritas siguen protegidas por `inscritas_de_clase` y el
-- conteo por `reservas_de_mis_clases`, y ninguna de las dos se toca acá.

drop policy if exists clases_lectura_publica on public.clases;
create policy clases_lectura_publica on public.clases
  for select to anon, authenticated
  using (true);

comment on table public.clases is
  $c$Las clases son PÚBLICAS por diseño, canceladas incluidas: la parrilla completa se ve sin
cuenta y las alumnas la necesitan para reservar. Ocultar las canceladas las hacía desaparecer del
calendario en vez de mostrarlas tachadas. Filtrar por profesora o por estado es cosa de la
consulta, no de RLS. Lo que sí protege la base es quién está inscrito: ver inscritas_de_clase.$c$;
