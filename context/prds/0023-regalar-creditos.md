# PRD-0023 — Regalar créditos a una alumna

| Campo | Valor |
|---|---|
| **Estado** | ✅ **Aprobado por Felipe el 04/10/2026**, con las cinco decisiones de §8.6 y un cambio al pasivo (§7.3.2) |
| **Autor** | Claude, a pedido de Felipe Carvallo |
| **Fecha** | 4 de octubre de 2026 |
| **Hito** | Hito 2 — Venta de clases (créditos) |
| **PRDs relacionados** | PRD-0017 (compras, créditos y el libro) · PRD-0010 (métricas y finanzas) · PRD-0019 (cola de correos) · `ARCHITECTURE.md` §5.4 · `CONTEXT.md` (puesta en marcha de octubre) |

---

## 1. Problema

Hay alumnas a las que hay que darles clases **sin que paguen**, y hoy no hay cómo hacerlo bien:

- **Las de septiembre con saldo.** `CONTEXT.md` lo deja escrito: septiembre se cerró fuera del
  sistema, y a quien le quedó saldo "se resuelve a mano con un lote de regalo con motivo". Ese
  "a mano" no existe todavía.
- **Compensaciones y cortesías**: una clase que se cayó por algo de XO, una promoción, una alumna
  que trajo a otra.

El modelo ya lo prevé —`creditos.compra_id` acepta `NULL` ("un lote sin compra detrás") y
`movimientos_credito.tipo` incluye `regalo`— pero **no hay función ni pantalla**. La única vía
sería SQL suelto contra producción, que el proyecto prohíbe sin aprobación caso a caso, y que
además **no puede registrar quién lo hizo**: una consulta corrida como `postgres` no tiene perfil
que poner en `creado_por`.

## 2. Usuario y contexto de uso

**Admin u owner** —hoy Felipe o Carla—, desde el computador o el teléfono, cuando una alumna
escribe por WhatsApp ("me quedaron 3 clases de septiembre") o después de cancelar una clase. Es
una operación de un minuto, pocas veces por semana, y mueve algo que vale plata: tiene que quedar
claro a quién, cuánto, por qué y quién lo hizo.

## 3. Alcance

1. **Función `regalar_creditos()`** en la base, en **una sola transacción**:
   - crea un lote en `creditos` con `compra_id = NULL`, `cantidad_inicial = cantidad_disponible =
     N` y su `fecha_vencimiento`;
   - escribe en `movimientos_credito` un movimiento `tipo = 'regalo'`, `cantidad = +N`, con su
     `saldo_resultante`, el `motivo` y `creado_por` = el perfil de quien regaló;
   - **exige motivo escrito**: vacío o de menos de 5 caracteres, la función rechaza.
2. **Solo admin y owner.** La función lo verifica adentro, por jerarquía (`nivel_rol >= admin`),
   igual que `acreditar_compra`. Se concede **solo a `service_role`** y se llama desde una acción
   de servidor que además verifica la sesión: `authenticated` no puede ejecutarla directo.
3. **Vence igual que lo comprado**: `now() + 60 días`, la vigencia de los packs (`CONTEXT.md`:
   "2 meses"; `planes.vigencia_dias = 60`). Ver §8.6.a sobre de dónde sale el número.
4. **Pantalla en admin** (§5): regalar desde la fila de la alumna en Personas, con un diálogo que
   pide cantidad y motivo y muestra hasta cuándo vale, y una lista de los regalos recientes.
5. **La alumna lo ve**: el saldo de Mis reservas ya lo suma; se agrega el lote a la lista, como
   "N clases de regalo · vencen el …", **sin el motivo** (§8.6.c).
6. **El pasivo separado** en `metricas_resumen` y en `/owner/metricas`: vendidas sin usar,
   regaladas sin usar, y lo mismo para las vencidas y las por vencer (§7.3.2).
7. **El motivo no se lee con sesión**: permisos por columna en `movimientos_credito`, y admin lo
   lee por `regalos_recientes()` (§12).
8. **Verificador contra staging** que regale con la pantalla, compruebe el lote, el movimiento y
   el saldo, que una alumna no pueda llamarla, y que **ingresos y ventas no cambien** (§7.3).

## 4. Fuera de alcance

- **Deshacer un regalo.** Un error se corrige con un movimiento `ajuste` negativo y la baja del
  disponible del lote, hoy por SQL con aprobación. Si pasa seguido, se construye después.
- **Regalar a varias a la vez** (una promoción para todas las de un curso). Uno por uno alcanza
  para el volumen de hoy.
