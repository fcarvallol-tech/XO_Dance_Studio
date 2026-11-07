# Informe de la noche del 05/11/2026

> Escrito mientras avanzaba, no al final. Empecé a la 01:30 (hora de Chile).
> Nada de esta noche tocó una base remota salvo **una** lectura autorizada (el conteo de alumnas).
> Nada se mergeó a `main`. Ninguna migración se aplicó, ni en producción ni en staging.

## Antes que nada: tres cosas que tienes que saber

1. **Las secciones de CONTEXT.md que me pediste leer no están en `main`.** "Incentivo por promedio
   — regla del 04/11/2026, en dos tramos" y "Las cinco decisiones que destraban la liquidación"
   viven solo en la rama `origin/pedidos-de-uso` (commits `3510721` y `0e3f2a6`), que **contiene a
   `main` entero** y le suma solo documentación (CONTEXT.md y la lista de pedidos del ROADMAP). Las
   leí de ahí, como pediste. No edité CONTEXT.md. **Mergear `pedidos-de-uso` a `main` no tiene
   conflictos**, y conviene hacerlo antes que el bloque 4, para que el PRD no cite una regla que en
   `main` todavía no existe.
2. **Cada bloque está en su rama, todas salen de `main` (`774aa79`) y todas están pusheadas.** Los
   cuatro se pueden tomar por separado. Juntos hay **un solo conflicto**, entre los bloques 1 y 3,
   en `app/(admin)/admin/page.tsx`, y es fácil de resolver: ver "Cruces entre ramas".
3. **Alumnas en producción: 74.** El tope de 200 todavía no deja a nadie afuera.

| Bloque | Rama | Estado | Migración |
|---|---|---|---|
| 1 · Filtrar Personas (PRD-0025) | `prd-0025-filtrar-personas` | ✅ Listo para publicar solo | Ninguna |
| 2 · Pack de amigas (PRD-0026) | `prd-0026-pack-de-amigas` | ✅ Hecho · escenario 33/33 | `20261105120000_pack_de_amigas.sql`, sin aplicar |
| 3 · Revocar créditos (PRD-0024) | `prd-0024-revocar-creditos` | ✅ Hecho · escenario 20/20 | `20261105130000_revocar_creditos.sql`, sin aplicar |
| 4 · Liquidación (PRD-0010 p. 3) | `prd-0010-parte-3-liquidacion` | ✅ A–D · 43 tests · escenario 29/29 · ⏸ E sin empezar | `20261105140000_liquidacion_profesoras.sql`, sin aplicar |

En todas las ramas `npm test` y `npm run build` pasan. Ninguna quedó roja.

**Lo primero que te pido revisar** es la lectura que hice de "cancelar temprano ahorra el sueldo"
(bloque 4, y la lista "Decisiones mías para revisar" al final).

---

## Cómo probé esta noche sin tocar ninguna base remota

No hay Docker ni Postgres en este computador, y staging estaba prohibido. Armé una **base local en
PGlite** (Postgres 16 real, compilado a WebAssembly, instalado en el scratchpad, **no en el repo**):
crea los roles `anon`/`authenticated`/`service_role`, un `auth.users` y `auth.uid()` de mentira, y
aplica **todas las migraciones de `supabase/migrations/` en orden**. Tarda 2,5 segundos. Solo se
salta `20261103210000_clase_pau_3_nov_no_dictada.sql`, que busca una clase real que una base vacía
no tiene.

Con eso los escenarios de los bloques 2, 3 y 4 corrieron **contra las funciones de verdad**, con
`set role authenticated` y las claims de cada persona, como pide CLAUDE.md. Lo que **no** reemplaza:
PostgREST, Supabase Auth y la cola de correos real. Eso queda para staging, con tu aprobación.

---

## Bloque 1 — PRD-0025, filtrar Personas ✅ listo para publicar solo

- **Rama:** `prd-0025-filtrar-personas` · **commit `4236074`** · pusheada.
- **Sin migración.** No toca la base: se puede publicar mergeando esa rama sola.
- **Alumnas en producción: 74** (`select count(*) from perfiles where rol = 'alumna' and
  deleted_at is null`, solo lectura, 05/11 01:31). **El tope de 200 todavía no deja a nadie
  afuera.** Fue la única consulta a producción de la noche.
- **Qué hace:**
  - Un buscador por nombre o correo en `/admin`, con formulario nativo. La búsqueda queda en la URL
    (`?q=`) y funciona sin JavaScript.
  - El filtro va en la consulta y el total llega en la misma respuesta (`count: "exact"`), así que
    no suma una llamada.
  - **El total se muestra siempre** ("74 personas registradas.").
  - **Si la lista llega al tope**, aparece un aviso aparte que dice cuántas no se ven.
  - Con búsqueda, los saldos se leen solo de las personas que aparecen.
- **Tests:** 11 nuevos (escapes de LIKE y de PostgREST, intento de inyectar otra condición). Los
  232 del repo pasan, y `npm run build` también.
- **Decisiones mías:**
  - **El total cuenta a todas las personas, no solo a las alumnas**, porque la lista muestra todos
    los roles. Por eso puede decir un número mayor que 74.
  - **El `*` se saca de la búsqueda:** PostgREST lo convierte en comodín y no hay forma de
    escaparlo.
  - **Sin búsqueda, los saldos se siguen leyendo todos de una vez.** Pasar 200 ids en la URL son
    más de 7 KB.
  - **Corregí una contradicción de mi propio PRD.** El §3 decía "sin importar tildes" y el §8.6.a
    proponía no hacerlo todavía. Quedó lo del §8.6.a: "maria" **no** encuentra "María". Si molesta,
    se agrega `unaccent`, y eso sí lleva migración.
- **Qué falta:** probarlo **desde la página con sesión de admin**. No se pudo hacer sin crear una
  sesión en una base remota. Al publicar, buscar:
  - `cami`, `CAMI`, `o"x`, `50%` y algo que no exista;
  - y abrir `/admin` con una alumna, para confirmar que no entra.

  Lo que no está probado es que PostgREST lea bien `\"` dentro de comillas. Así lo dice su
  documentación, pero no lo pude comprobar.

---

## Bloque 2 — PRD-0026, pack de amigas ✅ hecho, migración sin aplicar

- **Rama:** `prd-0026-pack-de-amigas` · commits `db0df49` (el bloque) y `11defd4` (arreglo del arnés de prueba, ver abajo) · pusheada.
- **PRD:** `context/prds/0026-pack-de-amigas.md`, con tus once decisiones tal cual. Las que tomé yo
  están en su §8.6.
