# PRD-0027 — La clase recuperativa, el selector de categoría y "otra sala"

| Campo | Valor |
|---|---|
| **Estado** | **Implementado en la rama `prd-0027-clase-recuperativa`, sin publicar.** Felipe pidió escribirlo e implementarlo el 05/11/2026 y lo amplió el 06/11 (§3.1). Dos migraciones, sin aplicar en producción. La de la recuperativa depende de la liquidación (§7.2); la de las salas no depende de nada |
| **Autor** | Claude, con el diseño de Felipe Carvallo |
| **Fecha** | 5 de noviembre de 2026 · ampliado el 6 de noviembre |
| **Hito** | Hito 4 — Portales (administración) |
| **PRDs relacionados** | PRD-0010 parte 3 (liquidación) · PRD-0019 (cola de correos) · PRD-0018 (especiales) · PRD-0021 (el cupo sale de la sala) |

---

## 1. Problema

Una clase que no se dicta se tiene que recuperar, y hoy no hay cómo ponerla en el calendario. La
liquidación cuenta con eso: "se paga una sola vez, en la recuperación". Sin recuperación, la clase
del 3/11 de Pau queda sin fecha y las dos alumnas que perdieron su lugar no se enteran de nada.

## 2. Usuario y contexto de uso

Felipe o administración, desde `/admin/especiales/nueva`, cuando ya se acordó la fecha con la
profesora y la sala. `/admin/recuperativas` muestra lo que falta y lleva ahí con la clase elegida.
Una vez cada tanto, con tiempo. Las alumnas la ven después en el calendario, como una clase más, y
las que perdieron la clase se enteran por correo.

## 3. Alcance

1. **No hay pantalla propia para crearla.** Se generaliza `/admin/especiales/nueva`, con un selector
   de categoría arriba (§3.1). `/admin/recuperativas` queda como lista: lo que falta por recuperar y
   lo programado.
2. Pide **qué clase no dictada recupera, fecha, hora, sala y profesora**, y esconde los campos de
   marketing: canción, dificultad, descripción, Reel, precio y mínimo de alumnas.
3. La sala puede ser otra, o una arrendada (§7.5). **El cupo sale de `sedes.capacidad`**, no se
   escribe.
4. La profesora puede ser otra. Se le paga a quien dictó (decisión 3 del 04/11).
5. **Un correo a las que tenían reserva**, por la cola de PRD-0019. No se reserva por ellas.
6. **Una sola recuperativa en pie por clase caída.**
7. **Para la alumna no dice "recuperativa".** Es una clase y se inscribe: sale en los calendarios con
   el nombre del curso, sin marca. La profesora sí lo ve en su portal.
8. **El cupo es primero que llegue** (Felipe, 06/11/2026): cualquiera con crédito puede tomarla, no
   solo las afectadas. Por eso a las que perdieron la clase **hay que avisarles por correo**: el
   calendario no se las va a señalar y no saben que apareció.

### 3.1 🔴 La categoría no es una etiqueta (Felipe, 06/11/2026)

Dos opciones hoy: **"Recuperativa"** y **"Clase especial / intensivo"**. Define tres cosas, y es donde
un error cuesta plata:

| | Recuperativa | Clase especial / intensivo |
|---|---|---|
| **Con qué paga la alumna** | Con el crédito que le devolvimos | Con plata |
| **Cómo cobra la profesora** | Como clase normal: base más variable | 50% de lo recaudado menos la sala, sin base ni variable |
| **Si cuelga de un horario semanal** | Sí: el mismo `horario_id` de la clase caída | No |

Las tres viven en `lib/dominio/categorias-clase.ts`. **Una tercera categoría es un caso más ahí**, y
TypeScript obliga a contestar las tres preguntas. El selector **empieza sin elegir, a propósito**: un
valor por defecto decidiría cómo se paga una clase sin que nadie lo mire.

## 4. Fuera de alcance

