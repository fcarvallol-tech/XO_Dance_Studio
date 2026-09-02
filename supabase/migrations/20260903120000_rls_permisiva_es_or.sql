-- Arreglo de dos políticas escritas sobre un error conceptual.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`.
--
-- **Las políticas permisivas de Postgres se combinan con OR.** Agregar una
-- nunca restringe: suma un camino de acceso al que ya existía. Escribí dos
-- políticas creyendo lo contrario, y las dos abrieron más de lo que pretendían
-- cerrar.

-- ---------------------------------------------------------------------------
-- 1. parametros: los datos bancarios estaban expuestos a cualquiera
-- ---------------------------------------------------------------------------
-- `parametros_lectura` decía `for select to anon, authenticated using (true)`.
-- Con la llave publishable —que viaja en el bundle del navegador, o sea que es
-- pública de hecho— cualquiera podía leer la tabla entera, y ahí viven los
-- datos de transferencia:
--
--   transferencia_titular · nombre completo de una persona
--   transferencia_rut     · su RUT
--   transferencia_numero  · su número de cuenta
--   transferencia_correo  · su correo personal
--
-- No es la cuenta de la SpA: es la cuenta personal de Carla. Nombre y RUT de
-- una persona identificada son datos personales bajo la Ley 19.628, y estaban
-- legibles sin cuenta.
--
-- Se corta el acceso de `anon`. No rompe nada: ninguna página pública lee
-- parámetros. `/comprar` y `/reservar` los leen con la sesión de quien mira.

revoke all on public.parametros from anon;

drop policy if exists parametros_lectura on public.parametros;

-- Con sesión sí: quien va a transferir necesita ver a dónde.
drop policy if exists parametros_con_sesion on public.parametros;
create policy parametros_con_sesion on public.parametros
  for select to authenticated
  using (true);

comment on table public.parametros is
  $c$NO dar acceso de lectura a `anon`, y no es una preferencia: acá viven los datos de
transferencia —nombre completo, RUT, número de cuenta y correo de una persona— que son datos
personales bajo la Ley 19.628. La llave publishable viaja en el bundle del navegador, así que
`to anon` equivale a publicarlos. Estuvieron legibles sin sesión entre el 31/08 y el 03/09/2026.
Si alguien necesita un parámetro en una página pública, la respuesta no es reabrir la tabla: es
leerlo en el servidor o pasar solo esa clave. Ver PRD-0008 §13.$c$;

-- ---------------------------------------------------------------------------
-- 1.b La función dejaba la puerta abierta igual
-- ---------------------------------------------------------------------------
-- Revocar la tabla no alcanzaba. `parametros_como_json` es **security definer**
-- —salta RLS— y tenía `grant execute to anon`, así que cualquiera sin sesión
-- podía pedir `POST /rest/v1/rpc/parametros_como_json` y recibir los diez
-- parámetros, RUT y número de cuenta incluidos. Verificado antes de escribir
-- esto: devolvía todo.
--
-- Es el mismo error de fondo que las políticas permisivas: cerrar un camino no
-- sirve si queda otro abierto. **Una tabla protegida y una función definer que
-- la expone es una tabla desprotegida.**
--
-- Nadie la llama desde el código. Se le revoca a `anon` en vez de borrarla,
-- porque con sesión sigue siendo útil para leer varios parámetros de una.

revoke execute on function public.parametros_como_json() from public, anon;

-- Y de paso el resto de las funciones que `anon` podía ejecutar sin
-- necesitarlas. Ninguna página pública llama una RPC: la landing lee tablas, y
-- los leads se guardan desde el servidor con la service role key.
--
-- Verificado que ninguna política `to anon` llama funciones —todas comparan
-- columnas— así que revocar no rompe la lectura pública del catálogo.

revoke execute on function public.parametro_int(text, int) from public, anon;
revoke execute on function public.mi_rol() from public, anon;
revoke execute on function public.mi_profesora_id() from public, anon;
revoke execute on function public.tiene_nivel(text) from public, anon;
revoke execute on function public.dicta_la_clase(uuid) from public, anon;
revoke execute on function public.conflictos_de_solicitud(uuid) from public, anon;
revoke execute on function public.normalizar_nombre(text) from public, anon;
revoke execute on function public.nivel_rol(text) from public, anon;

-- ---------------------------------------------------------------------------
-- 2. clases: la política de profesora no restringía nada
-- ---------------------------------------------------------------------------
-- `clases_de_la_profesora` se agregó creyendo que limitaba a la profesora a
-- ver las suyas. No hacía nada: `clases_lectura_publica` ya expone todas las
-- clases programadas a `anon` y `authenticated`, y las permisivas se suman.
-- Verificado con una sesión real: veía las 73, no sus 10.
--
-- **Y no se puede arreglar restringiendo, porque `clases` es pública a
-- propósito.** Las alumnas necesitan ver la parrilla completa para reservar, y
-- una profesora que además toma clases —caso borde de PRD-0008 §5— también.
-- Una política que la limitara a sus clases le rompería `/reservar`.
--
-- Entonces la conclusión honesta es que **"solo sus clases" en el portal de la
-- profesora es presentación, no seguridad**. La restricción de seguridad de
-- PRD-0008 es sobre las **inscritas**, y esa sí vive en la base:
-- `inscritas_de_clase` verifica `dicta_la_clase` y rechaza con 42501. Eso se
-- probó con sesión real y funciona.
--
-- Se borra la política en vez de dejarla: una que no hace nada es peor que
-- ninguna, porque la próxima persona que lea el esquema va a creer que la
-- protección existe.

drop policy if exists clases_de_la_profesora on public.clases;

comment on table public.clases is
  'Las clases son PÚBLICAS por diseño: la parrilla completa se ve sin cuenta, y las alumnas la necesitan para reservar. Filtrar por profesora es cosa de la consulta, no de RLS. Lo que sí protege la base es quién está inscrito: ver inscritas_de_clase.';

-- ---------------------------------------------------------------------------
-- 3. Lo que se revisó y está bien
-- ---------------------------------------------------------------------------
-- Auditadas las quince tablas con tres identidades —service_role, anon y una
-- sesión de profesora real—, buscando el mismo error en las políticas de
-- PRD-0004, PRD-0015, PRD-0016 y PRD-0017:
--
--   perfiles, cambios_rol, leads, compras, creditos, movimientos_credito,
--   reservas, solicitudes_horario
--     · sin política pública debajo. `anon` recibe 42501 y la profesora solo
--       ve lo suyo. Verificado: `perfiles` le devuelve 1 fila, la suya.
--
--   cursos, profesoras, sedes, horarios, planes
--     · tienen lectura pública de lo activo **más** una de admin que ve todo.
--       Acá el OR es exactamente lo que se quiere: admin ve lo público más lo
--       inactivo. Verificado: 8 cursos en total, 4 visibles sin sesión.
--
-- El error estaba solo en las dos de arriba.

-- ---------------------------------------------------------------------------
-- 4. Lo que reemplaza a la política borrada
-- ---------------------------------------------------------------------------
-- `mi_profesora_id()` ya existe y está concedida a `authenticated`: la consulta
-- del portal filtra con ella. Es defensa en profundidad de verdad —dos capas
-- que hacen algo— en vez de una capa que hacía algo y otra que solo lo parecía.

comment on function public.mi_profesora_id() is
  'A qué profesora del catálogo corresponde quien está preguntando. La usa la consulta del portal para filtrar sus clases: RLS no puede hacerlo porque clases es pública.';
