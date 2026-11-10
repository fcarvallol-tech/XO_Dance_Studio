# PRD-0032 — Avisarle a la alumna que se le vencen las clases

| Campo | Valor |
|---|---|
| **Estado** | ✅ **Aprobado por Felipe el 10/11/2026**, con el texto del §8.2 y **sin** distinción por grupo (el §8.4 anterior se borró). **Construido el 10/11** en la rama `prd-0032-aviso-de-vencimiento`, con la migración `20261110120000` escrita y **sin aplicar en ningún lado**. Falta: probarlo en staging con un correo real y el texto final aprobado. **Vivo el 22/11/2026** |
| **Autor** | Claude, a pedido de Felipe Carvallo |
| **Fecha** | 9 de noviembre de 2026 |
| **Hito** | Hito 2 — Venta de clases (créditos) |
| **PRDs relacionados** | PRD-0019 (la cola de correo y su barrido diario) · PRD-0017 (lotes con vencimiento) · PRD-0023 (regalos) · ROADMAP, pedido 10 (la renovación de diciembre) · `context/correo-y-preventa-09-11.md` (la cuota) · PRD-0012 (preventa, sin escribir) |

---

## 1. Problema

Al 09/11 hay **47 alumnas con 131 clases sin usar**, y **todas vencen entre el 3 y el 7 de
diciembre**. Nadie les avisa. Si se vencen, XO se queda con la plata y la alumna siente que perdió
algo, y **esa es la alumna que deja de venir**.

Los créditos del lanzamiento vencen el **3/12**, así que el aviso a 10 días sale el **23/11**, una
semana antes de la preventa del 30/11. El orden importa: **primero "ven a usar lo que tienes",
después el precio.**

## 2. Usuario y contexto de uso

La alumna, en su correo y casi siempre desde el teléfono. Lee el asunto en la bandeja y decide en
dos segundos si lo abre. Lo que tiene que entender sin abrirlo: **cuántas clases le quedan y hasta
cuándo**.

En muchos casos la cuenta es de una menor y el correo lo lee su mamá. Por eso el texto habla de
clases y fechas, y no de lo que "perderías".

## 3. Alcance

1. **Un correo 10 días antes de que venza un lote** con clases disponibles.
2. **Una sola vez por lote**, no todos los días durante diez.
   - Si la misma persona tiene dos lotes que vencen **el mismo día**, va **un solo correo** con la
     suma. La clave es `vencimiento:<perfil>:<fecha>`.
   - Si vencen en días distintos, van dos correos, cada uno en su día.
3. **Dice cuántas clases le quedan en ese vencimiento y la fecha exacta**, en hora de Chile:
   "Te quedan 3 clases. Vencen el jueves 3 de diciembre" (el 3/12/2026 es jueves; el ejemplo decía
  miércoles). **Lleva al calendario**, con un solo
   botón: "Reservar una clase".
4. **No se manda a quien ya no tiene nada disponible** en ese lote. Se mira al encolar y otra vez
   al enviar o reintentar: si las usó entre medio, la fila queda `descartado`.
5. **Va por la cola de PRD-0019** con la tarea diaria que ya existe: el barrido de `/api/correos`
   encola los avisos del día antes de reintentar. Sin cron nuevo.
6. **Solo cuentas de alumna** (`rol = 'alumna'`) y sin `deleted_at`. Las 5 profesoras con créditos
   de regalo no reciben aviso: se decidió dejar que venzan (ROADMAP, pedido 10).
7. **Recuperación si un día no corre**: si el barrido falla un día, al día siguiente encola los
   que tienen **entre 10 y 3 días** por delante y todavía no tienen aviso. Con menos de 3 días ya no
   se manda: "vencen pasado mañana" llega tarde para organizarse.
8. **Una línea en `/admin/correos`**: cuántos avisos de vencimiento salieron hoy.

## 4. Fuera de alcance

