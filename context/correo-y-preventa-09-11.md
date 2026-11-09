# Correo: el 3/11 y la preventa del 30/11 al 2/12

> Escrito el 09/11/2026 a pedido de Felipe. Contado desde `envios_correo` y desde `auth` en
> producción, **solo lectura**: conteos, sin ningún dato de persona. No desde el panel de Resend.
> La pregunta no es por qué fallaron los 20 del 3/11. Es **si la preventa va a reventar la cuota
> otra vez**.

## La respuesta

**Sí: si el primer día de la preventa se parece al lanzamiento, se pasa.** Ese día genera unos
**230 a 250 correos**, y el 3/11 Resend cortó con unos **190 a 210 aceptados** en el día. **Pagar
el plan esa semana es la decisión que corresponde.** Repartida en tres días parejos no se pasaría,
pero una preventa no se reparte pareja: se concentra el primer día, igual que el lanzamiento.

---

## 1. Correos por día, noviembre (hora de Chile)

`envios_correo` existe desde el 3/11 en la práctica: el 1 y el 2 no hay filas.

| Día | Reserva | Transf. declarada | Transf. recibida | Compra aprobada | Rechazada | Regalo | Amiga | **Total** |
|---|---|---|---|---|---|---|---|---|
| **3/11 · lanzamiento** | 91 | 35 | 35 | 33 | 2 | 27 | — | **223** |
| 4/11 | 7 | 1 | 1 | — | — | 4 | — | 13 |
| 5/11 | 18 | 6 | 6 | 4 | 1 | 12 | — | 47 |
| **6/11 · día normal** | 22 | 4 | 4 | 4 | 1 | 4 | — | **39** |
| 7/11 | 12 | 1 | 1 | 2 | — | 3 | — | 19 |
| 8/11 | 13 | 1 | 1 | 1 | — | 2 | 1 | 19 |
| 9/11 (parcial) | 5 | — | — | — | — | 4 | — | 9 |

**Noviembre al 9/11: 369 correos de la aplicación.** A eso se suman los magic links, que no pasan
por esta tabla (ver §3).

**Un día normal tiene 20 a 45 correos. El lanzamiento tuvo 223**, cinco veces más.

## 2. El 3/11, hora por hora

| Hora | Total | Fallaron | Reservas | Regalos | Compras |
|---|---|---|---|---|---|
| 18:00 | 1 | 0 | 1 | 0 | 0 |
| **19:00** | 13 | **7** | 6 | 4 | 3 |
| **20:00** | 14 | **13** | 10 | 4 | 0 |
| 21:00 | 5 | 0 | 2 | 3 | 0 |
| 22:00 | 13 | 0 | 4 | 0 | 9 |

- **Primer fallo: 19:23:30. Último: 20:59:17. Primer envío bueno después: 21:06.**
- Entre las 19:23 y las 21:00 **falló todo lo que salió**, sin excepción, y a las 21:00 volvió solo.
- **Las 21:00 de Chile son las 00:00 UTC**, y es cuando Resend reinicia su cuenta diaria. Un corte
  continuo que termina justo al cambiar el día UTC es la firma de una **cuota diaria**, no la de una
  caída.
- **En el día UTC del 3/11** (del 2/11 a las 21:00 al 3/11 a las 21:00) la aplicación registró
  **185** correos: **165 salieron y 20 no**. Antes del corte, además, salieron por lo menos **24
  enlaces para entrar**. Por eso **el techo observado está entre 190 y 210 correos por día UTC**.
- **El plan exacto no lo puedo ver desde acá.** Está en Resend, en *Settings → Usage*. Si el número
  que dice ahí es otro, se reemplaza en §4 y la conclusión se recalcula sola.

> ⚠️ **El día de la cuota no es el día de Chile.** Va de 21:00 a 21:00. Una preventa que abre a
> mediodía mete toda su tarde en un mismo día de cuota.

## 3. Cuántos correos genera cada cosa

**Una compra, de punta a punta: 3 correos.**

| Paso | Correo | A quién |
|---|---|---|
| Declara la transferencia | `transferenciaDeclarada` | Administración |
| | `transferenciaRecibida` | La compradora |
| Se aprueba o se rechaza | `compraAprobada` o `compraRechazada` | La compradora |