- **Migración:** `20261105120000_pack_de_amigas.sql`. **No está aplicada.**
- **`--dry-run` contra producción** (enlacé el CLI a producción solo para eso y lo devolví a
  staging):

  ```
  Would push these migrations:
   • 20261105120000_pack_de_amigas.sql
  {"upToDate":false,"dryRun":true,"migrations":["20261105120000_pack_de_amigas.sql"],...}
  ```

- **Escenario en la base local: 33 de 33 pasos.** Lo puedes correr tú con
  `node scripts/base-local/escenario-pack-amigas.mjs`. Comprueba:
  - El plan quedó como lo pediste y anon lo ve.
  - **Búsqueda de la amiga:** el propio correo se rechaza; un correo sin cuenta da no; uno con cuenta
    da sí, sin importar mayúsculas.
  - **El límite:** la 6.ª consulta en una hora y la 11.ª en el día se rechazan.
  - **Atajos cerrados:** declarar el plan por la API sin la función se rechaza, y nombrar a la amiga
    en un insert directo no tiene permiso.
  - **Aprobar:** crea dos lotes con el mismo `compra_id` y una clase cada uno, con el mismo
    vencimiento a 30 días, y dos movimientos `compra`. Aprobar dos veces no duplica nada, y el libro
    cuadra con los lotes.
  - **Qué ve cada una:** Bea ve su lote y no la compra; Ana no ve el lote de Bea; otra alumna no ve
    nada.
  - **Rechazar y anular:** rechazar antes de aprobar no deja lotes; anular una compra con clases
    vivas se rechaza.
  - **Pack normal:** el de 2 clases sigue igual.
- **`metricas_resumen` no cambia, y cuenta bien.** Con sesión de owner devolvió
  `{"venta":{"compras":1,"ingresos":16000},"creditos":{"vendidas":2,"regaladas":0},"conciliacion":{"libro":2,"lotes":2}}`.
  Una compra, no dos.
- **`npm test` (223) y `npm run build` pasan.**
- **Decisiones mías:**
  - **Nombre "Pack de amigas"**, que es como ya circula la promo. Va al final de la vitrina.
  - **Límite: 5 consultas por hora y 10 por día**, por cuenta compradora. Quedan en `parametros`, así
    que se cambian sin migración. Cuentan todas las consultas, y declarar también cuenta, porque el
    servidor vuelve a buscar a la amiga. Si no contara, declarar serviría para preguntar sin límite.
    **El correo consultado no se guarda**: solo quién preguntó, cuándo y si había cuenta.
  - **Los datos para transferir no aparecen hasta que el servidor confirma a la amiga.** Tu punto 3
    decía "Continuar". En este flujo, la gente transfiere *antes* de apretar "Ya transferí", así que
    validar recién ahí habría sido justo la trampa que querías evitar.
  - **Anular (`deleted_at`) una compra que todavía tiene clases vigentes sin usar se rechaza**, en
    cualquier compra y no solo en este pack. Hoy anular a mano en el Table Editor deja las clases
    vivas y reservables. Para anular, primero se quitan con PRD-0024 y después se marca. Así no
    existe "uno sí y otro no".
  - **El correo a la amiga lleva el nombre de pila de quien compró**, escapado como HTML. El de quien
    compró dice "la otra clase quedó en la cuenta de tu amiga", sin su nombre.
  - **El link de PRD-0020 funciona sin excluirlo:** `/comprar/pack-amigas` es una oferta como
    cualquier otra.
- **Orden para publicar: primero la migración, después el código.**
  - Si el código sale antes, `/comprar` no se cae (lo dejé tolerante a la columna faltante), **pero
    la bandeja de compras sí falla**.
  - En el build de esta rama, `/comprar` se generó contra staging sin la columna, y pasó por esa
    tolerancia.
- **Qué falta:** probarlo desde la página en staging. Hay que comprar con un correo sin cuenta y con
  uno con cuenta, aprobar, ver que lleguen los dos correos y reservar con la clase de la amiga. Para
  eso la migración tiene que estar en staging, que va tres migraciones atrás.
- **Hallazgo de paso, sin arreglar:** las plantillas de correo de antes ponen el nombre de la propia
  destinataria sin escapar HTML. El riesgo es mínimo, pero queda anotado en el PRD-0026 §11.

---

## Bloque 3 — PRD-0024, revocar créditos ✅ hecho, migración sin aplicar

- **Rama:** `prd-0024-revocar-creditos` · commits `a420f2a` (el bloque) y `3291cb8` (arreglo del arnés de prueba) · pusheada.
- **PRD:** `context/prds/0024-revocar-creditos.md`, con el §8.6 como lo decidiste.
  - "Fue a clase y no reservó" quedó **fuera**, como pieza aparte: inscribir a una alumna en una
    clase pasada. **No la empecé.**
  - El diálogo de Quitar avisa que para ese caso no corresponde.
- **Migración:** `20261105130000_revocar_creditos.sql`. **No está aplicada.**
- **`--dry-run` contra producción:**

  ```
  Would push these migrations:
   • 20261105130000_revocar_creditos.sql
  {"upToDate":false,"dryRun":true,"migrations":["20261105130000_revocar_creditos.sql"],...}
  ```

- **El escenario que pediste, en la base local: 20 de 20**
  (`node scripts/base-local/escenario-revocar.mjs`). Ana parte con un lote vencido de 1, uno de 2
  que vence en 10 días y uno de 3 que vence en 20.
  - **Saldo de sobra (quitar 3 de 5):**
    - el lote de 10 días baja de 2 a 0 y el de 20 días baja de 3 a 2;
    - el vencido no se toca;
    - quedan dos movimientos, −2 y −1, con motivo y autor;
    - el saldo queda en 2.
  - **Exactamente lo que hay (quitar 2 de 2):** queda en 0 y ningún lote negativo.
  - **De más:** con saldo 0 se piden 1, y a Bea, que tiene 2, se le piden 3. Las dos se rechazan
    **sin cambiar nada**: comparé lotes y libro antes y después.
  - **En los tres casos:** libro = lotes, y el último `saldo_resultante` es igual a
    `saldo_creditos()`.
  - **Candado:** la misma revocación enseguida se rechaza.
  - **Permisos, con la sesión de cada rol:**
    - nadie con sesión llama la función directo;
    - admin y alumna son rechazados adentro aunque pasen su propio `user_id`;
    - `revocaciones_recientes` solo la lee el owner;
    - la alumna ve el movimiento, pero no el motivo.
- **Tablero:** `revocadas` es una línea propia, en el período, el anterior y desde siempre.
  - En `/owner/metricas` aparece como **"Quitadas este mes"**.
  - Vendidas, regaladas y consumidas quedan iguales; el escenario lo mide antes y después:

  ```
  antes:   {"vendidas":2,"regaladas":6,"revocadas":0,"vigentes_regaladas":7,"conciliacion":{"libro":8,"lotes":8}}
  después: {"vendidas":2,"regaladas":6,"revocadas":5,"vigentes_regaladas":2,"conciliacion":{"libro":3,"lotes":3}}
  ```

