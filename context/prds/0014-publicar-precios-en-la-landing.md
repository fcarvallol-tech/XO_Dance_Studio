# PRD-0014 — Publicar precios en la landing

| Campo | Valor |
|---|---|
| **Estado** | Implementado |
| **Fecha** | 25 de agosto de 2026 |
| **Hito** | Hito 0 — Lanzamiento |
| **Relacionados** | PRD-0001 (landing) · PRD-0012 (promociones) · PRD-0005 (planes en BD) |

> Especificado directamente por Felipe el 25/08/2026 y escrito junto con la implementación, no
> antes. Se deja registrado para que la decisión no viva solo en el commit. Si algo acá no
> refleja lo que pediste, el documento es el que está mal.

## 1. Problema

Los precios están definidos desde el 25/08 y **el Instagram de la academia los publica hace una
semana**, pero la landing sigue mostrando "Por confirmar" en cada curso. La visitante que llega
desde Instagram —que es de dónde llega— ve menos información en el sitio que en el post que la
trajo. Eso no es discreción, es parecer desactualizado justo en el momento de decidir.

Además hay una promoción de lanzamiento corriendo con fecha de término, y no aparece en ninguna
parte del sitio.

## 2. Alcance

1. Sección **Planes** en la landing, entre Cursos y Clase de prueba, con los cuatro packs y su
   valor por clase.
2. Los precios promocionales vigentes se muestran **con el precio de lista tachado**.
3. La promo declara hasta cuándo va.
4. `lib/planes.ts` como fuente única de precios del sitio.
5. Las tarjetas de curso dejan de decir "Por confirmar" en el valor y apuntan a los planes.
6. Enlace a Planes en la barra de navegación.

## 3. Fuera de alcance

- Comprar en línea. El CTA sigue llevando al formulario de WhatsApp hasta PRD-0005.
- Que la promoción se apague sola: eso es PRD-0012. Acá se apaga a mano editando `lib/planes.ts`.
- Horarios, sede y cupos. Siguen "Por confirmar" y no se inventan.

## 4. Precios publicados

| Plan | Lista | Por clase | Promo lanzamiento | Por clase |
|---|---|---|---|---|
| 1 clase | $8.500 | $8.500 | — | — |
| 2 clases | $16.000 | $8.000 | — | — |
| 4 clases | $28.000 | $7.000 | **$20.000** | $5.000 |
| 8 clases | $48.000 | $6.000 | **$36.000** | $4.500 |

Fuente: `CONTEXT.md` §5.b. La promo va **hasta el lunes 31 de agosto de 2026**.

## 5. Casos borde

- **La promo vence y nadie hace deploy.** La landing es estática: el precio promocional se queda
  en pantalla hasta que alguien edite `lib/planes.ts` y despliegue. Está anotado en el archivo,
  y es exactamente el dolor que PRD-0012 viene a resolver.
- **Precio tachado y lectores de pantalla.** Un `<s>` sin contexto se lee como un precio más. Cada
  cifra va con su etiqueta oculta: "Precio normal" y "Precio de lanzamiento".
- **La hora de término del flyer es ambigua.** Ver §6.
- **Teens paga suscripción, no packs.** Los valores son los mismos ($28.000 por 4 clases al mes),
  así que la tabla sirve igual. La diferencia de mecanismo no se explica en la landing: no le
  sirve a nadie antes de que exista el flujo de compra.

## 6. La fecha de la promoción

El flyer dice **"hasta el lunes 31 a las 00:00"**, que leído literal termina el domingo 30, porque
las 00:00 del lunes es cuando el lunes empieza.

**Confirmado por Felipe el 25/08/2026: vence el lunes 31 de agosto a las 23:59.**

En el sitio se escribe **"hasta el lunes 31 de agosto"**, sin hora. Nombrar una hora en un aviso
comercial solo invita a la discusión de si alcanzó o no; el día completo es lo que se prometió y
es lo que se dice.

## 7. Reglas de negocio

- Los valores del sitio salen de `lib/planes.ts` y de ningún otro lado. Si un número aparece dos
  veces, uno va a quedar viejo.
- Dinero en enteros CLP, formateado con punto de miles y sin `toLocaleString`, para que servidor
  y navegador escriban lo mismo.
- No se publican horarios ni la dirección exacta. Eso sigue yendo por WhatsApp.

## 8. Criterios de aceptación

- [x] Los cuatro planes aparecen con su precio y su valor por clase.
- [x] Los packs de 4 y 8 muestran el precio promocional y el de lista tachado.
- [x] La promo dice hasta cuándo va, sin mencionar una hora ambigua.
- [x] Ninguna tarjeta de curso dice "Por confirmar" en el valor.
- [x] No aparece ningún horario ni dirección inventados.
- [x] `npm run build` pasa.

## 9. Métrica de éxito

Que la conversión visita → lead no baje al publicar los precios. El riesgo real de publicar es
que el precio filtre gente antes de que alcance a interesarse; el riesgo de no publicarlo es
parecer desactualizado frente al Instagram. Se eligió el primero, y hay que mirarlo.
