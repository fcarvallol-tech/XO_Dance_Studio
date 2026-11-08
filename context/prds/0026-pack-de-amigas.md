# PRD-0026 — Pack de amigas

| Campo | Valor |
|---|---|
| **Estado** | **Implementado en la rama `prd-0026-pack-de-amigas`, sin publicar.** La migración está escrita, con su `--dry-run` corrido y **sin aplicar**: se aprueba por su nombre. Diseño de Felipe (05/11/2026): este PRD lo transcribe, no lo rediscute |
| **Autor** | Claude, con el diseño de Felipe Carvallo |
| **Fecha** | 5 de noviembre de 2026 |
| **Hito** | Hito 4 — Venta |
| **PRDs relacionados** | PRD-0017 (compras y créditos) · PRD-0019 (cola de correos) · PRD-0020 (link de compra compartible) · PRD-0023 (regalar, y la separación vendidas/regaladas) · PRD-0024 (revocar) · ROADMAP, "Pedidos de Felipe…", pedido 7 |

---

## 1. Problema

La promo **ya salió** y hay gente preguntando: comprar 2 clases por **$15.000**, una para ti y una
para tu amiga. El precio ya existe, porque el pack de 2 cuesta eso. Lo que no existe es que **los dos
créditos caigan en dos cuentas distintas**. Hasta ahora se atendía a mano, regalando el crédito de la
amiga con `regalar_creditos`. Eso tiene un costo: el tablero lo cuenta como **regalado**, cuando en
realidad se vendió.

## 2. Usuario y contexto de uso

Una alumna que vio la promo en Instagram y quiere traer a una amiga. Compra desde el teléfono, con
el correo de la amiga a mano. Del otro lado, Felipe o Carla aprueban la transferencia en la bandeja,
igual que cualquier otra.

## 3. Alcance — las decisiones de Felipe

1. **Plan nuevo `pack-amigas`**: 2 clases, **$15.000** (Felipe, 07/11/2026; era $15.000: a $7.500 la clase contra $8.500 la suelta se lee como promo, y a $15.000 casi no se notaba), `vigencia_dias` 30, activo. Se llama **"Pack de
   amigas"**, que es como ya circula la promo (lo elegí yo, §8.6).
2. **En la compra, un campo para el correo de la amiga**, obligatorio para este plan y solo para
   este.
3. **"Continuar" no avanza si el correo no corresponde a una cuenta existente.** Se valida en el
   servidor, nunca solo en el cliente. Hasta que se valida **no se muestran los datos para
   transferir**: así nadie transfiere y se entera después.
4. **El aviso de que la amiga tiene que tener cuenta se ve antes de elegir el plan**: en la vitrina
   `/comprar`, en la página `/comprar/pack-amigas` y, otra vez, en el paso de transferir.
5. **Nunca se muestra el nombre ni ningún dato de la amiga** a quien compra. Solo "tiene cuenta" o
   "no tiene cuenta", con **límite de intentos** (§8.5).
6. **Se rechaza el correo de la propia compradora.**
7. `compras` lleva a la amiga en una **columna nueva anulable** (`perfil_invitada_id`, con FK a
   `perfiles`), no en la nota.
8. **Al aprobar se crean dos lotes**, uno por perfil, con el mismo `compra_id`, una clase cada uno, los
   dos con 30 días desde la aprobación, **en una sola transacción**. También van dos movimientos tipo
   `compra`.
9. **A la amiga le llega un correo** cuando su clase aterriza, **por la cola de PRD-0019**.
10. Anular, rechazar y el link de PRD-0020: ver §6.
11. **`metricas_resumen` lo cuenta como una compra de $15.000 y dos créditos vendidos.** No cambia, y
    está comprobado (§12).

## 4. Fuera de alcance

- **Créditos atados a una clase**: decidido el 04/11 que va por la vía simple, con créditos normales
  en dos cuentas.
- **Invitar a alguien sin cuenta** o crearle la cuenta desde la compra.
- **Que la amiga vea la compra.** Ve su lote como cualquier otro. La compra sigue siendo de quien
  pagó.
- Un pack para tres o más. El modelo lo permite (`clases_para_invitada` es un número), pero no se
  construye.
- **Anular desde la pantalla.** Hoy nada en el sitio anula una compra. Ver §6.

## 5. Flujo principal

1. Ana ve en `/comprar` el "Pack de amigas" con su aviso: *"Tu amiga tiene que tener cuenta en XO: te
   pedimos su correo al comprar."*