- **`npm test` (221) y `npm run build` pasan.**
- **Decisiones mías:**
  - **La tasa de utilización descuenta lo revocado.** La calculo sobre otorgadas menos revocadas:
    una clase quitada ya no se puede tomar, y si siguiera en el denominador la tasa bajaría sin que
    nadie haya dejado de venir.
  - **Un `check` nuevo en el libro:** una revocación siempre es negativa y siempre lleva motivo,
    autor y lote, también si alguien la escribe a mano.
  - **La lista "Clases quitadas recientes" muestra una fila por revocación**, no una por lote.
  - **El botón Quitar no aparece si la persona no tiene saldo vigente.**
- **Qué falta:**
  - Probar la **concurrencia con `reservar()`** con dos conexiones. La base local tiene una sola.
  - Probarlo desde la pantalla. Las dos cosas van en staging, con la migración.

---

## Bloque 4 — PRD-0010 parte 3, liquidación ✅ A–D hechos · E no empezado

**Rama:** `prd-0010-parte-3-liquidacion`. Un commit por paso.

**Las respuestas salieron de `CONTEXT.md` en `origin/pedidos-de-uso`**, como pediste, no del PRD
viejo.

### Paso A ✅ — §13 contestado · commit `03a30ed`

- **Las siete preguntas, con lo que dice CONTEXT.** Se agrega el §6.5 (incentivo) y el §6.6
  (causas y recuperación).
- **La pregunta 4 no tiene respuesta en CONTEXT** ("pasa al mes siguiente": ¿por profesora o por
  mes?). Tomé la propuesta del PRD: la página muestra el mes más antiguo con algo pendiente y avanza
  cuando se paga la última. Es pantalla, no modelo.
- **Sumé la pregunta 8:** ¿se promedia con 3 cuando no se dictaron por decisión de la academia?
  CONTEXT dice que el PRD lo pregunte antes de implementarlo, así que **no está implementado**: con
  menos de 4 dictadas no hay incentivo.

### Paso B ✅ — ADR-0008 · commit `1c442c9`

- `context/decisions/0008-la-profesora-ve-su-liquidacion.md` reemplaza la regla 4 de PRD-0008 por
  "ningún monto que no sea el suyo".
- **La regla 2 no cambia y no tiene excepción.** El ADR fija que la liquidación **no lee
  `perfiles`**: ni nombres, ni RUT, ni correo, ni teléfono, ni apoderado.
- PRD-0008 quedó con una nota que apunta al ADR, sin borrar el texto original.

### Paso C ✅ — `lib/dominio/liquidacion.ts` con 38 tests · commit `1ac78c7`

- **Toda la regla de pago vive ahí.** La base de datos solo entrega insumos (cada clase, su estado,
  su causa y sus créditos) y no calcula montos.
- **Los casos de borde que pediste, uno por uno, con montos calculados a mano:**
  - **Menos clases que el piso:** 3 dictadas con 30 alumnas cada una → $0. Y 3 dictadas más una no
    dictada → $0, porque la no dictada no cuenta para el piso.
  - **Justo en el límite de cada tramo:**
    - promedio 14 exacto → $7.500; 13,75 → $0;
    - 22 exacto → $15.000; 21,75 → $7.500;
    - 25 → $15.000, porque los tramos se suman.
  - **Una profe con dos cursos:** gana en los dos ($7.500 + $15.000). Tampoco se juntan dos cursos
    para llegar al piso.
  - **Un mes con una clase no dictada y su recuperación:**
    - la original paga $0;
    - la recuperación se paga entera y es la cuarta dictada que habilita el incentivo;
    - sin recuperación, la original paga la base y el curso no llega al piso;
    - si la recuperación cae en el mes siguiente, noviembre paga $0 y diciembre la recuperación.
  - **Variable:** 5 créditos → $0, 6 → $250, 15 → $2.500 (tu ejemplo). En una clase de 90 minutos el
    variable no escala con la duración.
  - **Reemplazo:** la clase se le paga a quien dictó, y la titular no la ve en su liquidación.
  - **Un mes completo de P1 calculado a mano:** $169.750 (base $153.000, variable $9.250,
    incentivo $7.500). Deja afuera una especial, una del mes siguiente y una de otra profesora.
  - **El mes en Santiago:** la clase del 30/11 a las 22:00 es de noviembre, y el mes no termina a
    medianoche UTC.
  - **Octubre:** se bloquea con "se pagaron a mano".
- **Prueba de mutación:** rompí la regla a propósito en tres lugares (el umbral, la recuperación y
  el `>=` del tramo). Los tests lo detectan: fallan 10, 5 y 6. No pasan por casualidad.
- **Lecturas mías**, todas escritas en el PRD §6.5 y §6.6:
  - **"Alumnas" de una clase son los créditos consumidos**, el mismo número del variable. No hay
    registro de asistencia.
  - **El promedio se compara sin decimales:** la suma de las 4 mejores tiene que ser ≥ 56.
  - **El reemplazo suma al promedio de quien dictó.**
  - **"Cancelar temprano ahorra el sueldo"**: lo traduje como cancelar antes del día de la clase, en
    Santiago, y solo para `sin_alumnas` y `asistencia_insuficiente`. Si se canceló el mismo día, se
    paga la base. **Esta es la lectura que más conviene que revises.**
  - **Recuperada, por la causa que sea, la original paga $0.** Incluye `sala_no_disponible`: lo leí
    de "una clase recuperada se paga una sola vez, en la recuperación", que es general.
- **Hallazgo, sin arreglar:** el umbral de 5 del 21/10 **no está** en `costoClase()`
  (`lib/dominio/finanzas.ts`). El margen de `/owner/finanzas` sigue cobrando $250 por cada crédito y
  sobrestima el costo hasta en $1.250 por clase. No lo toqué porque no es parte de la liquidación:
  es una línea, si lo apruebas.

### Paso C, después ✅ — 5 bordes más · commit `d3819b2`

Con el tiempo que sobró, como pediste, sumé tests en vez de empezar el portal:

- `sin_alumnas` cancelada el mismo día paga la base; con anticipación, $0.
- Una especial no suma al promedio ni al piso.
- Una clase futura del mes no cuenta para el piso.
- La anticipación se mide con la primera fecha de registro.

**43 tests en `liquidacion.test.ts`; 264 en el repo.**

### Paso D ✅ — la migración, sin aplicar · commit `7e6246d`