El 3/11 cuadra exacto: 35 declaradas, 35 recibidas y 33 aprobadas más 2 rechazadas. **El pack de
amigas suma 1 más**, el de la amiga: 4 en total.

**Cada reserva genera 1**, y cada clase que se usa es una reserva. Un pack de 4 termina en 3 + 4 =
7 correos, repartidos en el mes.

**Un registro nuevo:**
- **Con Google: 0 correos.**
- **Con correo: 1 enlace para entrar**, y 1 más cada vez que vuelve a entrar con correo.

Esos enlaces los manda **Supabase Auth por el SMTP de Resend** desde el 3/9. **Gastan la misma
cuota**, pero no quedan en `envios_correo`. Y el registro de auditoría de Auth está vacío en
producción, así que no se pueden contar exactos. Lo que sí se puede contar:

| Día | Cuentas nuevas con Google | Cuentas nuevas con correo | Entradas con enlace (enlaces usados) |
|---|---|---|---|
| 3/11 | 39 | 23 | 28 |
| 4/11 | 8 | 5 | 9 |
| 5/11 | 9 | 7 | 12 |
| 6/11 | 2 | 3 | 9 |

Las entradas con enlace son **un piso** de los enlaces mandados: no cuentan los que nadie abrió ni
los que se pidieron dos veces. El 3/11 se mandaron **entre 30 y 50**.

## 4. La proyección para la preventa

Supuesto, como pediste: **un día parecido al lanzamiento**, sin regalos.

| Qué | Correos | De dónde sale |
|---|---|---|
| Compras (35 × 3) | 105 | Igual al 3/11 |
| Reservas | ~90 | El 3/11 tuvo 91. Puede ser menos: ese día se usaron créditos regalados que en la preventa no existen. Puede ser más: ver la nota de abajo |
| Enlaces para entrar | 30 a 50 | §3 |
| Pack de amigas | 0 a 5 | 1 por compra del pack |
| Regalos | **0** | No se repiten (Felipe, 09/11) |
| **Total del día** | **~230 a 250** | |

**Contra un techo de 190 a 210, el primer día se pasa por 20 a 60 correos.** Con la forma del
3/11, el corte llegaría a media tarde o al anochecer. Desde ahí hasta las 21:00 falla **todo**.

**Lo que se pierde ahí no es un comprobante atrasado.** Durante el corte:
- **nadie nuevo puede entrar con su correo**: el enlace no sale, ni tarde ni nunca (§5). Con Google
  se sigue entrando;
- las compradoras no reciben "recibimos tu transferencia";
- las reservas no se confirman por correo, aunque la reserva sí vale.

**Lo que sube el volumen alrededor de la preventa:**
- **El aviso de vencimiento (PRD-0032)**: **53 correos entre el 23/11 y el 29/11**, 28 de ellos el
  23/11. **Ninguno cae entre el 30/11 y el 2/12**, así que no suma a esos días.
- **Su efecto sí suma.** Las 131 clases sin usar vencen entre el 3 y el 7/12. Si el aviso funciona,
  se convierten en reservas, y cada reserva es un correo. Buena parte va a caer justo del 30/11 al
  2/12, encima de la preventa. Es **lo que se busca**, y también es más correo.

**El mes no es el problema.** Noviembre lleva 369 de la aplicación más los enlaces. Con la
preventa, los avisos y un mes normal debería cerrar entre **1.300 y 1.600**. Lo que se rompe es
**el día**.

**Recomendación: pagar el plan desde antes del 23/11 hasta pasado el 7/12.** Esas dos semanas
juntan los avisos, las reservas que provocan, la preventa y el vencimiento.

---

## 5. Diseño, sin construir: la cadencia del reintento

**Lo que pasa hoy.** La cola de PRD-0019 agenda los reintentos a los 5 min, 30 min, 2 h, 12 h y
24 h. **Pero el barrido corre una vez al día**, a las 06:30 UTC (03:30 de Chile), porque es un cron
de Vercel. Así que cualquier reintento, aunque esté agendado a los 5 minutos, sale a las 03:30.
Por eso un fallo de las 19:30 se entrega 8 horas después.