- **Cambiar cómo se le paga a la profesora** por una clase pagada con regalo. Se decide en §8.6.b,
  y si cambia, va en la liquidación (PRD-0010 parte 3), no acá.
- **Clases especiales**: se pagan aparte (PRD-0018). Un crédito regalado, como uno comprado, solo
  sirve para la parrilla.
- Teens: no usa créditos.

## 5. Flujo principal

1. Admin entra a **Personas** (`/admin`), busca a la alumna y aprieta **Regalar clases** en su
   fila.
2. Se abre un diálogo —el `<dialog>` nativo, como la bandeja de transferencias— con:
   - a quién: nombre y correo;
   - **cuántas clases** (1 a 20);
   - **motivo** (obligatorio, texto libre: "saldo de septiembre", "compensación clase 12/10");
   - **hasta cuándo valen**, calculado y visible antes de confirmar.
3. Aprieta **Regalar N clases**. El servidor verifica la sesión y el rol, y llama a la función.
4. Sale bien: el diálogo se cierra, la fila muestra el saldo nuevo y el regalo aparece arriba en
   **Regalos recientes**, con fecha, alumna, cantidad, motivo, quién lo hizo y vencimiento.
5. La alumna ve el saldo y el lote en Mis reservas, y puede reservar de inmediato. Si se decide
   avisarle (§8.6.d), le llega un correo por la cola.

## 6. Casos borde y errores

| Caso | Qué pasa |
|---|---|
| Motivo vacío o de menos de 5 caracteres | La función rechaza; el diálogo no deja enviar |
| Cantidad 0, negativa o más de 20 | La función rechaza (`check` y validación) |
| Perfil que no existe o con `deleted_at` | Rechaza: `P0002` |
| Quien llama no es admin ni owner | Rechaza: `42501`. No llega ni a escribir |
| **Doble clic** o reenvío del formulario | La función rechaza un regalo **idéntico** —mismo perfil, cantidad, motivo y autor— dentro de los últimos 2 minutos: "ya regalaste esto hace un momento". Ver §11 |
| Regalarse a sí misma | Se permite: admin también toma clases. Queda en el libro con su nombre en las dos puntas |
| Regalarle a una profesora | Se permite: una profesora también es alumna (`Portal`) |
| La alumna tiene lotes comprados y uno regalado | `reservar()` ya consume **el que vence antes** (`order by fecha_vencimiento`). No se distingue regalo de compra al consumir |
| El correo de aviso no sale | El regalo queda igual; el aviso va a la cola y se reintenta (PRD-0019) |

## 7. Modelo de datos

**No hay tablas nuevas.** Todo existe desde PRD-0017:

- `creditos.compra_id` es `NULL`able, comentado "Nulo solo para un regalo".
- `movimientos_credito.tipo` ya acepta `'regalo'`, y tiene `motivo` y `creado_por`.

### 7.1 La función

```
regalar_creditos(
  p_perfil_id uuid,       -- a quién
  p_cantidad int,         -- 1 a 20
  p_motivo text,          -- obligatorio, ≥ 5 caracteres tras recortar
  p_actor_user_id uuid    -- quién, desde la sesión
) returns public.creditos
language plpgsql security definer set search_path = public
```

Mismo patrón que `acreditar_compra`:

1. Busca el perfil del actor por `user_id`; si no es admin o superior, `42501`.
2. Valida perfil destino, cantidad y motivo.
3. Bloquea la fila del perfil destino (`for update`) para que el `saldo_resultante` no se cruce
   con una reserva que ocurra al mismo tiempo, y revisa el regalo idéntico reciente (§6).
4. `insert` en `creditos` con `compra_id = NULL` y `fecha_vencimiento = now() + 60 días`.
5. `insert` en `movimientos_credito`: `tipo 'regalo'`, `cantidad +N`,
   `saldo_resultante = saldo_creditos(perfil)`, `motivo`, `creado_por = actor`.
6. Devuelve el lote.

**Permisos**, escritos explícitos como pide `CLAUDE.md`:
`revoke all ... from public, anon, authenticated;` y `grant execute ... to service_role;`.

### 7.2 Lecturas nuevas

- **Regalos recientes** (admin): movimientos `tipo = 'regalo'` con alumna, autor y lote. Lee con la
  sesión; RLS de `movimientos_credito` ya deja leer todo a admin (a confirmar con la sesión de cada
  rol, no leyendo la política — §11).
- **Mis reservas** (alumna): sus lotes sin compra, con cantidad y vencimiento, sin motivo.

### 7.3 Lo que un lote sin compra toca en métricas y finanzas

