# PRD-0025 — Filtrar el listado de personas

| Campo | Valor |
|---|---|
| **Estado** | ✅ **Aprobado por Felipe el 05/11/2026 tal como estaba escrito. Implementado en la rama `prd-0025-filtrar-personas`, sin publicar.** Falta la prueba desde la página con sesión, que esta noche no se pudo hacer sin escribir en una base remota (§12) |
| **Autor** | Claude, a pedido de Felipe Carvallo |
| **Fecha** | 4 de noviembre de 2026 |
| **Hito** | Hito 4 — Portales (administración) |
| **PRDs relacionados** | PRD-0023 (Personas, saldos y regalos) · PRD-0024 (revocar créditos) · ROADMAP, "Pedidos de Felipe mientras usa el sitio", pedidos 2, 3 y 6 |

---

## 1. Problema

Felipe busca a mano, **todos los días**, en el listado de **Personas** (`/admin`), que ya es grande.
Lo necesita para regalar, y desde PRD-0024 también para quitar.

Leyendo el código apareció algo peor que la incomodidad: **la página trae como máximo 200
personas**, las más recientes (`.limit(200)` en `app/(admin)/admin/page.tsx`). Si hay más de 200,
**las demás no aparecen en la lista**, y buscarlas a mano no las va a encontrar. Falta medir cuántas
hay hoy en producción.

## 2. Usuario y contexto de uso

Admin y owner, desde el computador o el teléfono, con una alumna escribiéndole por WhatsApp. Sabe
el nombre o el correo, o una parte. Quiere encontrarla en segundos.

## 3. Alcance

1. **Un campo de búsqueda** arriba de Personas: busca por **nombre o correo**, parte de la palabra,
   sin importar mayúsculas. **Las tildes sí importan por ahora** ("maria" no encuentra a "María"):
   es la propuesta de §8.6.a, aprobada con el resto. Este punto decía lo contrario y contradecía a
   §7; se corrigió al implementar.
2. **El filtro corre en el servidor**, en la consulta a la base, no en el navegador: la lista va a
   seguir creciendo (`CLAUDE.md`: "el recorte va en la consulta, no en memoria").
3. **La búsqueda vive en la URL** (`/admin?q=maria`): se puede recargar, volver atrás y compartir
   entre Felipe y Carla. Funciona con el formulario nativo, sin JavaScript.
4. **Los saldos y lo demás de la fila se leen solo para las personas que se muestran**, no para
   todas.
5. **El total se dice siempre**, con o sin búsqueda ("74 personas registradas."), y **si la lista
   llegó al tope, un aviso aparte** con cuántas no aparecen. Nunca más una lista cortada en
   silencio. Felipe, 05/11: *"el techo de 200 es más importante que la búsqueda"*.
   - **Hoy el aviso es prevención, no un hueco que se esté manifestando.** Son **74 alumnas**
     (Felipe, 05/11/2026): el tope de 200 no esconde a nadie y el aviso no se va a ver hasta que
     haya más de 200 personas.

## 4. Fuera de alcance

- **La ficha de cada persona con sus reservas** (pedido 3) y **ver las inscritas de una clase**
  (pedido 1). Son el mismo hueco —administración no ve reservas en ninguna parte— y van en su
  propio PRD. Este solo encuentra a la persona.
- Filtros por rol, por saldo o por fecha. Si hacen falta, se agregan sobre lo mismo.
- Paginación. Con búsqueda, 200 resultados alcanzan de sobra.
- Buscar por RUT o teléfono.

## 5. Flujo principal

1. Felipe entra a Personas y escribe "cami" en el buscador. Aprieta Enter o **Buscar**.
2. La página vuelve con `?q=cami` y muestra solo las personas cuyo nombre o correo contiene "cami".
3. En cada fila, lo de siempre: rol, profesora, saldo, **Regalar** y, para el owner, **Quitar**.
4. **Limpiar** vuelve a la lista completa.

## 6. Casos borde y errores