**Dos cosas que cambian el diseño:**
1. **En un corte por cuota, reintentar a los pocos minutos no sirve.** Resend rechaza todo hasta
   las 21:00 de Chile. El reintento rápido sirve para lo transitorio: una caída de treinta segundos
   o un timeout. **Para la cuota, lo útil es un reintento justo después de las 21:00.**
2. **El enlace para entrar no está en la cola.** Lo manda Supabase. Si Resend lo rechaza, el
   formulario dice "No pudimos mandar el correo. Intenta de nuevo en un momento" y no queda registro
   ni reintento. **Ningún cambio a la cola arregla eso.** Lo único que lo cubre es que haya cuota.

**Opciones, de menor a mayor costo:**

| | Qué | Costo | Qué cubre |
|---|---|---|---|
| **A** | **Barrido de las 21:05.** Un segundo horario del barrido que ya existe, a las 00:05 UTC | Minutos de trabajo, si el plan de Vercel admite otro cron diario. Si no, va por B | Que un corte por cuota se recupere a las 21:05 y no a las 03:30 |
| **B** | **Barrido cada 5 minutos con `pg_cron` y `pg_net`** desde Supabase, llamando a `/api/correos` con su secreto. Es la opción A que ya evaluó el plan de PRD-0019 | Alrededor de un día. Hay que confirmar que las dos extensiones estén en el plan, y guardar el secreto en el vault | Que la escala de 5 min, 30 min y 2 h por fin se cumpla. Fallos transitorios resueltos en minutos |
| **C** | **Barrido oportunista**: cada vez que se despacha un correo nuevo, se reintentan hasta 3 vencidos | Medio día. Sin infraestructura nueva | Reintenta solo cuando hay tráfico, que es justo cuando hay fallos. No ayuda si el sitio está quieto |
| **D** | Cron de Vercel cada minuto | Plan Pro de Vercel | Lo mismo que B |

**Lo que recomiendo es A más B.** También conviene que el barrido **ordene por urgencia**: primero
los avisos con plazo (reserva, cupo de especial pendiente) y después los comprobantes.

## 6. Diseño, sin construir: enterarse el mismo día

**Lo que pasa hoy.** Al entregarse, `marcar_enviado` deja `ultimo_error = null`. Del fallo solo
queda `intentos > 1`, sin la hora ni la razón. **Una caída de dos horas es invisible al día
siguiente**, y la del 3/11 se reconstruyó por los intentos.

**Opciones:**

1. **No borrar el fallo.**
   - Una tabla `fallos_correo` que solo se agrega: envío, cuándo y el error.
   - O, más simple, `primer_fallo_at` y `ultimo_error` que no se limpian al entregar.
   - `/admin/correos` muestra "fallaron hoy" y "últimos 7 días", con la hora del primero y del
     último, **aunque ya se hayan entregado**.
   - Costo: medio día, con migración.
2. **Contar los enlaces que no salieron.** Cuando `signInWithOtp` falla, el formulario avisa a un
   endpoint que suma un contador por hora, **sin guardar el correo**. Es la única forma de ver los
   enlaces perdidos, que es lo más caro de un corte. Costo: medio día.
3. **El aviso a ti, por un camino que no sea Resend.** Si el que falla es Resend, un correo de
   alerta tampoco llega. Hay tres caminos:
   - **Un aviso en `/owner` y `/admin`** cuando hay 3 o más fallos en la última hora. Gratis, pero
     solo lo ves si entras.
   - **Un resumen por correo a las 21:05**, cuando la cuota ya volvió: "hoy fallaron 20 entre las
     19:23 y las 20:59; se reenviaron a las 21:05". Llega el mismo día, después del corte.
   - **Una notificación al teléfono en el momento**, con un bot de Telegram o un servicio como
     ntfy. Es un servicio externo más y hay que decidirlo.

**Lo que recomiendo es 1, 2 y el resumen de las 21:05.** Con eso el 3/11 habría sido visible esa
misma noche, con su número exacto. La notificación en el momento queda para que tú la decidas.

**Nada de esto reemplaza pagar el plan para la preventa.** Lo que hace es que, si vuelve a pasar,
te enteres esa noche y no un día después.