- **Un mensaje distinto según si la persona compró por la página.** No va (Felipe, 10/11): las que
  viven de créditos de regalo **sí pagaron**, antes de que existiera la página, y el crédito es XO
  honrando esa plata. Ver §8.4.
- **El precio de la preventa en el aviso.** El orden es usar primero y el precio después. Y el
  precio de diciembre no existe todavía (PRD-0012 sin escribir; `CLAUDE.md` no permite inventarlo).
- **Un segundo recordatorio** a los 3 días. Si el primero funciona, se evalúa en diciembre.
- **Extender vencimientos.** Es una decisión comercial y no la toma un correo.
- **WhatsApp o SMS.** Solo correo.

## 5. Flujo principal

1. 23/11, 03:30 de Chile: el barrido diario encuentra los lotes que vencen el 3/12 con clases
   disponibles, de cuentas de alumna.
2. Agrupa por persona y fecha. Encola una fila por grupo, con la clave `vencimiento:<perfil>:<fecha>`
   y la caducidad en el vencimiento.
3. Intenta mandarlas, como cualquier otro correo de la cola.
4. En la mañana, Camila lee: **"Te quedan 3 clases en XO: vencen el 3 de diciembre"**, y adentro,
   "Camila, te quedan 3 clases. Vencen el jueves 3 de diciembre." Aprieta "Reservar una clase" y llega a `/calendario`.
5. Reserva. La reserva genera su propio correo, como siempre.

## 6. Casos borde y errores

| Caso | Qué pasa |
|---|---|
| Usó todas sus clases entre que se encoló y se intentó | Al enviar se vuelve a mirar el saldo de ese vencimiento. Si es 0, queda `descartado` y no se manda |
| Usó una parte | El correo dice lo que le queda **al momento de enviarlo**, no al encolar. El número se calcula en el envío |
| El barrido corre dos veces el mismo día | La clave única impide el duplicado |
| Falla el envío (cuota, Resend caído) | Se reintenta con la cola de siempre. **Caduca en el vencimiento**: un aviso que llegaría después de vencer no se manda |
| Compra un pack nuevo después del aviso | El lote nuevo tiene otra fecha y tendrá su propio aviso. El saldo total no cambia lo que dice este correo, que habla de un vencimiento |
| Cuenta de prueba (`felipe@motex.ai` u otra) con rol alumna | Recibe el aviso como cualquiera. Si molesta, se le cambia el rol: no se agrega una lista de excepciones |
| Lote revocado entero (PRD-0024) | Disponible 0: no se manda |
| Vence hoy o mañana y nunca tuvo aviso | No se manda (§3.7) |

## 7. Modelo de datos

Sin tablas nuevas.

- **Plantilla nueva** `vencimientoProximo` en `lib/correo.ts`. El cuerpo depende solo de `datos`,
  como exige el barrido: `{ nombre, clases, venceAt }`.
- **Una función de la base**, `avisos_de_vencimiento_pendientes(p_hoy date)`:
  - `security definer`, con grant **solo a `service_role`**;
  - devuelve `perfil_id`, `correo`, `nombre`, `vence` (la fecha en Chile) y `clases`;
  - aplica las reglas de §3: rol alumna, disponible > 0, de 10 a 3 días y sin una fila con esa
    clave.
- **El chequeo al enviar** reusa la misma función, preguntada por una persona y una fecha.
- `caducaAt` de `lib/dominio/envios.ts` agrega el caso: caduca en el vencimiento. **Con test.**

## 8. Reglas de negocio

### 8.1 Cuándo

- **10 días antes de la fecha de vencimiento, en hora de Chile.** Un lote que vence el 3/12 a las
  12:00 avisa el 23/11.
- **Sale con el barrido de las 03:30.** Un correo de madrugada se lee en la mañana, y salir a esa
  hora gasta la cuota del día UTC en el momento de menos tráfico.

### 8.2 Qué dice