| Caso | Qué pasa |
|---|---|
| Sin resultados | "Nadie con «cami» en el nombre ni en el correo", con el enlace para limpiar |
| Búsqueda con `%`, `_`, `,`, `"`, `\` o paréntesis | Se escapan: se buscan como texto, no como comodín ni como sintaxis de filtro de PostgREST |
| Búsqueda con `*` | **Se saca**: PostgREST lo convierte en `%` antes de llegar a Postgres y no hay forma de escaparlo. Ningún nombre ni correo lo necesita |
| Búsqueda de 1 carácter | Se permite; con el tope de 200 no hay riesgo |
| Espacios al principio o al final | Se recortan |
| Búsqueda muy larga | Se corta a 100 caracteres |
| Tildes y mayúsculas | Mayúsculas no importan. Tildes sí: "maria" **no** encuentra "María" (§8.6.a) |
| Personas borradas (`deleted_at`) | No aparecen, igual que hoy |

## 7. Modelo de datos

**Sin tablas nuevas.** Dos opciones para que "maria" encuentre "María":

- **`ilike` sobre `nombre` y `email`** desde la consulta de siempre: sin migración. Ignora
  mayúsculas pero **no tildes**.
- **Una función `buscar_personas(q)`** con `unaccent`, que ignora las dos cosas: necesita la
  extensión y una migración, y tiene que respetar el mismo RLS que la tabla (`security invoker`).

**Propuesta: empezar con `ilike`**, que se puede publicar hoy sin tocar la base, y pasar a
`unaccent` solo si las tildes molestan en la práctica. Ver §8.6.

**RLS**: no cambia. La consulta sigue con la sesión de quien mira, y `perfiles_admin_lee_todos`
sigue siendo lo que decide qué ve. Se pregunta con la sesión de admin, owner y alumna en staging
que el filtro no abra nada: una alumna en `/admin` sigue sin entrar.

## 8. Reglas de negocio

1. El filtro va en la consulta, nunca en memoria.
2. Lo que entra por `q` es texto del usuario: se escapa antes de armar el filtro.
3. Ninguna lista se corta en silencio: si hay tope, se dice.

### 8.6 Decisiones que faltan (Felipe)

| # | Pregunta | Propuesta |
|---|---|---|
| a | ¿Que ignore las tildes desde el primer día? | ✅ **Decidido (05/11): no todavía.** `ilike` hoy, sin migración; `unaccent` si molesta |

## 9. Criterios de aceptación

- [ ] `/admin?q=…` devuelve solo coincidencias por nombre o correo, sin importar mayúsculas.
      *Código listo; falta probarlo desde la página.*
- [x] **La consulta a `perfiles` lleva el filtro** (`.or()` sobre la consulta, no en memoria) y los
      saldos se piden solo para esas personas cuando hay búsqueda. *Leído en el código; contar las
      filas que vuelven de Supabase queda para la prueba con sesión.*
- [x] `%`, `_`, `,`, `"`, `\` y paréntesis no actúan como comodín ni como sintaxis: 11 tests en
      `lib/busqueda-personas.test.ts`, y el patrón probado contra un Postgres real (PGlite).
      ⚠️ Lo que **no** está probado es el lado de PostgREST: que lea `\"` y `\\` dentro de comillas
      como dice su documentación. Se prueba con sesión buscando `o"x`.
- [ ] La página dice el total siempre, y avisa cuando la lista llegó al tope. *Código listo.*
- [ ] Funciona sin JavaScript, a 375 px y en escritorio, y **probado desde la página** escribiendo
      en el campo, no llamando a la consulta.
- [ ] Una alumna sigue sin poder entrar a `/admin`, con o sin `q`.

## 10. Métrica de éxito

Que Felipe encuentre a cualquier persona en Personas escribiendo, sin recorrer la lista.

## 11. Riesgos y supuestos

- **Supuesto**: hoy hay menos de 200 personas, o pocas más. Hay que medirlo antes de dar por
  bueno que nadie se perdió.
- Un `ilike` con comodín al principio no usa índice. Con cientos o pocos miles de filas no se
  nota; si pasa a ser lento, se agrega un índice trigram.

## 12. Notas de implementación

**05/11/2026, rama `prd-0025-filtrar-personas`.** Sin migración.

- `lib/busqueda-personas.ts`: `normalizarBusqueda` (recorta, corta a 100, saca `*`, vale el
  primer `?q=` si viene repetido), `patronLike` (escapa `\`, `%`, `_`) y `filtroDePersonas`
  (las dos condiciones, cada valor entre comillas con `\` y `"` escapados). Con tests.
- `app/(admin)/admin/page.tsx`: formulario `GET` nativo con `Buscar` y `Limpiar`; la consulta pide
  `count: "exact"`, que trae en la **misma respuesta** cuántas coinciden en total más allá del
  tope, así que no suma una llamada.
- `getSaldosVigentes(perfilIds?)`: con búsqueda, lee solo los lotes de quienes aparecieron
  (secuencial, después de la consulta de perfiles). **Sin búsqueda sigue leyendo todos**, en
  paralelo: la lista ya muestra a casi todas, y 200 uuid en un `in=(…)` son más de 7 KB de URL.
  Es una lectura de lotes vigentes, no de personas.

**Medido en producción el 05/11/2026 a la 01:31, solo lectura:** **74 alumnas** activas
(`rol = 'alumna' and deleted_at is null`). El tope de 200 todavía no dejaba a nadie afuera.

**Lo que falta, y por qué:** probarlo desde la página con una sesión de admin. Esa noche la regla
era no escribir en ninguna base remota, y entrar a staging crea una sesión en `auth`. Se hace al
publicar: buscar `cami`, `CAMI`, `o"x`, `50%` y una cadena sin resultados, y abrir `/admin` con una
alumna para comprobar que sigue sin entrar.