- **`20261105140000_liquidacion_profesoras.sql`. No está aplicada.**
- **`--dry-run` contra producción:**

  ```
  Would push these migrations:
   • 20261105140000_liquidacion_profesoras.sql
  {"upToDate":false,"dryRun":true,"migrations":["20261105140000_liquidacion_profesoras.sql"],...}
  ```

- **La regla de pago no está en SQL.** La base entrega **insumos** (cada clase con su estado, su
  causa, si se recuperó y cuántos créditos se consumieron) y una **huella** (md5) de esos insumos
  más la tarifa. La pantalla calcula con `lib/dominio` y manda monto, detalle y huella.
  `pagar_liquidacion` recalcula la huella y **rebota si cambió**: es el "el monto cambió mientras lo
  mirabas" del PRD, sin escribir la regla dos veces. El PRD decía que se recalculaba en SQL; lo
  cambié por esto, y está explicado en su §12.3.
- **Qué agrega:**
  - el estado `no_dictada` y `clases.recupera_clase_id`, con una sola recuperación por clase;
  - la tabla `causas_de_clase`, con las cinco causas;
  - la tabla `reasignaciones_de_clase`;
  - la fila de Isi en `costos_profesoras` (tarifa general) y `umbral_variable = 5`;
  - la tabla `liquidaciones_profesoras`, que solo acepta meses desde noviembre de 2026;
  - las funciones `registrar_no_dictada`, `marcar_recuperacion`, `reasignar_clase`,
    `pagar_liquidacion` (owner, con comprobante obligatorio y el egreso en la misma transacción) y
    `anular_liquidacion`;
  - los insumos para el owner, y para la profesora **solo los suyos, sin nada de las alumnas**;
  - la clase de Pau del 3/11 clasificada como `asistencia_insuficiente`.
- **Escenario en la base local: 29 de 29** (`node scripts/base-local/escenario-liquidacion.mjs`).
  - **El mes de Pau en la base:** una no dictada que se recupera, una cancelada que se clasifica,
    una que cubre Drimy y las demás dictadas.
  - **El monto lo calcula `lib/dominio`:** Pau, **$88.500** (incluye $7.500 de incentivo, porque la
    recuperación es su cuarta dictada); Drimy, **$18.750**.
  - **Lo que rebota al pagar:** el mes en curso, sin comprobante, un admin, octubre, una huella
    vieja y pagar dos veces.
  - **El candado del mes pagado:** marcar o reasignar una clase de un mes pagado también rebota.
  - **Anular** deja la fila y anula el egreso.
  - **Lo que ve cada rol, preguntado con su sesión:**
    - Pau ve sus clases y nada de Drimy, sin ninguna columna de alumnas;
    - ve lo que se le pagó, sin comprobante;
    - admin, profesora y alumna leen cero filas de las tablas, y anon no tiene permiso;
    - **la causa no aparece en `clases`**, que es pública.
  - **`metricas_demanda` deja de contar una no dictada como dictada.**
- **Decisiones mías en la migración:**
  - **La causa va en una tabla aparte, no en `clases`.** `clases` es pública entera
    (`using (true)`), y un detalle como "la profe estaba enferma" no puede quedar a la vista de
    cualquiera.
  - **No hay `check` que obligue la causa al cancelar.** Sin leer producción no puedo clasificar
    las que ya existen, y un `check` rompería lo que hoy cancela sin causa. En cambio, **la
    liquidación no se puede pagar** mientras haya una sin causa: lo dice la pantalla y lo vuelve a
    comprobar `pagar_liquidacion`.
  - **`metricas_resumen` no la toco**, porque la redefine el bloque 3 y la última migración
    aplicada ganaría. Sí corrijo `metricas_finanzas` y `metricas_demanda`.
  - **`hoy_santiago()` es la única fuente del "hoy"** en el pago. Es lo que me dejó probar el pago
    de noviembre hoy, 5/11.

### Paso E ⏸ — no empezado, a propósito

Lo que falta para usarlo:

- la página `/owner/liquidaciones`;
- "Mi liquidación" en el portal de la profesora;
- el Route Handler que sube el comprobante a un bucket privado.

Preferiste C y D sólidos y E mañana, y no quise dejar pantallas a medias. Todo lo que E necesita
de la base ya está y está probado. Noviembre se paga recién en diciembre, así que no apura.

**Antes de aplicar esta migración** conviene una consulta de solo lectura en producción: cuántas
clases de parrilla de noviembre están `cancelada` sin causa. Cada una bloquea el pago de su
profesora hasta que alguien la clasifique.

---

## Cruces entre ramas

**Probé mergear todo junto** en una copia temporal, que después borré, en este orden:
`pedidos-de-uso` → bloque 1 → bloque 2 → bloque 3 → bloque 4.

| Rama | Resultado |
|---|---|
| `origin/pedidos-de-uso` | limpio |
| `prd-0025-filtrar-personas` | limpio |
| `prd-0026-pack-de-amigas` | limpio |
| `prd-0024-revocar-creditos` | **un conflicto, en `app/(admin)/admin/page.tsx`**. Los bloques 1 y 3 tocan la misma consulta. Se resuelve juntando las dos: el `esOwner` del 3, la consulta con `count` y filtro del 1, y el `Promise.all` con las cinco lecturas |
| `prd-0010-parte-3-liquidacion` | limpio |

**Con todo junto y el conflicto resuelto:** 277 tests pasan, `npm run build` pasa, el lint está
limpio, y los cuatro escenarios pasan con las tres migraciones aplicadas en orden (33, 20, 3 y 29
pasos).

**Las tres migraciones:**

- **No se pisan.** Solo el bloque 3 redefine `metricas_resumen`; el bloque 4 redefine
  `metricas_finanzas` y `metricas_demanda`, y el bloque 2 `acreditar_compra`.
- **Se pueden aplicar por separado**: ninguna depende de otra.
- **Si se aplican juntas, que sea en el orden de sus nombres.**

**`scripts/base-local/base.mjs` es idéntico en las tres ramas que lo traen**, así que no choca.

**El arreglo del arnés (commits `11defd4` y `3291cb8`):**

- **El `auth.uid()` de mentira fallaba con claims vacías.** El arnés se lo había copiado a los
  bloques 2 y 3. Ningún resultado cambió, pero quedó corregido igual en las tres ramas.
- **Una llamada que repetía la función.** Escribir `select (f(...)).*` ejecuta la función una vez
  por cada columna. En el bloque 2 eso llamaba a `acreditar_compra` varias veces por aprobación,
  sin efecto porque es idempotente. Ahora la llama una vez.

---

## Lo que necesito de ti

### Para publicar