- **Asunto:** `Te quedan 3 clases en XO: vencen el 3 de diciembre`. Si es una sola, en singular.
- **Cuerpo:**
  - el nombre de pila;
  - las clases y la fecha;
  - un botón, "Reservar una clase", que lleva a `/calendario`;
  - una línea: "Si ya reservaste, ignora este correo".

  Sin urgencia inventada, sin "¡no las pierdas!" y sin cadenas de signos de exclamación.
- **El texto final lo aprueba Felipe** antes del 20/11. Va en español de Chile, escrito desde el
  lado de la alumna.

### 8.3 Una vez y no más

- La clave `vencimiento:<perfil>:<fecha>` es única en `envios_correo`: **un aviso por persona y por
  vencimiento**, pase lo que pase con el barrido.

### 8.4 Un solo mensaje para todas (Felipe, 10/11/2026)

**Todas reciben el mismo correo.** Una primera versión de este PRD proponía separar a las 25 alumnas
que "nunca compraron" y viven de créditos de regalo. **Estaba mal planteado.** Esas 25 **sí
pagaron**: lo hicieron en el modelo de mensualidad, antes de que existiera la página, y su crédito
de regalo es XO honrando esa plata. Que la base diga "sin compras" es un artefacto de que octubre no
se migró, no un hecho sobre la persona. Por eso el correo no lleva ningún dato de si compró.

## 9. Criterios de aceptación

Marcado ✅ = probado en la base local (`escenario-vencimiento.mjs`, 20 de 20) o en tests de
`lib/dominio`. **Ninguno está probado todavía contra Supabase ni con Resend**: la migración no está
aplicada en ningún lado.

- [ ] Con un lote que vence en 10 días, 2 clases disponibles y rol alumna, el barrido encola y
      manda **un** correo con "2 clases" y la fecha correcta en hora de Chile. ✅ la selección y la
      fecha; ⏳ el envío
- [x] Correr el barrido dos veces el mismo día no manda dos (la clave; local)
- [x] Dos lotes de la misma persona que vencen el mismo día: un correo con la suma. Con fechas
      distintas: dos correos, cada uno en su día (local)
- [ ] Disponible 0 al encolar: no hay fila ✅. Disponible 0 al enviar: la fila queda `descartado`
      ✅ la función responde 0 filas; ⏳ el descarte en `alEnviar`, sin probar contra la cola real
- [x] Profesora con créditos: no recibe aviso (local)
- [x] Un barrido saltado: al día siguiente se encola, con 9 días por delante. Con 2 días, no (local)
- [ ] Un fallo de Resend se reintenta, y después del vencimiento queda `descartado`. ✅ `caducaAt`
      con test; ⏳ el reintento real
- [ ] 🔴 **Probado con el correo real en staging**: un correo que alguien abre en el teléfono, con
      el botón apretado **sin sesión**. Tiene que llevar a `/calendario` y, al reservar, pedir
      entrar y volver a la clase. Es el mismo camino que falló con el pack de amigas el 08/11.
- [ ] `avisos_de_vencimiento_pendientes` no la ejecuta ninguna sesión: preguntado con la de owner,
      admin, alumna y anon. ✅ local, también profesora; ⏳ **en staging**, porque PGlite no tiene
      los privilegios por defecto de Supabase, que le dan EXECUTE a anon y authenticated
- [ ] El conteo de `/admin/correos` cuadra con las filas.
- [ ] **Vivo en producción el 22/11/2026**, con su migración aprobada por nombre.

## 10. Métrica de éxito

**De las 131 clases que vencen entre el 3 y el 7/12, cuántas se usan antes de vencer.** Hay que
medir hoy la línea base: qué fracción de los lotes que vencieron antes se usó entera.

## 11. Riesgos y supuestos