Leído en la versión vigente de cada función —`metricas_resumen`
(`20260908130000_metricas_desde_siempre.sql`), `metricas_demanda`
(`20260910120000_clases_especiales.sql`), `metricas_finanzas` (`20260930150000_finanzas_egresos.sql`)—
y en `lib/dominio/metricas.ts` y `lib/dominio/finanzas.ts`.

**No entra en ingresos ni en ventas. Confirmado:**

| Indicador | Por qué no |
|---|---|
| Ingresos del período e históricos (`venta.ingresos_clp`) | Salen de `compras` con `estado = 'pagada'`. Un regalo no tiene compra |
| Compras, ventas por plan, ticket promedio | Igual: solo `compras` pagadas |
| Alumnas con compra / con recompra | Cuentan `compras` pagadas por alumna |
| **Créditos vendidos** (`creditos.vendidas`) | Filtra `tipo = 'compra'`. Los regalos van aparte en `creditos.regaladas` |
| Caja neta de `/owner/finanzas` | Ingresos de `compras` pagadas menos egresos |
| **Ingreso atribuido** a una clase o a una profesora | `valorReserva` devuelve **0** cuando el lote no tiene compra, y tiene test: "un crédito de regalo vale cero" |

**Sí entra en estas cinco cosas**, y conviene que lo sepas:

1. **Le cuesta plata a XO: la profesora cobra los $250 del variable por cada crédito regalado que
   se consume.** `metricas_finanzas` cuenta `creditos_consumidos` por clase sin mirar si el lote
   tenía compra, y `costoClase` multiplica eso por `variable_credito_clp`. Es coherente con
   `CONTEXT.md` —"$250 por crédito consumido"— y con que la profesora dictó la clase igual, pero
   una clase pagada con regalo **cuesta $250 y aporta $0**, y el margen de esa clase baja. **Es
   una decisión tuya: §8.6.b.**
2. **El pasivo vigente** (`pasivoVigente = disponibles − vencidas`) **cuenta los créditos
   regalados**. ~~Propuesta: dejar el número y corregir el rótulo.~~ **Decisión de Felipe: se
   separa en dos** —vendidas sin usar y regaladas sin usar—, y el total queda solo para conciliar
   el libro. Por la misma razón se separan también "vencidas sin usar" y "por vencer en 30 días",
   cuyos rótulos dicen "pagadas" y "alguien que pagó".
3. **La tasa de utilización** usa como denominador los créditos **otorgados** (`compra +
   regalo`). Correcto para medir si las alumnas usan lo que tienen, y así está rotulado.
4. **Alumnas activas y en riesgo** cuentan a quien tiene crédito vigente, venga de donde venga.
   Una alumna de septiembre con regalo cuenta como activa, que es lo que es.
5. **Conciliación libro ↔ lotes**: el regalo escribe en los dos lados, así que sigue cuadrando.
   Por eso el lote y el movimiento van en la misma transacción.

## 8. Reglas de negocio

1. **Un regalo es un lote y un movimiento, nunca una edición del saldo** (`ARCHITECTURE.md`).
2. **Motivo obligatorio y autor registrado.** Sin las dos cosas, la función no escribe.
3. **Vence como lo comprado**, contado desde el momento del regalo.
4. **Solo parrilla.** Un crédito regalado se consume igual que uno comprado, y una especial se
   paga aparte.
5. **No es venta.** Ningún indicador de ingresos ni de ventas puede moverse por un regalo (§7.3), y
   el verificador lo comprueba antes y después.

### 8.6 Decisiones (Felipe, 04/10/2026)

| # | Pregunta | Decisión |
|---|---|---|
| a | ¿De dónde sale la vigencia? | ✅ Parámetro `regalo_vigencia_dias = 60` |
| b | ¿La profesora cobra los $250 por un crédito regalado? | ✅ **Sí.** "Hizo el mismo trabajo; el costo del regalo es mío, no de ella." Queda como regla explícita en `CONTEXT.md` |
| c | ¿La alumna ve el motivo? | ✅ No |
| d | ¿Se le avisa por correo? | ✅ Sí |
| e | ¿Tope por regalo? | ✅ 20 |

**Y un cambio a la propuesta:** el pasivo no se arregla cambiándole la descripción. **Se separa en
dos números** —clases vendidas sin usar y clases regaladas sin usar— "porque miden cosas
distintas: una es plata que cobré y debo, la otra es una obligación que asumí sin cobrar. Si van
juntas, el número no me sirve para decidir nada."

La propuesta original, para el registro:

