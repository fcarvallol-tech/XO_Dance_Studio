-- PRD-0021 §8.4 corregido — la profesora ve las clases que dicta, publicadas o no.
--
-- NO ejecutar a mano: se aplica con `supabase db push`, primero a staging y a
-- producción solo con aprobación.
--
-- ---------------------------------------------------------------------------
-- Qué estaba mal, y cómo se supo
-- ---------------------------------------------------------------------------
-- PRD-0018 y PRD-0021 §8.4 afirmaban que una clase especial sin publicar
-- **"sí aparece en la grilla de la profesora, que no filtra por publicada"**.
-- Es falso: la consulta no filtra, pero **RLS sí**.
--
-- `clases` tenía dos políticas de select y ninguna cubre este caso:
--
--   clases_lectura_publica  (anon, authenticated) : parrilla o publicada
--   clases_admin_todo       (authenticated)       : tiene_nivel('admin')
--
-- Una profesora no es admin, así que lo único que la cubría era la primera, que
-- pide `publicada_at is not null`. Verificado con su sesión el 26/09/2026: la
-- base tenía **2** clases suyas y ella veía **0**.
--
-- Consecuencia concreta: cargar el intensivo de septiembre no le servía de nada
-- a Carli. La trazabilidad quedaba solo para admin, que es justo lo contrario de
-- lo que se buscaba al registrarlo.
--
-- **Cómo se supo, que es la parte que importa:** abriendo la pantalla y después
-- consultando con `set local role authenticated` y las claims de una profesora.
-- Leer la consulta no alcanzaba —no filtra nada— y es la tercera vez en este
-- repo que las políticas se comportan distinto de lo que parecía al leerlas.
--
-- ---------------------------------------------------------------------------
-- Por qué una política nueva es segura acá
-- ---------------------------------------------------------------------------
-- `CLAUDE.md` advierte que **las políticas permisivas se combinan con OR: agregar
-- una nunca restringe**, y que una política nueva *suma* un camino de acceso. Eso
-- es exactamente lo que se quiere en este caso, y hay que decir por qué no es un
-- problema:
--
--   · Lo que suma es acceso **solo a las filas donde ella es la profesora**:
--     `profesora_id = public.mi_profesora_id()`. No abre la tabla.
--   · `mi_profesora_id()` resuelve la identidad en la base con la sesión de quien
--     pregunta, y es `security definer` —ya existe desde PRD-0008—, así que no se
--     puede falsear pasando otro id.
--   · A alguien sin sesión, o con sesión y sin ser profesora, devuelve `null` y la
--     comparación no deja pasar nada.
--
-- Lo que **no** cambia: las inscritas siguen protegidas por `reservas_de_mis_clases`
-- e `inscritas_de_clase`, que son las que deciden quién puede ver a quién. Esta
-- política habla de la clase, no de quién está en ella.

drop policy if exists clases_profesora_ve_las_suyas on public.clases;
create policy clases_profesora_ve_las_suyas on public.clases
  for select to authenticated
  using (profesora_id = public.mi_profesora_id());

comment on policy clases_profesora_ve_las_suyas on public.clases is
  'La profesora ve las clases que dicta, publicadas o no: si no, una especial cargada como registro histórico no le sirve de nada a ella y la trazabilidad queda solo para admin. Suma acceso únicamente a sus propias filas (PRD-0021 §8.4).';
