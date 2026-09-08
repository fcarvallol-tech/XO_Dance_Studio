# Plan de implementación — PRD-0010 parte 1

> El PRD dice **qué** y **por qué**. Esto dice **en qué orden** y **cómo se sabe que cada paso
> quedó bien**. Se lee junto a `0010-dashboard-owner.md`.
>
> Rama: `prd-0010-metricas-owner`. Nada se mezcla a `main` hasta que pase la fase 6.

---

## El orden no es arbitrario

Los valores esperados se escriben **antes** que el código que los produce, y el código que
divide se prueba **antes** de que exista la consulta que lo alimenta. Si se hace al revés, los
números que el tablero muestre se van a convertir en los números "correctos", y no hay forma de
notarlo con la base en cero.

Por eso la fase 0 ya está hecha: la tabla de §11.4 del PRD es el juez, y está escrita.

---

## Fase 0 — El juez ✅ hecho

Los 22 valores esperados del escenario, calculados a mano, en el PRD §11.4. **Revisables sin
leer una línea de código**, que es el punto.

**Checkpoint:** Felipe revisa §11.4. Si un número está mal, se corrige acá y no después.

---

## Fase 1 — Las funciones puras, con sus tests primero

**Archivos:** `lib/dominio/metricas.ts` · `lib/dominio/metricas.test.ts`

Es la primera vez que el proyecto tiene tests, y `ARCHITECTURE.md` §10 los pide desde agosto
("la lógica de créditos **sí o sí** necesita tests"). Corredor: `node --test`, que Node 24 trae
de fábrica y ejecuta TypeScript sin transpilar. **Cero dependencias nuevas.** Se agrega
`"test": "node --test lib/**/*.test.ts"` a `package.json`.

Qué vive acá: todo lo que divide, compara o redondea.

| Función | Qué resuelve |
|---|---|
| `tasa(parte, total)` | Devuelve `null` si el total es 0, nunca `NaN` ni `0%` |
| `variacion(actual, anterior)` | Devuelve `null` si no hay período anterior, no `+100%` |
| `brecha(otorgadas, consumidas, vencidas)` | Las tres partes de §5.1 |
| `ticketPromedio(ingresos, compras)` | Redondeo a entero CLP |
| `ocupacion(reservas, cupo)` | Sobre 22, excluyendo clases canceladas |
| `atribuir(reserva, lote, compra)` | La regla 7.1 completa, incluido el regalo a $0 |
| `conciliacion(libro, lotes)` | Cuadra o no cuadra |

Los tests usan los números de §11.4: no se inventan casos nuevos, se prueban los del escenario
más los bordes de §10 (denominador cero, empate, período anterior vacío).

**Checkpoint:** `npm test` en verde, con los casos borde cubiertos. Se muestra la salida.

---

## Fase 2 — La migración

**Archivo:** `supabase/migrations/20260907HHMMSS_metricas_owner.sql`

`metricas_resumen` y `metricas_demanda`, según PRD §8.2. Reglas que la migración cumple:

- Agregan y agrupan; **no dividen**. Las tasas son de la fase 1.
- `security definer`, `set search_path = public`, `stable`.
- `tiene_nivel('owner')` adentro, con `42501` si no. No se confía en la ruta (PRD §7.6).
- Grants escritos: `revoke ... from public, anon` **y** `grant execute ... to authenticated,
  service_role`. Nunca heredados del default (PRD-0008 §15).
- Encabezado que dice qué problema resuelve, no solo qué hace.

⚠️ **Escrita y no aplicada.** `db push` necesita tu aprobación en ese mismo mensaje, para
staging y para producción, cada vez. Y antes del primer push a producción hay que correr el
`migration repair` de las 13 migraciones ya aplicadas a mano, según `supabase/README.md`.

**Checkpoint:** ✅ **resuelto en la fase 3.** El `--dry-run` no se pudo correr —necesitaba el
proyecto enlazado y `SUPABASE_DB_PASSWORD`, que no estaban— así que la migración quedó revisada a
mano y sin validar por ningún Postgres. La validó el `db push` contra staging del 08/09: aplicó
sin error a la primera. **La de producción sigue sin aplicarse.**

---

## Fase 3 — Staging y la siembra

**Necesito de ti:** un segundo proyecto Supabase (gratis) y sus tres llaves en `.env.staging`,
que agrego a `.gitignore`.

1. `db push` de las 14 migraciones contra staging. **Con tu aprobación.**
2. `scripts/sembrar-escenario.sql` — las cinco alumnas, nueve compras y cinco clases de §11.4.
   Inserta las filas históricas directamente (el PRD §11.2 explica por qué no puede llamar a
   `acreditar_compra`) y llama a `reservar` y `cancelar_reserva` de verdad para lo del período
   actual.
3. Correr las dos funciones por SQL y contrastar contra §11.4, **antes de que exista la
   interfaz**. Si un agregado no calza, el defecto es del SQL y se ve limpio, sin la UI de por
   medio.