1. **Bloque 1:** mergear `prd-0025-filtrar-personas`. No toca la base.
2. **`pedidos-de-uso` a `main`:** son solo documentos, sin conflictos, y conviene hacerlo antes del
   bloque 4.
3. **Migraciones, por nombre, cuando quieras:**
   - `20261105120000_pack_de_amigas.sql` → después, mergear `prd-0026-pack-de-amigas`;
   - `20261105130000_revocar_creditos.sql` → después, `prd-0024-revocar-creditos`, con el conflicto
     de arriba;
   - `20261105140000_liquidacion_profesoras.sql` → después, `prd-0010-parte-3-liquidacion`.

   En los tres casos, **primero la migración y después el código.**
4. **Staging está tres migraciones atrás de producción.** Para probar desde la página antes de
   producción hay que ponerlo al día, y eso también lo apruebas tú.

### Decisiones mías para revisar

Ordenadas de más a menos importante:

1. **La lectura de "cancelar temprano ahorra el sueldo"** (bloque 4): antes del día de la clase no
   se paga; el mismo día o después, la base. Solo vale para `sin_alumnas` y
   `asistencia_insuficiente`.
2. **Recuperada por cualquier causa, la original paga $0** (bloque 4). Incluye
   `sala_no_disponible`.
3. **Anular una compra con clases vivas se rechaza, en cualquier compra** (bloque 2): primero se
   quitan las clases con el bloque 3.
4. **Los datos para transferir aparecen recién con la amiga validada** (bloque 2).
5. **Límite de consultas: 5 por hora y 10 por día** (bloque 2), ajustable en `parametros`.
6. **"Alumnas" de una clase = créditos consumidos**, y el promedio se compara sin decimales
   (bloque 4).
7. **La utilización del tablero descuenta lo revocado** (bloque 3).
8. **El nombre "Pack de amigas"**, y que el correo a la amiga lleve el nombre de pila de quien
   compró (bloque 2).

### Preguntas que quedaron abiertas

- **¿Se promedia con 3 cuando las clases no se dictaron por decisión de la academia?** No está
  implementado (PRD-0010 parte 3, pregunta 8).
- **¿"Pasa al mes siguiente" es por profesora o por mes?** No encontré la respuesta en CONTEXT;
  tomé la propuesta del PRD.
- **¿Se agrega el umbral de 5 al margen de `/owner/finanzas`?** Es una línea en `costoClase()`.

### Hallazgos, sin arreglar

- **El umbral de 5 del variable no está en `/owner/finanzas`**: el margen sobrestima el costo hasta
  en $1.250 por clase.
- **Las plantillas de correo de antes no escapan el nombre como HTML.** La nueva sí.
- **No probé que PostgREST lea bien `\"` dentro de comillas** en la búsqueda del bloque 1. Así lo
  dice su documentación, pero se confirma con sesión.

---

## Lo que no hice, y por qué

- **Nada contra una base remota**, salvo el conteo de alumnas. Los `--dry-run` y `link` contra
  producción leen y no escriben. El CLI quedó enlazado a staging (`ybopuahlzbjkkwumkllk`).
- **No toqué `reservar()`**, ni CONTEXT.md, ni la sección "Estado al…" del ROADMAP.
- **No empecé nada de lo que dejaste fuera de alcance**: inscritas de una clase, ficha de persona,
  editar perfil, inscribir en una clase pasada.
- **No mergeé nada a `main`.**

---

## Correcciones del 05/11

Sesión de la mañana. **Nada se aplicó a una base remota.** Lo único remoto fue de lectura: los
`--dry-run` contra producción y unos conteos contra staging, sin datos de personas. El CLI quedó
enlazado a staging.

| Parte | Qué cambió | Rama | Commit |
|---|---|---|---|
| 1 · Liquidación | Sale el corte por anticipación. Entra `profesora_se_presento` | `prd-0010-parte-3-liquidacion` | `c206ae0` |
| 2 · Candado de anular | Sale de la migración del pack | `prd-0026-pack-de-amigas` | `6127db4` |
| 2 · Candado de anular | Entra en la de revocar, con su parte del PRD y su escenario | `prd-0024-revocar-creditos` | `bd7cd69` |
| 3 · `main` | `pedidos-de-uso` | `main` | `ef2bb1e` |
| 3 · `main` | `prd-0025-filtrar-personas`, con la nota de las 74 alumnas (`14590bb`) | `main` | `3cb80f7` |
| 3 · `main` | Cierre: PRD-0025, changelog, "Estado al 5/11" y el pedido 8 | `main` | `c9a28fe` |
| 4 · PRD-0027 | La clase recuperativa | `prd-0027-clase-recuperativa` | `a3d71e4` |

### Parte 1 — los montos del escenario, recalculados a mano

**Los montos que había no cambiaban.** Ningún caso del escenario pasaba por el corte ni por una sala
recuperada: Pau seguía en $88.500 y Drimy en $18.750. Agregué dos clases que sí pasan por ahí, con el
cálculo escrito antes de correrlo, y coincidió. **Escenario: 36 de 36.**

| Clase de Pau | Cuenta | Monto |
|---|---|---|
| A1, 02/11, dictada, 16 créditos | 18.000 + 11 × 250 | $20.750 |
| A2, 03/11, asistencia, recuperada | Se paga en A4 | $0 |
| D, 04/11, cambio de parrilla | No paga | $0 |
| A3, 10/11, dictada, 12 créditos | 18.000 + 7 × 250 | $19.750 |
| A4, 20/11, dictada, 14 créditos | 18.000 + 9 × 250 | $20.250 |
| A5, 24/11, dictada, 14 créditos | 18.000 + 9 × 250 | $20.250 |
| **S, 01/11, sin sala, se presentó, recuperada** (nueva) | Base. Con la regla de anoche: $0 | $18.000 |
| **T, 27/11, sin alumnas, cancelada con semanas de anticipación, no recuperada** (nueva) | Base. Con el corte: $0 | $18.000 |
| Incentivo | 16 + 14 + 14 + 12 = 56, promedio 14 | $7.500 |
| **Total Pau** | 81.000 + 36.000 + 7.500 | **$124.500** |

**Drimy: $18.750**, sin cambios (8 créditos, 3 sobre el umbral).

El mes completo de P1 en `liquidacion.test.ts` sí cambió: de $169.750 a **$187.750**, porque la
`sin_alumnas` cancelada con anticipación ahora paga la base.

Salieron 6 tests que medían anticipación y entraron 6 de `profesora_se_presento`: siguen siendo 43.
`causa_registrada_at` salió de los insumos y de la huella, y `profesora_se_presento` entró en las
dos: cambiarlo hace rebotar un pago que se estaba mirando.

### Parte 2 — las migraciones son independientes

