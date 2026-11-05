# PRD-0027 — La clase recuperativa

| Campo | Valor |
|---|---|
| **Estado** | **Implementado en la rama `prd-0027-clase-recuperativa`, sin publicar.** Felipe pidió escribirlo e implementarlo el 05/11/2026. Migración escrita, con `--dry-run`, **sin aplicar**. Depende de la migración de la liquidación (§7) |
| **Autor** | Claude, con el diseño de Felipe Carvallo |
| **Fecha** | 5 de noviembre de 2026 |
| **Hito** | Hito 4 — Portales (administración) |
| **PRDs relacionados** | PRD-0010 parte 3 (liquidación) · PRD-0019 (cola de correos) · PRD-0018 (especiales) · PRD-0021 (el cupo sale de la sala) |

---

## 1. Problema

Una clase que no se dicta se tiene que recuperar, y hoy no hay cómo ponerla en el calendario. La
liquidación cuenta con eso: "se paga una sola vez, en la recuperación". Sin recuperación, la clase
del 3/11 de Pau queda sin fecha y las dos alumnas que perdieron su lugar no se enteran de nada.

## 2. Usuario y contexto de uso

Felipe o administración, desde `/admin/recuperativas`, cuando ya se acordó la fecha con la profesora
y la sala. Una vez cada tanto, con tiempo. Las alumnas la ven después en el calendario y por correo.

## 3. Alcance

1. Una pantalla que lista las clases caídas de los últimos 60 días y crea su recuperativa con
   **fecha, hora, sala y profesora**.
2. La sala puede ser otra. **El cupo sale de `sedes.capacidad`**, no se escribe.
3. La profesora puede ser otra. Se le paga a quien dictó (decisión 3 del 04/11).
4. **Un correo a las que tenían reserva**, por la cola de PRD-0019. No se reserva por ellas.
5. **Una sola recuperativa en pie por clase caída.**
6. En los calendarios se ve como lo que es: **"Reggaeton Femme · Recuperativa"**, en el público, en
   el de la alumna, en la página de reservar y en el portal de la profesora.

## 4. Fuera de alcance

- **Cancelar una recuperativa desde la pantalla.** Se cancela como cualquier clase hoy. El modelo ya
  lo aguanta: la original vuelve a la lista (§6).
- **Las pantallas de la liquidación** (paso E): la causa se registra con `registrar_no_dictada`.
- **Avisarles a las que ya no tenían reserva**, o a quienes cancelaron solas.
- **Reintentar a mano el aviso** si el proceso muere entre crear la clase y encolar los correos
  (§11).

## 5. Flujo principal

1. En `/admin/recuperativas`, Felipe ve la clase caída, su causa y cuántas alumnas tenían reserva.
2. Aprieta "Crear recuperativa", elige fecha y hora, y deja o cambia sala y profesora. La pantalla
   muestra el cupo de la sala elegida.
3. Si choca, el diálogo lo dice en palabras y se corrige ahí mismo.
4. Se crea la clase y la pantalla dice a cuántas se les avisó. La clase pasa a "Programadas".
5. A las alumnas les llega el correo con el botón "Reservar mi lugar". Reservan con la clase que se
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

`clases` sigue pública entera. `recupera_clase_id` deja ver que una clase recupera a otra, nada más:
la causa sigue en `causas_de_clase`.

## 8. Reglas de negocio

1. Se reserva con créditos, por `reservar()`, que no se tocó.
2. Se paga como cualquier dictada, a quien dictó. La original no paga, salvo
   `profesora_se_presento` (PRD-0010 parte 3 §6.6).
3. Dura lo que duraba la original.
4. La hora se escribe en hora de Santiago y se convierte en la base, igual que `generar_clases()`.

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
- [ ] **Desde la página, en staging**, a 375 px y en escritorio: crear, ver el choque en palabras, ver
      la etiqueta en los calendarios, recibir el correo y reservar desde su botón. *Necesita las dos
      migraciones en staging, con aprobación.* **La pantalla compila pero nadie la ha abierto**, y sus
      lecturas por PostgREST, con los embeds de `causas_de_clase` y `original:recupera_clase_id`,
      tampoco están probadas: la base local no tiene PostgREST.

## 10. Métrica de éxito

Que ninguna clase caída que corresponda recuperar pase un mes en "Por recuperar", y que las dos
alumnas del 3/11 tengan fecha antes de que venza su crédito, el 03/12.

## 11. Riesgos y supuestos

- **Orden de publicación: las dos migraciones, después el código.** Los calendarios piden
  `recupera_clase_id`: con el código antes, `/calendario` y `/reservar` muestran error de lectura. Se
  ve en el build de esta rama contra staging: `column clases.recupera_clase_id does not exist`.
- 🔴 **Una hora rara se dibuja corrida.** La grilla ubica en tramos de 30 minutos: una recuperativa a
  las 14:50 sale a las 15:00. El arreglo está en `grilla-filas-de-cinco-minutos`, sin mergear hasta
  que "exista una clase a una hora rara". Esta pantalla la hace posible: la hora admite pasos de 5
  minutos.
- ⚠️ **La sala de la recuperación.** `CONTEXT.md` dice que la sala se cobra cuando se recupera; el
  ROADMAP y PRD-0010 parte 3 dicen que la sala de la recuperación no se cobra. Hoy
  `/owner/finanzas` le carga `sedes.costo_hora_clp` como a cualquier clase. No lo toqué: hay que
  decidirlo.
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
| 3 | `/admin/recuperativas`, `CrearRecuperativa`, acción `crearRecuperativa` | ✅ Compila · ⏳ sin abrir |
| 4 | Plantilla `recuperativa` en la cola de PRD-0019 | ✅ · ⏳ sin enviar |
| 5 | `tituloDeClase()` en los calendarios, y `nombreDeLaClase` en el portal de la profesora | ✅ |
| 6 | Prueba desde la página en staging | ⏳ Necesita las dos migraciones |

**Lo que encontró el escenario:** `v_viva is not null` sobre una fila es verdadero solo si **todas**
sus columnas están llenas, y una clase de parrilla tiene `titulo` nulo. La revisión de "ya tiene
recuperativa" no se disparaba nunca y lo frenaba el índice, con un mensaje sin la fecha. Quedó
`v_viva.id is not null`.