- **Tocar el calendario.** Ya muestra las especiales publicadas y las de parrilla: no se cambió.
- **Editar o retirar una sala arrendada desde una pantalla.**
- **Cancelar una recuperativa desde la pantalla.** Se cancela como cualquier clase hoy. El modelo ya
  lo aguanta: la original vuelve a la lista (§6).
- **Las pantallas de la liquidación** (paso E): la causa se registra con `registrar_no_dictada`.
- **Avisarles a las que ya no tenían reserva**, o a quienes cancelaron solas.
- **Reintentar a mano el aviso** si el proceso muere entre crear la clase y encolar los correos
  (§11).

## 5. Flujo principal

1. En `/admin/recuperativas`, Felipe ve la clase caída, su causa y cuántas alumnas tenían reserva.
2. Aprieta "Ponerle fecha" y llega a `/admin/especiales/nueva`, con la categoría y la clase elegidas.
   También puede entrar directo y elegirlas ahí.
3. Elige fecha y hora, y deja o cambia sala y profesora. La pantalla muestra el cupo de la sala.
4. Si la sala no está, elige "Otra sala…" y la carga (§7.5).
5. Si choca, la pantalla lo dice en palabras y se corrige ahí mismo.
6. Se crea la clase y `/admin/recuperativas` dice a cuántas se les avisó.
7. A las alumnas les llega el correo con el botón "Reservar mi lugar". Reservan con la clase que se
   les devolvió, por el camino de siempre.

## 6. Casos borde y errores

| Caso | Qué pasa |
|---|---|
| **El mismo día que otra clase del horario**, aunque sea a otra hora o esté cancelada | Rechaza, y la pantalla lo explica. Es el único de `(horario_id, fecha)` |
| **El día regular del horario, más allá de lo ya generado** | Rechaza. Ver §7.3: si no, la clase regular de esa fecha dejaría de generarse, en silencio |
| Sala o profesora ocupadas a esa hora | Rechaza, con `solape_de_especial()`, que ya existía |
| Fecha pasada · clase en pie · clase especial | Rechaza |
| Ya tiene recuperativa en pie | Rechaza y dice cuándo es |
| **La recuperativa también se cae** | Las alumnas recuperan su crédito como siempre y la original vuelve a la lista. Se crea otra **desde la original**. El correo va también a las que habían reservado la recuperativa caída, sin repetir a nadie |
| Se elige una recuperativa caída como original | Rechaza: se parte de la original. No hay cadenas |
| El mes de la clase caída ya se le pagó | Rechaza: va como ajuste, igual que `marcar_recuperacion` |
| **Una alumna canceló sola antes de que la clase cayera** | **No recibe correo**, aunque su reserva se ve igual (§7.4) |
| Una alumna ya tiene vencida la clase devuelta | El diálogo lo avisa: hay que regalarle una. `reservar()` mira el vencimiento al reservar, no la fecha de la clase, así que un lote que vence antes de la clase sirve si reserva a tiempo |
| Nadie tenía reserva | Se crea igual, y la pantalla dice que no salió ningún correo |
| **Dirección de una sala que ya existe** | No crea: ofrece esa, con "Usar esa sala" o "Es otra sala" (§7.5) |
| **Dirección de una sala retirada** | Rechaza: volver a activarla es una decisión, no un efecto de esta pantalla |
| Sala nueva sin capacidad o sin precio | No se guarda. El botón no se habilita, y la base lo rechaza igual |
| Dos pestañas a la vez | Gana una. La otra recibe el mismo mensaje en palabras, no un error de base |
| `cambio_de_parrilla` | No se ofrece: esa clase nunca estuvo en su semana |

## 7. Modelo de datos

### 7.1 Tu lectura del esquema, confirmada contra el código