Comprobado, no supuesto: cada una sola en su rama, y las dos juntas en los dos órdenes. **Pack 30 de
30** (eran 33: tres pasos se fueron con el candado) y **revocar 25 de 25** (eran 20). Dicho en los dos
PRDs.

### Parte 3 — el filtro está publicado, pero la prueba que pediste no se hizo

Deploy terminado a las 11:25. **No lo probé desde la página con tu sesión**: esta sesión no tenía la
extensión de Chrome, y crear una sesión a mano para tu cuenta habría sido suplantarte.

| Lo que pediste | Qué pasó | Cómo se comprobó |
|---|---|---|
| `cami`, `CAMI` | 200, 0 filas. **No prueba mayúsculas**: en staging no hay ninguna Cami | Filtro exacto contra staging |
| `o"x` | 200, sin error de sintaxis: **PostgREST sí lee `\"`** | Igual |
| `50%` | 200, 0 filas. `%` solo también da 0 de 28: no es comodín | Igual |
| Algo que no existe | 200, 0 filas | Igual |
| **`/admin` con una alumna** | ⏳ **Sin probar.** Solo leí el código: `requiereNivel("admin", "admin")` redirige antes de renderizar. Sin sesión, producción responde 307 a `/entrar` | `curl` y lectura |

### Parte 4 — PRD-0027

Tu lectura del esquema es correcta, con tres cosas que no estaban a la vista:

1. **`on conflict do nothing` no duplica ni borra, pero tampoco avisa.** Una recuperativa en el día
   regular, más allá de los 70 días generados, habría hecho desaparecer la clase regular de esa
   fecha sin error. Se rechaza ese día de la semana.
2. **Una recuperativa cancelada ocupaba el índice para siempre.** Ahora cuenta solo la que sigue en
   pie.
3. **"Tenía reserva" no se puede leer de la reserva.** Quien canceló sola se ve igual que quien
   perdió la clase. Se distingue por el movimiento del libro.

**Depende de la migración de la liquidación**, así que el `--dry-run` lista las dos:

```
Would push these migrations:
 • 20261105140000_liquidacion_profesoras.sql
 • 20261105150000_clase_recuperativa.sql
```

**Escenario: 24 de 24.** `npm test`: 280. `npm run build` pasa. **La pantalla compila, pero nadie la
ha abierto**, y sus lecturas por PostgREST y el correo no están probados: eso necesita las dos
migraciones en staging.

### Para decidir

1. **`CONTEXT.md` sigue diciendo "cancelar temprano ahorra la sala y el sueldo"**, ahora en `main`.
   No lo edité porque es tuyo. ¿La saco?
2. **¿La clase de Pau del 3/11 lleva `profesora_se_presento`?** Quedó apagado, porque CONTEXT dice
   que esa fecha no se le paga. Pero dice también que Pau no faltó: si fue a la sala, la regla nueva
   le pagaría la base además de la recuperación ($18.000 más).
3. **¿La sala de la recuperación se cobra?** CONTEXT dice que sí; el ROADMAP y PRD-0010 dicen que no.
   `/owner/finanzas` hoy la cobra.
4. **Una recuperativa a una hora rara se dibuja corrida** hasta mergear
   `grilla-filas-de-cinco-minutos`. Es la condición que pusiste para sacarla.

---

## Staging y correcciones del 06/11

**Nada a producción.** Nada se mergeó a `main`. El CLI quedó enlazado a **staging**
(`ybopuahlzbjkkwumkllk`, `xo-dance-studio-staging`). `.env.local` también apunta a staging.

| Parte | Qué cambió | Rama | Commit |
|---|---|---|---|
| 2 · Bandera | `profesora_se_presento` solo cambia el pago en `sala_no_disponible` | `prd-0010-parte-3-liquidacion` | `0f94f3f` |
| 3 · Documentos | CONTEXT, ROADMAP y PRD-0010 | `documentos-06-11` | `e885190`, `6aeaa04` |
| 4 · PRD-0027 | Selector de categoría y "otra sala" | `prd-0027-clase-recuperativa` | `3edcd64`, `d8720d3` |
| 5 · Integración | Las cuatro ramas juntas, solo para staging | `staging-06-11` | `3db1757` |

**Liquidación:** 44 tests. Comprobé que los dos tests nuevos fallan con la regla vieja. El escenario
pasó a 37 de 37, y los montos no cambian: **Pau $124.500 y Drimy $18.750**, porque la única clase con
el campo prendido era de sala. La clase de Pau del 3/11 queda apagada.

**`/owner/finanzas` está del lado correcto, y no se tocó código.** Costea las clases dictadas por
`sedes.costo_hora_clp`: una cancelada no suma sala y la recuperación sí.

**`documentos-06-11` no está en `main`:** un merge a `main` publica, y dijiste nada a producción.
`CONTEXT.md` en `main` sigue con la frase vieja hasta que lo apruebes.

### Lo que se aplicó a staging, en orden

Todos los `--dry-run` coincidieron con lo esperado. Las ramas de revocar y pack necesitaron
`--include-all`, porque sus timestamps son anteriores a lo ya aplicado. **Ninguna función se redefine
en dos migraciones**, así que el orden no cambia el resultado. `migration list`: 45, ninguna pendiente.

| Desde | `--dry-run` y lo aplicado |
|---|---|
| `main` (`c9a28fe`) | `20261103210000_clase_pau_3_nov_no_dictada` · `20261103211000_capacidad_los_leones_16` · `20261104120000_fin_preventa_noviembre` |
| `staging-06-11` (`0b6abb4`), liquidación | `20261105140000_liquidacion_profesoras` |
| `staging-06-11` (`81dcd79`), recuperativa | `20261105150000_clase_recuperativa` · `20261106120000_salas_ocasionales` |
| `staging-06-11` (`b1cbf10`), revocar | `20261105130000_revocar_creditos` |
| `staging-06-11` (`e0245e6`), pack | `20261105120000_pack_de_amigas` |

**La clase de Pau del 3/11: no-op en staging por diferencia de datos.** Ahí no tenía reservas
confirmadas. La clase quedó cancelada, y su única reserva, ya cancelada antes, no se movió: el lote
siguió en 4 y los movimientos en 2.

### Devolver créditos, por el camino real

`scripts/verificar-devolucion-navegador.mjs`. Dos alumnas inventadas recibieron créditos con
`regalar_creditos`, completaron su perfil y reservaron desde la página la Reggaeton Femme del 12/11,
19:30. La clase se canceló con el mismo `update` de la clase de Pau.

Los dos créditos volvieron a su lote original, vigentes, con el libro igual a los lotes y el motivo
"La academia canceló la clase".

### Lo que abrí y lo que vi