2. Abre `/comprar/pack-amigas`. El mismo aviso, más grande, está antes del botón.
3. Aprieta **Comprar**, entra con su sesión y llega a `/transferir/pack-amigas`.
4. **Paso 2 · Tu amiga**: escribe el correo de Bea y aprieta **Continuar**. El servidor contesta solo
   "tiene cuenta".
5. Recién ahí aparecen **3 · Transfiere** (los datos de la cuenta) y **4 · Avísanos**.
6. Transfiere y aprieta **Ya transferí**. El servidor **vuelve a buscar** a Bea, y la compra queda
   pendiente con Bea congelada en ella.
7. Felipe aprueba en la bandeja, donde ve "1 clase para su amiga: Bea". En una transacción:
   - se crean dos lotes de una clase, los dos con vencimiento a 30 días;
   - se registran dos movimientos tipo `compra`.
8. Le llegan dos correos: a Ana, *"Quedaste con 1 clase… la otra ya quedó en la cuenta de tu
   amiga"*; a Bea, *"Ana te dejó una clase en XO"*. Los dos van por la cola.

## 6. Casos borde y errores

| Caso | Qué pasa |
|---|---|
| El correo no tiene cuenta | "Ese correo no tiene cuenta en XO. Pídele a tu amiga que se cree una…". No avanza y no se ven los datos para transferir |
| Es el correo de la compradora | "Ese es tu propio correo. El pack es para ti y otra persona." No cuenta como intento |
| Mayúsculas o espacios en el correo | Se ignoran: `Bea@XO.test ` encuentra a `bea@xo.test` |
| Pasó el límite de intentos | "Hiciste demasiadas consultas seguidas. Espera un rato o escríbenos por WhatsApp" |
| Cambia el correo después de validarlo | Vuelve al paso 2: los datos para transferir se esconden hasta validar de nuevo |
| Alguien declara el plan por la API saltándose la página | **Se rechaza.** `authenticated` no tiene permiso de insert sobre `perfil_invitada_id`, y un disparador exige la amiga para este plan |
| Se intenta cambiar la amiga de una compra ya declarada | **Se rechaza**, con o sin aprobación. Queda congelada, como el monto |
| La amiga borró su cuenta entre la declaración y la aprobación | `acreditar_compra` **no acredita nada** y lo dice. La compra sigue pendiente: se rechaza o se resuelve a mano |
| **Se rechaza antes de aprobar** | Igual que cualquier compra: `rechazar_compra` cambia el estado y **no hay lote para nadie**. A Ana le llega el correo de rechazo; a Bea, nada, porque nunca hubo algo suyo |
| **Se anula la compra (`deleted_at`) después de aprobada** | Ver abajo |
| Aprobar dos veces | Idempotente, como antes: siguen dos lotes, y la clave del correo de Bea es su lote, así que el correo sale una vez |
| **Link compartible de PRD-0020** | **Funciona sin excluirlo.** `/comprar/pack-amigas` resuelve como cualquier oferta, porque toda oferta sale de un plan activo. Quien llega por el link sin sesión entra y vuelve a la misma oferta. `/admin/planes` lo lista con su link como a los demás |

### Anular una compra aprobada

**Esta migración no agrega ningún candado.** Nada en el sitio anula una compra: `deleted_at` se
escribe a mano en el Table Editor y no toca ningún lote, así que una compra "anulada" deja sus clases
vivas y reservables. Pasa con cualquier pack, no solo con este, y **sigue igual después de aplicar
esta migración sola**.

"Los dos lotes o ninguno" lo garantiza el disparador `compras_anular_sin_clases_vivas`, que **se
movió a PRD-0024** (Felipe, 05/11/2026). Es un candado sobre todas las compras y su remedio es la
revocación: en esta migración, sin revocar aplicada, habría dejado a Felipe sin poder anular
ninguna compra con créditos vivos y sin herramienta para quitarlos, que es lo que hace hoy a mano
para corregir ingresos.

**Con PRD-0024 aplicado**, anular un pack de amigas aprobado es: quitar las clases de los dos lotes
con la revocación y después marcar la compra. Ver PRD-0024 §6.

### Las migraciones son independientes

`20261105120000_pack_de_amigas.sql` y `20261105130000_revocar_creditos.sql` **no dependen una de la
otra** y se pueden aplicar en cualquier orden, o una sin la otra. Comprobado en la base local: cada
una sola y las dos juntas, en los dos órdenes, con sus escenarios. El disparador solo lee
`creditos.compra_id`, que existe desde PRD-0017.

## 7. Modelo de datos