| # | Pregunta | Propuesta |
|---|---|---|
| a | **¿De dónde sale la vigencia?** | Un parámetro `regalo_vigencia_dias = 60` en `parametros`: hoy es el mismo número que los packs, y se puede cambiar sin deploy si algún día un regalo dura distinto |
| b | **¿La profesora cobra los $250 por un crédito regalado que se consume?** | Hoy el código dice que **sí**, y es coherente con "por crédito consumido". Si la respuesta es no, se resuelve en la liquidación (PRD-0010 parte 3), no en este PRD |
| c | **¿La alumna ve el motivo?** | **No**: el motivo es para el registro interno ("compensación por la clase que cancelamos") y a veces no conviene mostrarlo. Ve "N clases de regalo" y el vencimiento |
| d | **¿Se le avisa por correo?** | **Sí**, por la cola de PRD-0019: "Te regalamos N clases, valen hasta el …". Si prefieres avisar tú por WhatsApp, se deja fuera |
| e | **¿Tope por regalo?** | **20 clases**, para que un error de tipeo (200 en vez de 2) no pase. El número es tuyo |

## 9. Criterios de aceptación

- [ ] `regalar_creditos()` crea el lote y el movimiento en una transacción; si cualquiera de los
      dos falla, no queda ninguno.
- [ ] Rechaza sin motivo, con cantidad fuera de rango, a un perfil inexistente y a quien no es
      admin. Probado **con la sesión de una alumna**, no leyendo el código.
- [ ] `authenticated` no tiene `execute` sobre la función (`information_schema`).
- [ ] El lote vence a los 60 días (o lo que diga §8.6.a); el movimiento tiene `saldo_resultante`
      correcto, `motivo` y `creado_por`.
- [ ] Un doble clic no regala dos veces.
- [ ] Desde la pantalla de admin, a 375 px y en escritorio, se regala y aparece en Regalos
      recientes y en Mis reservas de la alumna.
- [ ] **Antes y después de regalar, `metricas_resumen` devuelve los mismos ingresos, compras y
      créditos vendidos**; solo cambian `regaladas` y lo que §7.3 dice que cambia.
- [ ] La alumna reserva con el crédito regalado y se descuenta.

## 10. Métrica de éxito

Que las alumnas de septiembre con saldo tengan sus clases en el sistema durante octubre **sin
ningún SQL a mano**, y que el tablero de owner de octubre no muestre un peso de ingreso que no
entró.

## 11. Riesgos y supuestos

- **Un regalo es plata que no entra**, y cada crédito regalado consumido además le cuesta $250 a
  XO (§7.3.1). La pantalla tiene que hacer visible que es un regalo; por eso el diálogo pide
  confirmar con la cantidad escrita en el botón, y la lista de regalos recientes queda a la vista.
- **RLS**: hay que **preguntarle a la base con la sesión de cada rol** si admin ve los movimientos
  de regalo y si una alumna ve solo los suyos, y comprobar también lo que no deben ver. Leer la
  política no alcanza (`CLAUDE.md`, PRD-0008 §12).
- **El doble clic** se cubre en la base y no solo deshabilitando el botón: un reenvío del
  formulario no pasa por el botón.
- **Supuesto**: el volumen es bajo (unas pocas por semana). Si llegan a ser decenas, regalar en
  lote pasa a valer la pena.

### ¿Pantalla o solo SQL por ahora?

**Recomiendo la pantalla, y no es por comodidad.** Por SQL:

- **no queda quién lo hizo**: el SQL corre como `postgres`, sin perfil, y `creado_por` es
  justamente lo que este PRD pide registrar;
- cada regalo sería **SQL suelto contra producción**, que según `CLAUDE.md` necesita tu aprobación
  caso a caso;
- con las de septiembre van a ser varias durante octubre, no una.

La pantalla es chica: un botón en una fila que ya existe, un diálogo con el patrón de la bandeja y
una lista. Si se quiere dar el primer paso más corto, el orden sería **función primero** (con su
verificación de roles), pantalla inmediatamente después, sin pasar por SQL a mano.

## 12. Notas de implementación

### Lo construido (04/10/2026)

- **Migración `20261004120000_regalar_creditos.sql`**: el parámetro, `regalar_creditos()`,
  `regalos_recientes()`, los permisos por columna de `movimientos_credito` y `metricas_resumen` con
  el pasivo por origen. Sin tablas nuevas.
- **`regalarCreditos`** (`lib/acciones.ts`): verifica sesión y rol, llama a la función con el
  actor, encola el aviso y devuelve el saldo nuevo. El vencimiento del correo se escribe con el
  día de Santiago, no el de UTC.