**Checkpoint:** los 22 valores, uno por uno, contra lo que devuelven las funciones. Se muestra
la comparación completa, no un "coincide".

---

## Fase 4 — La interfaz

**Archivos:** `lib/metricas-consultas.ts` · `app/(owner)/owner/metricas/page.tsx` (reemplaza el
placeholder) · componentes de tarjeta.

- Toda consulta devuelve `Lectura<T>`, con `<ErrorDeLectura>` en la tarjeta (PRD §9.1).
- Cada cero con su denominador y la fecha del último dato (PRD §9.2).
- La franja de conciliación arriba del bloque de créditos, roja si no cuadra.
- Las tres tarjetas recortadas de §6 explican, no muestran cero.
- Colores solo desde los tokens `xo-*`. Rosa XO nunca en texto. Mobile-first desde 375px.
  `.claude/rules/estilo.md` se carga solo al editar `.tsx`.

**Checkpoint:** ✅ hecho el 08/09. La página se levantó contra staging en un **worktree
aparte**, para no pisarle el `.next` al `next dev` que Felipe tenía corriendo contra producción.
Se entró con el **enlace de magic link de verdad**, generado por la API de admin: owner recibe
200, admin rebota a `/admin`.

Mirarla encontró cinco defectos que ni el compilador ni el SQL podían ver: `$-55.500` en vez de
`-$55.500`, "1 clases dictadas", "1 transferencias", "1 son de clases" y la hora en "12:53 a. m."
en vez de 00:53. Ninguno rompe un número; los cinco hacen que el tablero se lea como descuidado.

---

## Fase 5 — Probar el artefacto, no la función

La fase que el magic link enseñó a no saltarse. Con el escenario sembrado en staging:

1. Entrar a `/owner/metricas` **con sesión owner real** y contrastar los 22 números en pantalla.
   No basta que la función los devuelva bien: el defecto puede estar en el render.
   ⚠️ **Falta un paso previo.** El escenario está anclado a `now()` con desplazamientos en días,
   así que la ventana de 30 días con la que se verificó en la fase 3 **no coincide con el mes
   calendario** que muestra la página: hoy la página dice $36.500 de ingresos y el escenario
   espera $112.500, y las dos cifras están bien. Para contrastar los 22 valores en pantalla hay
   que anclar la siembra al **mes en curso** en vez de a los últimos 30 días.
2. ✅ Entrar **con sesión admin** y pedir `/owner/metricas` por URL directa → rebota a `/admin`.
3. **Con el token de ese admin**, llamar `/rest/v1/rpc/metricas_resumen` a mano → tiene que
   responder `42501`. Este es el camino que el layout no cubre y donde estaría el agujero real.
4. `GET /rest/v1/` y confirmar que lo único nuevo que expone la API son esas dos funciones.
5. Contar las llamadas a Supabase de la página con un `fetch` instrumentado. **≤ 3.** La
   instrumentación no se commitea.

**Checkpoint:** ✅ hecho el 08/09. Los 22 valores contrastados en pantalla, `anon` 401 / admin
403 / owner 200 por HTTP con JWT reales, admin rebotado por URL directa, y 3 llamadas por render
(13 en total tras 4 renders: 1 JWKS por proceso más 4 × 3). La instrumentación no se commiteó.

---

## Fase 6 — Cierre

1. `npm run build`.
2. PRD §16 con lo que se desvió del plan.
3. Línea en el changelog de `ROADMAP.md`.
4. `ARCHITECTURE.md` §10: las deudas nuevas (sin registro de asistencia, sin proceso de
   expiración, `leads.perfil_id`, `next@16.3.4`).
5. La migración queda **escrita y sin aplicar a producción**, para que la apruebes cuando
   quieras.

`CONTEXT.md` no se toca sin confirmarlo contigo.

---

## Lo que puedo hacer sin ti, y dónde me detengo

| Fases | Estado |
|---|---|
| 1 y 2 | Corren solas. Tests y migración escrita |
| 3 | **Bloqueada** hasta que exista el proyecto de staging y apruebes el `db push` |
| 4 | Puedo escribirla, pero no verificarla, antes de la 3 |
| 5 y 6 | Después de la 3 |

Si prefieres, hago 1 y 2 y paro ahí para que revises antes de que armes staging.

---

## Fuera de este plan, a propósito

- **Partes 2 y 3 del PRD** (egresos, caja neta, liquidación). Necesitan el mapeo de sedes
  confirmado y el variable de las profesoras definido.
- **`next@16.3.4`.** Cambio aparte, con su propia verificación de que el build sigue leyendo el
  catálogo. Ninguna de las 4 vulnerabilidades es alcanzable en producción (PRD §15.1).
- **Refactorizar `lib/compras-consultas.ts`**, aunque ya esté grande. No es de este trabajo.