Migración `20261105120000_pack_de_amigas.sql`.

| Qué | Cambio |
|---|---|
| `planes.clases_para_invitada` | `int not null default 0`, entre 0 y `cantidad_clases − 1`. Hoy 0 en todos los planes y 1 en `pack-amigas` |
| `planes` (fila nueva) | `pack-amigas` · "Pack de amigas" · 2 clases · $15.000 · 30 días · `orden` al final · activo · 1 para la amiga |
| `compras.perfil_invitada_id` | `uuid` anulable, FK `compras_perfil_invitada_id_fkey` → `perfiles`, con nombre fijo porque PostgREST lo necesita para el embed |
| `compras.cantidad_invitada` | `int not null default 0`. **Congelado al declarar**, como el monto: si mañana el plan cambia, la compra no se recalcula |
| Checks en `compras` | Sin amiga → `cantidad_invitada` = 0. Con amiga → al menos una clase para cada una. La amiga ≠ quien paga |
| Disparador `compras_invitada_cuadra` | Al insertar, el plan con amiga exige amiga y el plan sin amiga la prohíbe. Al actualizar, la amiga no cambia |
| `consultas_invitada` | Una fila por pregunta: quién, cuándo y si había cuenta. **No guarda el correo consultado.** RLS activo, sin políticas ni grants para sesiones |
| `parametros` | `invitada_consultas_por_hora` = 5 · `invitada_consultas_por_dia` = 10 |
| `buscar_invitada(actor, correo) → uuid` | `security definer`, solo `service_role`. Rechaza el propio correo y el exceso de intentos. Si no, **registra el intento** y devuelve el perfil o null |
| `declarar_pack_amigas(actor, plan, monto, correo, titular, nota) → jsonb` | `security definer`, solo `service_role`. Vuelve a buscar a la amiga, **y cuenta**. Crea la compra con la amiga congelada |
| `acreditar_compra` | Copia exacta de la versión de 20260910120000. **Solo cambia el camino de los packs**: lote de quien paga con `cantidad_clases − cantidad_invitada`, lote de la amiga con `cantidad_invitada`, mismo vencimiento y dos movimientos `compra`. Sin amiga, es lo de siempre |

**Por qué no `regalar_creditos()` para la amiga:** dejaría su lote sin compra, y el tablero lo
contaría como regalado. Es justo la separación vendidas/regaladas que Felipe pidió el 04/10. Con el
mismo `compra_id`, los dos créditos son vendidos y la plata queda en un solo lugar.

**RLS** (preguntado con cada sesión en la base local, §12):

- **Ana** ve su compra y su lote, y no ve el lote de Bea.
- **Bea** ve su lote y **no ve la compra**.
- **Otra alumna** no ve nada de esto.
- **Una sesión no puede llamar** a `buscar_invitada` ni leer `consultas_invitada`, y **anon
  tampoco**.

## 8. Reglas de negocio

1. Una compra, un monto, una aprobación. Los lotes son tantos como dueñas tenga.
2. Las clases de la amiga son **vendidas**, no regaladas.
3. **El servidor no le dice a la compradora nada de la amiga** más allá de "tiene cuenta".
4. La amiga y cuántas clases le tocan **se congelan al declarar**.

### 8.5 El límite de intentos

**5 preguntas por hora y 10 por día, por cuenta compradora.** Viven en `parametros` y se pueden
ajustar sin migración.

- **Cuentan todas las preguntas**, encuentren o no una cuenta. Si contaran solo los "no", probar
  correos que sí existen saldría gratis.
- **Declarar también cuenta.** El servidor vuelve a buscar a la amiga al declarar, y si eso no
  contara, declarar sería una forma de preguntar sin límite.
- **Una compra normal gasta dos**: comprobar el correo y declarar. Con 5 por hora alcanza para
  equivocarse escribiendo el correo dos veces y terminar la compra. Lo que no alcanza es para ir
  probando una lista.
- **El propio correo no cuenta**, porque no dice nada que ella no sepa.
- **No se guarda el correo consultado.** Para el límite basta saber que se preguntó, y un registro de
  correos de menores que alguien tecleó sería un dato personal más que cuidar.
- **Las preguntas de una misma cuenta se serializan** con un `for update` sobre su perfil. Así, dos
  pestañas no pueden pasarse del límite leyendo el conteo al mismo tiempo.

### 8.6 Decisiones que tomé yo (Felipe las revisa)