| Lo que dijiste | Resultado |
|---|---|
| Una fila de `clases` de tipo `parrilla`, mismo `horario_id`, otra fecha. No es especial | ✅ `reservar()` rechaza las especiales, así que el crédito devuelto no serviría ahí |
| Pasa `clases_tipo_coherente` sin tocarlo | ✅ |
| `generar_clases()` solo inserta, con `on conflict (horario_id, fecha) do nothing` | ✅ Leída en `20260926120000`, la última versión. No actualiza ni borra. El escenario la corre después de crear la recuperativa: sigue una sola, intacta, y las regulares se siguen creando. **Pero ver §7.3** |
| El único por `(horario_id, fecha)` impide caer el mismo día | ✅ Vale también para una clase cancelada, que sigue ocupando la fecha |
| La liga es `clases.recupera_clase_id` | ✅ |

### 7.2 🔴 Depende de la migración de la liquidación

`20261105150000_clase_recuperativa.sql` **depende de** `20261105140000_liquidacion_profesoras.sql`:
usa `recupera_clase_id`, el estado `no_dictada`, `mes_pagado()` y el índice de una recuperación por
clase. Sin ella aborta en su primer bloque, sin dejar nada a medias.

**El `--dry-run` lista las dos**, así que para aplicar esta hay que aprobar las dos por su nombre. La
rama sale de `prd-0010-parte-3-liquidacion` y trae sus commits. No depende del pack de amigas ni de
revocar.

### 7.3 Lo que `on conflict do nothing` esconde

No duplica ni borra, pero **tampoco avisa**. Si una recuperativa cae en el día regular del horario
más allá de los 70 días ya generados, cuando el cron llegue a esa fecha va a chocar con ella y no
va a crear la clase regular, sin error. Por eso se rechaza ese día de la semana aunque la fila
todavía no exista. Si el horario está inactivo, no hay clase regular que perder y se permite.

### 7.4 Lo que agrega la migración

| Qué | Por qué |
|---|---|
| El índice `clases_una_recuperacion_por_clase` cuenta solo las `programada` | Tal como venía, una recuperativa cancelada ocupaba el índice para siempre y la original no se podía volver a recuperar |
| `crear_recuperativa()` | Crea y liga en una transacción. Solo service role, y adentro exige admin |
| `afectadas_de_clases()` | Quiénes perdieron su lugar. Solo service role: devuelve correos |

**Por qué `afectadas_de_clases` no mira solo la reserva.** Una alumna que canceló a tiempo queda con
`estado = 'cancelada'` y `credito_devuelto = true`, igual que una a la que se le cayó la clase. Lo que
las separa es el movimiento `cancelacion` con motivo "La academia canceló la clase", que escribe
`devolver_creditos_de_clase`. Para la clase del 3/11, cancelada por esa vía, deberían salir las dos
personas: **eso no se preguntó en producción**, se ve en la pantalla al aplicar.

### 7.5 "Otra sala" (`20261106120000_salas_ocasionales.sql`)

**Una fila más en `sedes`, no un precio colgado de la clase.** Si el costo de una sala vive en dos
lugares, el margen depende de cuál lea cada pantalla: es la incoherencia que obligó a borrar
`lib/cursos.ts`. `/owner/finanzas` la costea sola, por `sedes.costo_hora_clp` de `clases.sede_id`.

| Decisión de Felipe, 06/11 | Cómo quedó |
|---|---|
| **a) La capacidad es obligatoria** | `crear_sala_ocasional()` la exige aunque la columna tenga default 22. El cupo se prellena desde la sala: fijo en la recuperativa, y en la especial se puede bajar pero no pasar de la capacidad, como ya exigía `crear_especial` |
| **b) No publicar, sin reutilizar `activa`** | Columna propia, `sedes.ocasional`. `activa = false` sigue significando "retirada" |
| **c) Comparar por dirección, no por nombre** | `direccion_comparable()`: calle y número, sin tildes, prefijos ni lo que va después del número, porque así vienen las reales ("Barros Borgoño 71, oficina 101"). Si coincide no crea y la pantalla la ofrece. "Es otra sala" crea igual, porque dos salas pueden compartir edificio |
| **d) El precio se ingresa por hora** | Como la columna. Al lado se ve cuánto costaría esa clase según su duración |