| Pantalla | Qué vi |
|---|---|
| **Pack de amigas** | ✅ El aviso se ve en `/comprar` y en el plan. Con un correo sin cuenta no deja seguir ni muestra a dónde transferir. Con uno que existe, sí. Al aprobar: dos lotes con el mismo `compra_id`, uno por cuenta, y dos movimientos `compra` |
| **Revocar** | ✅ Más de lo que hay: el botón no se habilita y la base rechaza. Menos (1 de 4) y exacto (3 de 3): bajan, y el libro cuadra. Owner ve el botón y admin no |
| **Anular con créditos vivos** | ✅ Rechaza: "Esta compra todavía tiene 2 clases sin usar en sus lotes". ⚠️ **No hay botón de anular**: lo probé con el `update` a mano que usas hoy |
| **Liquidación** | ⚠️ **No se pudo abrir: no hay pantalla**, porque el paso E no se construyó. Corrí `liquidar()` con los insumos de staging y sesión de owner. La del 3/11 paga $0 con "se paga una sola vez, en la recuperación", y las recuperativas cuentan como dictadas. La base no tiene las clases del escenario, así que **los montos del escenario solo se comprobaron en la base local** |
| **Recuperativa, sala existente** | ✅ Sin campos de marketing. El choque del mismo día sale en palabras y no crea nada. Queda `parrilla`, mismo `horario_id`, ligada, sin título ni slug, cupo 22 |
| **Recuperativa, "otra sala"** | ✅ Sin capacidad no deja guardar. "Barros Borgoño 71 of. 101" ofreció Studio 98. Sala nueva de 12: cupo 12 |
| **Calendario y `/nosotros`** | ✅ Salen con el nombre del curso, sin "recuperativa" y sin costo. La sala arrendada no sale en `/nosotros` |
| **Correo** | ⚠️ Quedaron las dos filas en la cola, solo para las dos afectadas. Ver el hallazgo 4 |
| **Reservar** | ✅ Una afectada y otra alumna reservaron la clase: cupo por orden de llegada. Entré directo a `/reservar/<id>`, no desde un correo real |
| **`/owner/finanzas`** | ✅ Abre con las cuatro ramas |

### Lo que ve cada rol

`scripts/verificar-roles-06-11.mjs`, con la sesión de cada una, en una transacción revertida. Staging
no tiene perfil de profesora: lo convertí dentro de esa transacción.

- **Nadie con sesión lee `sedes.costo_hora_clp`**, ni owner. La API con `anon` responde 401.
- **Causas:** alumna y profesora, 0 filas. Admin y owner, 1. `anon`, sin permiso.
- **Costos y egresos:** solo owner. **Insumos y huellas:** solo owner. **`mis_insumos_liquidacion`:**
  solo las clases de la profesora.
- **La amiga** ve su lote y no la compra.
- **Ninguna sesión ejecuta** `crear_recuperativa`, `crear_sala_ocasional`, `afectadas_de_clases`,
  `revocar_creditos`, `registrar_no_dictada` ni `direccion_comparable`.
- `buscar_invitada` la pregunté con la firma equivocada, así que esa fila de la tabla no vale. Sus
  grants los leí en la migración: solo `service_role`. **No lo pregunté con sesión.**

### Qué falló

Nada de esto se arregló.

1. 🔴 **El costo al lado del precio no aparece en una recuperativa (4.5.d).** Las 132 clases de
   parrilla de staging tienen `fin` nulo, así que no hay duración con qué calcularlo. Error mío del
   06/11: lo supuse sin mirar los datos. En la especial sí aparece: "Esta clase, de 60 minutos,
   costaría $15.000".
2. 🔴 **La liquidación no tiene pantalla** y el pago del 1/12 la necesita.
3. **Una hora rara se dibuja corrida**, comprobado: la de las 14:50 sale en la fila de las 15:00, con
   el texto correcto. Sale arreglado con `grilla-filas-de-cinco-minutos`, que no mergeé.
4. **El correo no se probó de punta a punta.** Las cuentas `.invalid` quedan `descartado` en la cola,
   sin pasar por Resend, y la pantalla dice "Salieron 0 de 2; el resto se reintenta", que para ellas
   no es cierto.
5. **Publicar el código antes que las migraciones rompe el build:** `/nosotros` y
   `/profesoras/[slug]` filtran por `sedes.ocasional`. Lo vi en el build de la rama antes de aplicar
   a staging. Los previews de Vercel de `prd-0027-clase-recuperativa` pueden fallar por lo mismo.
6. **"Por recuperar" trae cancelaciones de cambios de horario**, sin causa: 4 en staging. Hasta
   clasificarlas se ofrecen, y en producción van a ser más.
7. **La sala ocasional se lee por la API:** nombre y dirección, no el costo. Es necesario para decir
   dónde es la clase, pero conviene que lo sepas. También sale en "Dónde es cada clase" aunque la
   clase sea de otra semana.
8. **Dos conflictos al integrar:** `app/(admin)/admin/page.tsx` y `lib/acciones.ts`, resueltos solo en
   `staging-06-11`. Van a volver al mergear a `main`.
9. **`/calendario` tarda hasta 10 minutos en mostrar una reserva.** Con dos reservas seguía diciendo
   22 lugares, y pasado el plazo dijo 20. Es la caché de la página, que reservar no refresca. Ya es
   así en `main`, y el cupo real lo valida la base.
10. **Sin explicar:** una recarga de `/admin` no llegó a `networkidle` en 30 segundos, una vez. No lo
   investigué.

### Lo que quedó en staging

Dos alumnas inventadas (`alumna.uno` y `alumna.dos@ejemplo.invalid`), la Reggaeton Femme del 12/11
cancelada, dos recuperativas (18/11 15:00 y 21/11 14:50), "Sala de prueba", una compra del pack de
amigas de `ana` y `bea`, dos reservas en la del 21/11, y `emi` con saldo 0. La del 12/11 quedó sin
causa, así que la liquidación de Pau en staging aparece bloqueada por eso.

### Para decidir

1. **¿Mergeo `documentos-06-11` a `main`?** Son solo documentos, pero publica.
2. **¿Cómo se resuelve la duración de la parrilla?** Una hora fija por defecto, o llenar `fin`.
3. **¿Empiezo el paso E de la liquidación?** Es lo que queda en el camino del 1/12.

---

## Paso E y duración, 06/11

**Nada a producción.** A `main` solo entró `documentos-06-11`, con la regla nueva en `CLAUDE.md`
(`d68a550`). El CLI sigue en staging, y `hoy_santiago()` quedó restaurada.