- 🔴 **Esto sube el volumen de correo justo antes de la preventa.** Con los lotes del 09/11:

  | Día del aviso | Personas | Clases |
  |---|---|---|
  | 23/11 | 28 | 69 |
  | 24/11 | 4 | 10 |
  | 25/11 | 12 | 30 |
  | 26/11 | 3 | 5 |
  | 27/11 | 3 | 12 |
  | 29/11 | 3 | 5 |
  | **Total** | **53 correos** | **131** |

  Son 53 por personas-día: una persona con lotes en dos fechas cuenta dos veces. **Ninguno cae del
  30/11 al 2/12.** El 23/11 es el día más alto: 28 más los 20 a 45 de un día normal, lejos del
  techo. **El efecto que sí pesa es el indirecto:** cada clase que se reserva por el aviso es un
  correo de reserva, y muchas van a caer del 30/11 al 2/12, encima de la preventa. Está en la cuenta
  de `context/correo-y-preventa-09-11.md`.
- **Supuesto:** que el 23/11 la cuota ya esté resuelta. Si el plan se paga desde el 23/11, este
  riesgo desaparece.
- **Supuesto:** que la cola de PRD-0019 aguante 28 envíos seguidos sin pasar el límite por segundo
  de Resend. El barrido manda de a uno, en serie, así que debería aguantar. Se comprueba en staging
  con 30 filas.
- **Riesgo de calendario:** está pedido para después de que la liquidación esté en producción.
  Si la liquidación se atrasa, **hay que decidir cuál pesa más**. Técnicamente no dependen: no
  comparten migraciones, y la del aviso se puede aplicar sola. **Decide Felipe.**

## 12. Notas de implementación

Construido el 10/11/2026. La sesión anterior se cayó al crear la rama: no quedó nada escrito, y se
partió de cero.

| Fase | Qué | Estado |
|---|---|---|
| 1 | `lib/dominio/vencimientos.ts`: clave, fecha en palabras, asunto y frase. `caducaAt` del aviso | ✅ con tests |
| 2 | Migración `20261110120000_aviso_de_vencimiento.sql` y `scripts/base-local/escenario-vencimiento.mjs` | ✅ escrita, 20 de 20 en local, **sin aplicar** |
| 3 | `lib/correo.ts`, `/api/correos`, `/admin/correos` | ✅ tsc, lint, 241 tests y build |
| 4 | Staging: aplicar la migración, permisos por rol con sesión, un correo real abierto en el teléfono con el botón sin sesión, 30 filas seguidas | ⏳ **espera la aprobación de Felipe para aplicar en staging** |
| 5 | Texto final aprobado por Felipe | ⏳ antes del 20/11 |
| 6 | Producción, con la migración aprobada por nombre | ⏳ el 22/11 |

**Cómo quedó:**

- **Una función, dos preguntas.** `avisos_de_vencimiento_pendientes(p_hoy, p_perfil_id, p_vence)`:
  sin persona, qué encolar hoy; con persona y fecha, cuánto le queda ahora. Solo `service_role`.
  La regla de qué se avisa vive en la base porque es un filtro sobre los lotes de todas.
- **`datos` lleva `vence` (la fecha en Chile, `2026-12-03`) y no `venceAt`**, como decía el §7: el
  texto necesita el día en Chile, y el instante va en `caduca_at`, que es donde se usa.
- **Se cuenta al enviar, también en el primer envío.** `alEnviar()` en `lib/correo.ts` pregunta lo
  que le queda antes de cada intento: 0 → `descartado` ("Ya no le quedan clases en ese
  vencimiento"); si no se pudo contar → `fallido`, y se reintenta. No se manda a ciegas.
- **Sin fila no hay correo.** Si `encolar_correo` falla, los demás avisos salen igual sin registro;
  este no, porque sin la clave el barrido del día siguiente lo volvería a mandar.
- **Pausa de 600 ms entre avisos**: Resend acepta 2 por segundo en el plan de entrada, y el 23/11
  son 28 seguidos. 53 avisos son ~35 segundos dentro del barrido.
- **El ejemplo del PRD tenía el día mal**: el 3/12/2026 es jueves, no miércoles. El día de la
  semana sale de la fecha.