**Quién lista salas, comprobado consulta por consulta:**

| Consulta | ¿La muestra? |
|---|---|
| `getCatalogoPublico` → `/nosotros`, perfiles, ayuda, solicitudes de la profesora | **No**: filtra `ocasional = false` |
| `getCatalogoCompleto` → admin | **No**: mismo filtro |
| `getOpcionesEspecial` → el selector de sala de esta pantalla | **Sí**, marcada "(arrendada)": es como se reutiliza y se evita duplicarla |
| `finanzas-consultas` → el formulario de egresos | **Sí**, a propósito: el arriendo es un egreso de esa sala. Solo admin y owner |
| `/calendario`, "Dónde es cada clase" | **Sí, solo mientras tenga una clase**: sale de las clases de la semana, y quien reserva necesita saber dónde es |

⚠️ **Eso significa que la fila de una ocasional es pública por la API**: nombre y dirección, igual que
la dirección de la clase en el calendario. RLS no la filtra, porque la clase necesita leerla. Lo
que no sale es el costo: `costo_hora_clp` sigue fuera de los permisos de columna de `anon` y
`authenticated`, la migración aborta si eso cambia, y `crear_sala_ocasional` nunca lo devuelve.

### 7.6 Los campos por categoría

`FormularioClase` elige; `FormularioRecuperativa` y `FormularioEspecial` son los casos; `SelectorSala`
es de los dos. Una recuperativa queda como fila de `clases` con `tipo = 'parrilla'`, el **mismo
`horario_id`**, otra fecha, `recupera_clase_id` a la clase caída, sin título ni slug: pasa
`clases_tipo_coherente` sin tocarlo y sale con el nombre del curso.

`clases` sigue pública entera. `recupera_clase_id` deja ver que una clase recupera a otra, nada más:
la causa sigue en `causas_de_clase`.

## 8. Reglas de negocio

1. Se reserva con créditos, por `reservar()`, que no se tocó.
2. Se paga como cualquier dictada, a quien dictó, en el mes en que se dicta. La original no paga,
   salvo `sala_no_disponible` con `profesora_se_presento` (PRD-0010 parte 3 §6.6).
3. Dura lo que duraba la original.
4. **El cupo es primero que llegue**: cualquiera con crédito la toma, y `reservar()` no distingue a
   las afectadas.
5. La sala de la recuperación se cobra: la hora perdida no nos la cobran y esta sí (Felipe, 06/11).
6. La hora se escribe en hora de Santiago y se convierte en la base, igual que `generar_clases()`.

## 9. Criterios de aceptación

**Escenario en la base local** (`scripts/base-local/escenario-recuperativa.mjs`, **24 de 24**), con
la sesión de cada rol:

- [x] Avisar: Ana y Bea sí; Cata, que canceló sola, no.
- [x] Rechaza: mismo día, otra clase del horario, día regular lejano, pasado, clase en pie, sala o
      profesora ocupadas, alumna y profesora. Ninguna sesión llama la función.
- [x] Otra sala y otra profesora: cupo de la sala, hora de Santiago, mismo horario, ligada.
- [x] No reserva por nadie, y una sola.
- [x] `generar_clases()` no la duplica ni la borra.
- [x] Ana reserva sola con `reservar()`, y el libro cuadra.
- [x] anon y alumna leen `recupera_clase_id`. `afectadas_de_clases`: nadie con sesión. La causa sigue
      sin verse para una alumna.
- [x] La liquidación: la original paga $0, la recuperativa va a Drimy y no a Pau.
- [x] Si la recuperativa se cae, el crédito vuelve, la original se recupera de nuevo y nadie se repite.
- [x] `--dry-run` contra producción: **las dos**, `20261105140000` y `20261105150000`.
- [x] Salas, `scripts/base-local/escenario-salas.mjs`, **19 de 19**: direcciones reales escritas de
      varias formas, capacidad y precio obligatorios, y por cada rol qué no puede hacer ni leer.