| Parte | Rama | Commits | Migración |
|---|---|---|---|
| 2 · Paso E | `prd-0010-parte-3-pantallas` | `9071e81`, `3ee9c38`, y el aviso por monto | `20261106130000_cerrar_liquidacion.sql` |
| 3 · Duración | `duracion-de-clases`, sobre la anterior | `5099141`, `160e4de` | `20261106140000_duracion_en_horarios.sql` |

Las dos están aplicadas en staging y **no en producción**. Cada `--dry-run` listó solo esa migración.
Para aplicar armé `probar-liquidacion`, una rama local descartable que junta `staging-06-11` con estas
dos: sin ella `db push` no conoce lo ya aplicado. No está pusheada.

### Cambios de diseño que no estaban en tu pedido

- **Cerrar y pagar se separaron.** Antes no había fila hasta pagar. Cerrar congela monto, detalle y
  huella. Pagar agrega comprobante y egreso. Un disparador impide editar lo congelado o borrar.
- **La pantalla usa el reloj de la base**, `hoy_santiago()`, para no ofrecer lo que la base rechaza.
- **Agregué clasificar la causa en la pantalla.** Sin eso, una clase sin causa traba el mes y no hay
  cómo destrabarlo desde el sitio.
- **El comprobante es obligatorio para marcar pagada**, como decía el PRD §8.4.

### Los montos: pantalla contra escenario

Noviembre en staging se armó con las cantidades del escenario, con `regalar_creditos` y `reservar()`:
62 reservas de 16 alumnas inventadas, sin escribir reservas a mano. Son otras fechas que las del
escenario, con los mismos créditos. Las causas se pusieron desde la pantalla. Para ver el mes
terminado reemplacé `hoy_santiago()` por el 2/12 y la restauré.

| | Escenario | Pantalla | Pantalla, tras rellenar `fin` |
|---|---|---|---|
| **Pau** | .500 | **.500** | **.500** |
| **Drimy** | $18.750 | **$18.750** | **$18.750** |

Base local: liquidación 44 de 44, duración 7 de 7, recuperativa 24 de 24, salas 19, revocar 25, pack
30. `npm test`: 287 en la rama del paso E. `npm run build` pasa.

### Lo que abrí y lo que vi

| Pantalla | Qué vi |
|---|---|
| **`/owner/liquidaciones`, reloj real** | "El mes todavía no termina", y Cerrar deshabilitado |
| **Pau, a 390 px** | Las 4 dictadas con fecha, sala, créditos, base y variable. Las 5 no dictadas con su causa y lo que pagan, incluido "No paga". Las 4 clases del promedio: 16, 14, 14 y 12, promedio 14 |
| **Lo que no entra** | La del 3/11 "se paga una sola vez, en la recuperación"; la del 26/11 "sin fecha de recuperación". Lina: "Se paga en diciembre de 2026", con "Se recupera el jueves 3 de diciembre, 16:00" |
| **Drimy** | "1 clase dictada: hacen falta 4 para optar" |
| **Cerrar dos veces** | Dos pestañas apretando a la vez: una sola fila, sin anulada de más |
| **Pagar** | Sin comprobante no deja. Con PNG: pagada, con egreso igual |
| **Anular** | La fila anulada sigue ahí y el nuevo cierre agrega otra |
| **`/profesora/liquidacion`** | Cada una ve lo suyo, sin botones. Busqué en el HTML correo, nombre y teléfono de todas las alumnas de staging: **cero** |
| **Recuperativa** | Ya muestra "de 60 minutos, costaría $15.000": hallazgo 1 resuelto |
| **`/calendario`** | Igual: las de una hora no muestran rango |

### Preguntado a la base con cada sesión

`scripts/verificar-roles-liquidacion.mjs`, en transacciones revertidas, con cuentas reales de
profesora.

- **La tabla:** owner ve 3 filas; profesora, alumna y admin, 0; `anon`, sin permiso. Por API, 401.
- **`mis_liquidaciones`:** Pau ve la suya; **Drimy, buscando $124.500, 0 filas**; admin y alumna, 0.
- **Insumos, huellas, costos y egresos:** solo owner. Causas: admin y owner.
- **Nadie con sesión** ejecuta cerrar, pagar, anular ni `registrar_no_dictada`, ni hace `update` o
  `delete` del libro. Eso incluye a owner: todo pasa por el servidor.
- **`buscar_invitada`:** ahora sí preguntado, nadie con sesión la ejecuta.
- **El comprobante:** sin sesión 403; por URL pública del bucket, 400. **No abrí "Ver comprobante" con
  sesión de owner.**

### Qué falló, o queda por decidir

1. 🔴 **Una clase sin fecha de recuperación al cerrar.** Paga la base, y después
   `crear_recuperativa` la rechaza porque el mes está cerrado. Contradice "la recuperación no es
   opcional". La pantalla lo advierte, pero no lo impide: es tuyo.
2. 🔴 **El orden para producción cambió.** Tu lista no tiene las dos migraciones nuevas. Van después
   de la liquidación: `20261106130000` y `20261106140000`. **La de duración tiene que aplicarse antes de
   cerrar noviembre:** rellenar `fin` mueve la huella, y lo comprobé: una cerrada antes no se deja
   pagar, y rebota con "anula el cierre y vuelve a cerrar".
3. **La migración de duración aborta si producción tiene un horario que no está en la lista.** Es a
   propósito. Los 15 salieron de staging; no leí producción.
4. **Un cierre de Drimy no quedó en la primera corrida**, sin mensaje de error. En la segunda funcionó.
   Lo más probable es que mi espera de 3 segundos fuera corta, pero no lo comprobé.
5. **Una recuperativa cancelada después de cerrar:** la original deja de estar recuperada y el monto
   cambia, y eso debería ir como ajuste. `ajustes_liquidacion` no existe. No lo probé.
6. **Sin construir:** reasignar una clase desde la pantalla (en staging lo hice por función), los
   ajustes, y cerrar a todas de una vez.
7. **Textos:** "Si se cierra así…" está escrito para ti y lo ve también la profesora. Los candados
   dicen "ya se le pagó" aunque el mes solo esté cerrado.
8. **`escenario-recuperativa.mjs` necesita un ajuste al mergear:** inserta clases sin `fin`. Está hecho
   solo en `probar-liquidacion`.
9. **Efecto menor:** el portal de la profesora ahora dice "a 19:00", porque `fin` existe.

### Lo que quedó en staging

16 alumnas `prueba.NN`, dos cuentas `profe.pau` y `profe.drimy`, y noviembre de Pau y Drimy
reordenado. Pau y Drimy quedaron **cerradas sin pagar**, con sus filas anuladas a la vista. Una
recuperativa de Lina el 3/12, y 20 clases nuevas de `generar_clases(85)`.