- **Personas** (`/admin`): columna *Clases* con el saldo vigente y el botón *Regalar*
  (`components/RegalarClases.tsx`, `<dialog>` nativo); debajo, *Regalos recientes* con motivo,
  autor, vencimiento y cuántas quedan.
- **Mis reservas**: *Clases de regalo*, sin motivo.
- **`/owner/metricas`**: *Vendidas sin usar* y *Regaladas sin usar* en vez de una sola brecha;
  *Vencidas sin usar* y *Por vencer* cuentan lo vendido y mencionan lo regalado aparte.
  `pasivoPorOrigen` (`lib/dominio/metricas.ts`, con tests) avisa si las partes no suman el total.
- **Correo `regalo`** por la cola de PRD-0019, sin motivo; no caduca (es cierto mientras las
  clases valgan).

### Lo que no estaba en el PRD y se hizo

**El motivo se le estaba exponiendo a la alumna.** La política `movimientos_propios` le deja leer
sus filas, y el grant de tabla le daba todas las columnas: el motivo de un regalo le llegaba por
la API aunque ninguna pantalla lo mostrara. Esconderlo en la pantalla no es protegerlo
(`CLAUDE.md`), así que la tabla pasó a permisos por columna —todas menos `motivo`— y admin lo lee
por `regalos_recientes()`, que verifica el rol adentro. Nada de la app leía esa columna con
sesión, y `metricas_resumen` (que corre con la de owner) solo usa `tipo`, `cantidad` y
`created_at`.

### Cómo se aplicó en staging

El `db push --dry-run` contra staging mostró **dos** migraciones pendientes: esta y
`20261002120000_fotos_profesoras.sql`, que en producción está aplicada y en staging solo se había
cargado como dato. Como `CLAUDE.md` no deja aplicar "de paso" lo que no se aprobó, **no se hizo el
push**: se ejecutó el SQL de esta migración en staging dentro de una transacción, con la conexión
que se niega a correr contra otra base. Es idempotente; el registro de migraciones de staging la
sigue mostrando pendiente hasta el próximo push normal, que no le hará daño.

De paso apareció que **el CLI toma la `SUPABASE_DB_PASSWORD` de `.env.local`, que es la de
producción**, y la intentó contra staging. Para staging hay que pasarle la de `.env.staging`
explícita.

### Verificado

- **`scripts/verificar-regalos.mjs`, nuevo: 37/37** contra staging.
  - **Permisos preguntados con la sesión de cada rol**, en transacciones revertidas: nadie con
    sesión —ni admin— llama a `regalar_creditos` directo; la alumna no lee el motivo, no ve
    movimientos ni lotes ajenos y no ve la lista de regalos; anónimo tampoco; admin y owner sí.
  - **Desde la pantalla**: el botón no se activa sin motivo; el lote nace sin compra, de la
    cantidad pedida y vence a los 60 días; el movimiento es `regalo` con su saldo, motivo y autor;
    el aviso queda en la cola; un regalo idéntico enseguida se rechaza y no crea otro lote.
  - **No es venta**, medido antes y después: ingresos del mes, compras, créditos vendidos e
    ingresos históricos **iguales**; regaladas y pasivo regalado suben 3; el pasivo vendido no se
    mueve; vendidas + regaladas = total; el libro concilia.
  - La alumna ve "3 clases de regalo" y **el motivo no aparece en ninguna parte de la página**;
    reserva y se descuenta del lote regalado; al cancelar vuelve al mismo lote.
- **`metricas_resumen` nueva contra la anterior**, en una transacción revertida y con la sesión de
  owner: **idéntica en todos los campos que ya existían**, para agosto, septiembre y octubre. Lo
  único distinto son los seis campos nuevos.
- `verificar-sitio` 148/148, `verificar-reservar` 30/30, `verificar-semana` 24/24,
  `verificar-transferencias` 34/34. `npm test` 200/200.
- **`verificar-metricas` no pasa, y no es por esto**: compara el **mes en curso** contra el
  escenario sembrado en septiembre. Hoy el mes es octubre: su "esperado" de $112.500 es el total
  sembrado de septiembre, y lo obtenido ($264.000) son las compras de prueba de octubre más la
  especial sembrada. Hay que resembrar el escenario con fechas de este mes.

### Pendiente

- **La migración a producción**, que Felipe aprueba aparte. Hasta entonces **el código no se
  mergea a `main`**: desplegarlo antes rompería Personas (`regalos_recientes` no existiría) y el
  tablero de owner (los campos nuevos llegarían vacíos).