| # | Qué | Lo que elegí, y por qué |
|---|---|---|
| a | Nombre visible del plan | **"Pack de amigas"**: es como ya circula la promo |
| b | Dónde va en la vitrina | **Al final** del orden, para no mover lo que ya se ve |
| c | El límite de intentos | **5 por hora y 10 por día**, en `parametros`, §8.5 |
| d | Anular una compra aprobada con clases vivas | **Movida a PRD-0024** (Felipe, 05/11/2026): se rechaza para cualquier compra, pero el candado se aplica junto a la revocación. §6 |
| e | Qué dice el correo a la amiga | **El nombre de pila de quien compró**, escapado. Sin él parece un correo cualquiera. Nada más de ella: ni correo ni apellido |
| f | Qué dice el correo a quien compró | "Quedaste con 1 clase… La otra clase del pack ya quedó en la cuenta de tu amiga". **Sin el nombre de la amiga**, que ella ya conoce |
| g | Validar con "Continuar" en vez de mientras escribe | **Con botón.** Validar mientras escribe gastaría un intento por letra |

## 9. Criterios de aceptación

- [x] El plan existe con 2 clases, $15.000, 30 días y 1 para la amiga, y anon lo ve. *Base local.*
- [x] Correo de la propia compradora: rechazado. Sin cuenta: no. Con cuenta: sí, sin importar
      mayúsculas ni espacios. *Base local.*
- [x] El 6.º intento en una hora y el 11.º en el día se rechazan. *Base local.*
- [x] Declarar el plan de amigas por la API, sin la función, se rechaza. Nombrar la amiga en un
      insert directo: sin permiso. *Base local, con sesión de alumna.*
- [x] Aprobar crea **dos** lotes con el mismo `compra_id` y una clase cada uno, el mismo vencimiento a
      30 días, y dos movimientos `compra` con el saldo de cada dueña. Libro = lotes. *Base local.*
- [x] Aprobar dos veces no duplica nada. *Base local.*
- [x] `metricas_resumen`: **1 compra, $15.000, 2 vendidas, 0 regaladas**, y `por_plan` muestra
      `pack-amigas` con 1 compra. *Base local, con sesión de owner.*
- [x] Rechazar antes de aprobar: ningún lote. Anular una compra pendiente: se puede. *Base local.*
- [x] Un pack de 2 normal sigue funcionando igual: un lote de 2. *Base local.*
- [x] `--dry-run` contra producción: **solo** `20261105120000_pack_de_amigas.sql`.
- [ ] **Desde la página, en staging**:
  - comprar el pack de amigas con un correo sin cuenta: no ve los datos para transferir;
  - con un correo con cuenta: los ve, declara y aprueba;
  - llegan los dos correos;
  - Bea ve su clase en Mis reservas y puede reservar con ella.

  *No se pudo hacer esa noche: tocar staging estaba prohibido.*
- [ ] El aviso de la vitrina y de la oferta, mirado a 375 px. *Ídem.*

## 10. Métrica de éxito

Que el pack se venda sin intervención a mano y que el tablero muestre cada uno como una venta de
$15.000 y dos clases vendidas.

## 11. Riesgos y supuestos

- **Orden de publicación:** la migración va **antes** que el código. Si el código se publica primero:
  - `/comprar` no se cae: `getPlanes` lee sin la columna nueva si no existe, y todos los planes quedan
    como packs normales;
  - **la bandeja de compras sí falla**, porque pide `cantidad_invitada` y la amiga.
- **El correo de la amiga** usa el nombre de pila de quien compró. Si alguien escribe el correo de
  una desconocida, esa persona recibe un correo con ese nombre. El riesgo es bajo: hay que pagar
  $15.000 para mandarlo.
- **`saldo_creditos` no está abierta a una sesión.** La amiga ve su saldo sumando sus lotes, como
  todas.
- **Hallazgo de paso, no arreglado:** las plantillas de correo anteriores interpolan el nombre de la
  propia destinataria **sin escapar HTML**. Es su propio nombre, así que el riesgo es mínimo, pero no
  es lo correcto. La plantilla nueva sí escapa, porque pone el nombre de **otra** cuenta.

## 12. Notas de implementación

**05/11/2026, rama `prd-0026-pack-de-amigas`.**