- [ ] **Desde la página, en staging**, a 375 px y en escritorio: crear, ver el choque en palabras, ver
      que sale con el nombre del curso, recibir el correo y reservar desde su botón. *Necesita las dos
      migraciones en staging, con aprobación.* **La pantalla compila pero nadie la ha abierto**, y sus
      lecturas por PostgREST, con los embeds de `causas_de_clase` y `original:recupera_clase_id`,
      tampoco están probadas: la base local no tiene PostgREST.

## 10. Métrica de éxito

Que ninguna clase caída que corresponda recuperar pase un mes en "Por recuperar", y que las dos
alumnas del 3/11 tengan fecha antes de que venza su crédito, el 03/12.

## 11. Riesgos y supuestos

- **Orden de publicación: las migraciones, después el código.** `/nosotros` filtra por
  `sedes.ocasional`, y sin la columna el catálogo público falla; el portal de la profesora pide
  `recupera_clase_id`. Los calendarios ya no: salió la etiqueta y con ella esa columna.
- 🔴 **Una hora rara se dibuja corrida.** La grilla ubica en tramos de 30 minutos: una recuperativa a
  las 14:50 sale a las 15:00. El arreglo está en `grilla-filas-de-cinco-minutos`, sin mergear hasta
  que "exista una clase a una hora rara". Esta pantalla la hace posible: la hora admite pasos de 5
  minutos.
- **Una migración futura que toque clases por `horario_id`** se lleva también la recuperativa. Al
  cambiar un horario hay que mirar `recupera_clase_id`.
- **`metricas_demanda` la agrupa bajo su horario**, aunque sea otro día y otra sala.
- **Si el proceso muere** entre crear la clase y encolar los correos, la clase queda y los correos no.
  La pantalla no ofrece reenviar: se resuelve a mano. Son dos o tres correos y la ventana es de
  milisegundos.
- **El correo no se reintenta después de que la clase empieza**: caduca en `inicio`, como el de
  reserva.

## 12. Notas de implementación

**05/11/2026, rama `prd-0027-clase-recuperativa`.** `reservar()` y `generar_clases()` no se tocaron.

| Fase | Qué | Estado |
|---|---|---|
| 1 | Migración `20261105150000_clase_recuperativa.sql`, escenario 24 de 24, `--dry-run` | ✅ Escrita · **sin aplicar** |
| 2 | `lib/dominio/recuperativas.ts`, con 5 tests | ✅ |
| 3 | `/admin/recuperativas` y acción `crearRecuperativa`. El diálogo `CrearRecuperativa` del 05/11 se borró el 06/11 | ✅ Compila · ⏳ sin abrir |
| 4 | Plantilla `recuperativa` en la cola de PRD-0019 | ✅ · ⏳ sin enviar |
| 5 | `nombreDeLaClase` en el portal de la profesora. **`tituloDeClase()` y "· Recuperativa" en los calendarios de la alumna salieron el 06/11**: contradecían §3.7 | ✅ |
| 6 | Selector de categoría en `/admin/especiales/nueva`: `categorias-clase.ts`, `FormularioClase`, `FormularioRecuperativa` | ✅ Compila · ⏳ sin abrir |
| 7 | "Otra sala": migración `20261106120000_salas_ocasionales.sql`, `SelectorSala`, escenario 19 de 19 | ✅ Escrita · **sin aplicar en producción** |
| 8 | Prueba desde la página en staging | ⏳ Necesita las migraciones |

**Lo que encontró el escenario:** `v_viva is not null` sobre una fila es verdadero solo si **todas**
sus columnas están llenas, y una clase de parrilla tiene `titulo` nulo. La revisión de "ya tiene
recuperativa" no se disparaba nunca y lo frenaba el índice, con un mensaje sin la fecha. Quedó
`v_viva.id is not null`.
