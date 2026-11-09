# PRD-0032 — Avisarle a la alumna que se le vencen las clases

| Campo | Valor |
|---|---|
| **Estado** | Borrador, espera a Felipe. **Se construye después de que la liquidación esté en producción**, con fecha propia: **vivo el 22/11/2026** |
| **Autor** | Claude, a pedido de Felipe Carvallo |
| **Fecha** | 9 de noviembre de 2026 |
| **Hito** | Hito 2 — Venta de clases (créditos) |
| **PRDs relacionados** | PRD-0019 (la cola de correo y su barrido diario) · PRD-0017 (lotes con vencimiento) · PRD-0023 (regalos) · ROADMAP, pedido 10 (la conversión de diciembre) · `context/correo-y-preventa-09-11.md` (la cuota) · PRD-0012 (preventa, sin escribir) |

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
   "Te quedan 3 clases. Vencen el miércoles 3 de diciembre". **Lleva al calendario**, con un solo
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

- **Un mensaje distinto para las 25 que nunca compraron.** Ver §8.4: queda preparado, no escrito.
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
4. En la mañana, Camila lee: **"Te quedan 3 clases en XO. Vencen el miércoles 3 de
   diciembre"**. Aprieta "Reservar una clase" y llega a `/calendario`.
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
  - devuelve `perfil_id`, `correo`, `nombre`, `vence` (la fecha en Chile), `clases` y `compro_alguna_vez`;
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

### 8.4 Las 25 que nunca compraron

Para ellas el aviso es otra cosa: es **el momento de la conversión de diciembre** (pedido 10).

**¿Complica la primera versión?** En código, no: es un campo `compro_alguna_vez` en los datos y
un párrafo condicional. **En contenido, sí.** Lo natural es decirles "y después, esto cuesta tanto",
y ese precio es el de la preventa, que todavía no tiene PRD. Escribirlo ahora sería inventar un
precio.

**Propuesta:**
- **v1 (22/11):** el mismo mensaje para todas. El campo `compro_alguna_vez` **ya viaja en los
  datos**.
- **v2:** cuando PRD-0012 fije la preventa, el párrafo para ese grupo es solo texto. Puede salir con
  los avisos de los lotes que vencen después.

Para el 23/11 hay una consecuencia: el primer aviso de las 25 va a decir lo mismo que el de las
demás.

## 9. Criterios de aceptación

- [ ] Con un lote que vence en 10 días, 2 clases disponibles y rol alumna, el barrido encola y
      manda **un** correo con "2 clases" y la fecha correcta en hora de Chile.
- [ ] Correr el barrido dos veces el mismo día no manda dos.
- [ ] Dos lotes de la misma persona que vencen el mismo día: un correo con la suma. Con fechas
      distintas: dos correos, cada uno en su día.
- [ ] Disponible 0 al encolar: no hay fila. Disponible 0 al enviar: la fila queda `descartado`.
- [ ] Profesora con créditos: no recibe aviso.
- [ ] Un barrido saltado: al día siguiente se encola, con 9 días por delante. Con 2 días, no.
- [ ] Un fallo de Resend se reintenta, y después del vencimiento queda `descartado`.
- [ ] 🔴 **Probado con el correo real en staging**: un correo que alguien abre en el teléfono, con
      el botón apretado **sin sesión**. Tiene que llevar a `/calendario` y, al reservar, pedir
      entrar y volver a la clase. Es el mismo camino que falló con el pack de amigas el 08/11.
- [ ] `avisos_de_vencimiento_pendientes` no la ejecuta ninguna sesión: preguntado con la de owner,
      admin, alumna y anon.
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

Se llena al terminar.