| Fase | Qué | Estado |
|---|---|---|
| 1 | Migración `20261105120000_pack_de_amigas.sql` | ✅ Escrita · `--dry-run` contra producción lista solo esta · **sin aplicar** |
| 2 | Escenario en la base local (`scripts/base-local/escenario-pack-amigas.mjs`) | ✅ **30 de 30 pasos** (eran 33: los tres de anular con clases vivas se fueron con el candado a `escenario-revocar.mjs`) |
| 3 | Plan y oferta llevan `clasesParaAmiga`. Vitrina y página de la oferta muestran el aviso antes de elegir | ✅ |
| 4 | `FormularioTransferencia`: el paso "Tu amiga", con los datos para transferir escondidos hasta validar | ✅ |
| 5 | Acciones: `comprobarAmiga`, `declararTransferencia` con la amiga, `aprobarCompra` con dos lotes y dos correos | ✅ |
| 6 | Plantilla `creditoDeAmiga` en la cola de PRD-0019 · el correo de aprobación dice que la otra clase fue a la amiga | ✅ |
| 7 | Bandeja de admin: "1 clase para su amiga: <nombre>" | ✅ |
| 8 | Prueba desde la página en staging, con los dos correos | ⏳ Necesita la migración en staging, con aprobación |

**Lo que dijo `metricas_resumen`** en el escenario del 05/11, con sesión de owner, cuando el pack costaba $16.000:

```json
{"venta":{"compras":1,"ingresos":16000},"creditos":{"vendidas":2,"regaladas":0},"conciliacion":{"libro":2,"lotes":2},"con_compra":1}
```

`con_compra` es 1 porque cuenta a **quien compró**, no a la amiga, y es lo correcto: la amiga no
compró. Si mañana interesa saber cuántas llegaron por un pack de amigas, eso se cuenta desde
`compras.perfil_invitada_id`.

**Corregido de paso en `aprobarCompra`:** el vencimiento del correo de aprobación se leía con
`.eq("compra_id").maybeSingle()`. Con dos lotes por compra eso da error, y el correo habría dicho
un vencimiento genérico. Ahora busca el lote de cada una.

### 12.1 Prueba en producción, 08/11/2026

Felipe compró desde la página con su cuenta de owner, y la amiga fue `felipe@motex.ai`. **No se
usaron** los alias que se habían acordado.

- **Correo inexistente bloqueado, y el aviso aparece antes de elegir el plan.** Lo vio Felipe en la página.
- **Lotes.** Quedaron dos lotes con el mismo `compra_id`, uno en cada cuenta, de 1 clase cada uno, con su movimiento `compra`, $15.000 y vencimiento exacto a 30 días de la aprobación.
- **Correo a la amiga (`creditoDeAmiga`).** Llegó a la bandeja de entrada **2 segundos después de aprobar**, desde `XO Dance Studio <hola@xodancestudio.cl>`.
  - Asunto: "Felipe te dejó una clase en XO".
  - Cuerpo: "Prueba test, Felipe compró el pack de amigas y una de las clases es para ti. Ya está en tu cuenta… Vale hasta el martes 8 de diciembre".
  - Trae el botón "Reservar mi clase".
- **El copy del correo se queda así.** Saluda con el nombre del perfil de la amiga y nombra a la compradora por su primer nombre. Felipe lo revisó el 08/11.
- **Anular antes de revocar falló, como debía.** El candado respondió: "Esta compra todavía tiene 2 clases sin usar en sus lotes".
- 🔴 **El botón del correo, sin sesión, no vuelve a reservar.** Se probó con un navegador limpio, sin cookies, y el camino fue:
  1. `/reservar` responde 307 a `/entrar?volver=%2Freservar`.
  2. Se pide el enlace con el correo de la amiga.
  3. El correo del enlace llega **sin `volver`**: `/auth/confirmar?token_hash=…&type=magiclink`.
  4. Al abrirlo, va a `/entrar` y después a **`/mis-clases`**, no a `/reservar`.

  La amiga queda dentro y ve "CLASES DISPONIBLES 2", pero tiene que buscar el botón Reservar de nuevo. Además, el correo del enlace llega con asunto en inglés, **"Your sign-in link"**: el cuerpo está en español, pero el asunto es la plantilla de Supabase.
- **Lo que la amiga ve en `/mis-clases`.** El crédito del pack suma en el total ("2"), pero **no aparece explicado en ninguna parte**:
  - "Clases de regalo" lista solo el regalo del 3/11;
  - "Tus compras" lista solo lo que compró ella.

  Una amiga sin otros créditos vería "1" sin saber de dónde viene.
- **Revocar descuenta del lote que vence primero (PRD-0024), no del lote del pack.** En una amiga que ya tenía un regalo, quitar 1 se lleva el regalo, que vence el 3/12, y el lote del pack queda vivo. Para anular la compra hay que quitarle todo lo vigente.

