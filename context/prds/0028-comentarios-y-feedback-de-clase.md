# PRD-0028 — Comentarios de las alumnas y feedback anónimo de clase

| Campo | Valor |
|---|---|
| **Estado** | **Borrador — anotado para más adelante.** No se implementa. Pedido de Felipe el 05/11/2026 |
| **Autor** | Claude, a pedido de Felipe Carvallo |
| **Fecha** | 5 de noviembre de 2026 |
| **Hito** | Hito 4 — Portales (alumna y profesora) |
| **PRDs relacionados** | PRD-0010 parte 3 (el incentivo por promedio, que esto NO alimenta) · PRD-0008 (roles y la regla de datos de contacto) · PRD-0021 (asistencia, que es el insumo del disparador) · PRD-0019 (cola de correos) |

> **Por qué está en borrador y no en la lista de pedidos del ROADMAP.** Felipe pidió dejarlo
> anotado, no construirlo. Va como PRD y no como una fila de la tabla de pedidos porque **tiene
> una decisión de fondo que hay que tomar antes de escribir una línea de código** —§11.1, el
> anonimato frente a un reporte grave— y esa clase de decisión se pierde en una fila de tabla.

---

## 1. Problema

**Hoy XO no tiene ningún canal para saber cómo fue una clase.** El único dato que queda de la
Reggaeton Femme del martes es cuántos créditos consumió.

Eso tiene tres consecuencias concretas:

- **El incentivo por promedio paga por asistencia, que es un proxy.** Una clase puede llenarse y
  estar mal, y una clase chica puede ser excelente. Hoy las dos se miden igual: por cuántas
  llegaron.
- **De una alumna que no vuelve nos enteramos cuando deja de comprar**, y a esa altura no hay nada
  que preguntarle. El 03/11 varias no alcanzaron a llegar a la clase de Pau y lo supimos porque
  llegaron reclamos por WhatsApp, no por la página.
- **La profesora no tiene cómo saber qué ajustar.** Carla se entera de lo que funciona por lo que
  le dicen en la sala, que es justo donde nadie dice lo incómodo.

Y el canal que existe es el peor posible: el reclamo por Instagram, que llega público, tarde y
revuelto con todo lo demás.

## 2. Usuario y contexto de uso

**Quien contesta:** la alumna, **desde el teléfono**, al entrar a la página el día después de su
clase —normalmente a reservar la siguiente—, con **unos 20 segundos de paciencia** y sin ninguna
intención de llenar una encuesta. Mayoritariamente **menores de edad**.

**Quien lee:** Felipe, desde el computador, revisando la semana. Y la profesora, desde el teléfono,
mirando lo de sus propios cursos.

## 3. Alcance

Son **dos features** que comparten dónde se guarda y se diferencian en todo lo demás. Conviene
construirlas en ese orden.

1. **El pop-up anónimo de después de la clase.** Si una alumna asistió a una clase que ya pasó y no
   ha contestado, la próxima vez que entre a la página le aparece una vez: una pregunta cerrada
   —cómo la pasó, cómo se sintió— y un campo de texto libre **opcional**. Anónimo.
2. **Un canal abierto de comentarios y sugerencias hacia la profesora**, desde el portal de la
   alumna, disponible en cualquier momento y sin estar atado a una clase.
3. **Dónde se lee.** El owner ve todo. La profesora ve solo lo de sus cursos, y solo por sobre el
   piso de anonimato de §8.5.

## 4. Fuera de alcance

- **Que la profesora responda un comentario.** Eso es una conversación, con moderación y con una
  alumna menor de edad al otro lado. Otro PRD, si alguna vez.
- **Calificación pública.** Nada de estrellas ni promedios en `/nuestras-profes` ni en el
  calendario. Una profesora con 7 respuestas y un promedio visible es una profesora expuesta.
- **Que esto alimente el pago.** Ver §8.6: es una regla, no un pendiente.
- **Moderación automática** de lo que se escribe.
- **Feedback de las clases especiales.** Entran cuando las especiales tengan su propia regla de
  pago construida.

## 5. Flujo principal

**El pop-up.** La alumna entra a la página. Antes de mostrarle lo que venía a buscar, el sistema
mira si tiene alguna clase asistida en los últimos 7 días sin contestar. Si hay una, le aparece
una tarjeta sobre el contenido: *"¿Cómo te fue en Reggaeton Femme del martes?"*, una fila de
opciones para elegir una, un campo de texto opcional, y dos salidas igual de válidas: enviar o
cerrar. Si cierra, no se le vuelve a preguntar por esa clase. Si envía, se guarda sin su nombre y
se le agradece.

**El canal abierto.** En su portal hay un lugar para escribirle a la academia sobre su profesora o
su curso. Ahí **no** es anónimo por defecto: eligió escribir, y Felipe tiene que poder contestarle.

## 6. Casos borde y errores

- **Una clase con 2 asistentes.** Es el caso que define el diseño, no un borde: con dos respuestas,
  la profesora sabe quién dijo qué. Ver §8.5.
- **Canceló su reserva.** No estuvo en la clase: no se le pregunta. **El insumo es la asistencia, no
  la reserva.** Una reserva cancelada por ella se ve igual que una clase que perdió, y eso ya
  apareció como problema en el PRD-0027.
- **Dos clases pendientes a la vez.** Se pregunta por una sola, la más reciente, y la otra espera a
  la próxima visita. Dos pop-ups seguidos es un pop-up que nadie contesta.
- **Cierra sin contestar.** Cuenta como contestada para no volver a preguntar. El silencio es una
  respuesta y hay que respetarla.
- **La clase se marcó `no_dictada` después.** No se pregunta, y si ya se preguntó, la respuesta
  queda pero no se le atribuye a nadie.
- **Entra en medio de una compra o una reserva.** El pop-up **no aparece** sobre un flujo de pago ni
  de reserva. Interrumpir a alguien que está comprando para preguntarle cómo se sintió es perder
  las dos cosas.
- **La profesora de la clase era un reemplazo.** El comentario es de la clase, y la clase la dictó
  quien la dictó: se le atribuye a quien estuvo, igual que el pago.

## 7. Modelo de datos

**El punto crítico de todo el PRD: son dos tablas, y no puede haber camino para unirlas.**

Para no volver a preguntar hay que saber quién contestó. Para que sea anónimo, el contenido no
puede saberlo. Si las dos cosas viven en la misma tabla, el anonimato es una promesa de la interfaz
y no una propiedad del sistema — y una promesa de interfaz se rompe el día que alguien escriba la
consulta equivocada.

```sql
-- El contenido. NO tiene perfil_id. Nunca lo va a tener.
create table public.clase_feedback (
  id uuid primary key default gen_random_uuid(),
  clase_id uuid not null references public.clases (id) on delete restrict,
  valoracion smallint not null,
  comentario text,
  -- Truncado al día a propósito: la hora exacta, cruzada con quién entró a la
  -- página, es una forma de deducir quién escribió.
  fecha date not null default (now() at time zone 'America/Santiago')::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Quién ya fue preguntada. NO tiene el contenido. Nunca lo va a tener.
create table public.clase_feedback_respondido (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles (id) on delete restrict,
  clase_id uuid not null references public.clases (id) on delete restrict,
  respondido_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (perfil_id, clase_id)
);
```

⚠️ **`created_at` en la tabla de contenido es una fuga.** Está ahí porque toda tabla lo lleva, pero
ninguna lectura lo expone y ninguna ordena por él. Lo que se muestra es `fecha`. Si en la revisión
esto parece frágil, sacarlo es la decisión correcta.

**RLS, y la advertencia de CLAUDE.md sobre políticas que no restringen:**

- `clase_feedback`: `insert` para `authenticated` **solo si asistió a esa clase**, verificado dentro
  de la base y no en la consulta. **Sin `select` para `authenticated`**, ni siquiera de lo propio
  —no hay "lo propio": por eso es anónimo—. Lectura del owner por política; lectura de la profesora
  **solo por función `security definer`** con el piso de §8.5 adentro, porque RLS filtra filas y
  acá hay que filtrar por cuántas hay.
- `clase_feedback_respondido`: la alumna lee y escribe **solo lo suyo**. Antes de escribir esa
  política, mirar qué otras tiene la tabla: una permisiva que ya exista suma acceso y la nueva no
  restringe nada.
- Toda función con su `grant execute` escrito, y ninguna con grant a `anon`.
- Comprobarlo preguntándole a la base con la sesión de cada rol, en una transacción que se revierte,
  como en `scripts/verificar-rls-clases.mjs`. **Y comprobar también lo que no debe verse.**

## 8. Reglas de negocio

1. **Solo contesta quien asistió.** No quien reservó.
2. **Una respuesta por alumna por clase.** El candado es el único de
   `clase_feedback_respondido`, en la base.
3. **Ventana de 7 días.** Después no se pregunta: lo que se responde dos semanas después es otra
   cosa.
4. **No se edita ni se borra.** Ni la alumna ni la profesora ni el owner. Si hay que sacar algo, se
   marca `deleted_at` y queda el registro de que se sacó.
5. **Piso de anonimato.** La profesora **no ve respuestas individuales de una clase con menos de N
   respuestas**: ve el agregado del mes o nada. Propuesta: **N = 3**, a confirmar antes de
   construir. Con las salas de hoy —16 en Los Leones— y 74 alumnas, esto se va a activar seguido, y
   está bien: es la condición para que el anonimato sea real.
6. 🔴 **Esto nunca entra en el cálculo del pago.** Ni en la base, ni en el variable, ni en el
   incentivo. El día que un comentario mueva plata, el anonimato pasa a ser un arma y nadie
   escribe en serio. Es regla, no pendiente.
7. **El pop-up no aparece sobre un flujo de compra ni de reserva.**

## 9. Criterios de aceptación

- [ ] Una alumna que asistió ve el pop-up una vez, y no lo vuelve a ver, haya contestado o cerrado.
- [ ] Una alumna que canceló su reserva **no** lo ve.
- [ ] Preguntado a la base con la sesión de una alumna: `select` sobre `clase_feedback` devuelve
      **cero filas**, incluso de la que ella misma escribió.
- [ ] `information_schema.column_privileges` confirma que `authenticated` **no puede leer**
      `comentario` ni `valoracion`.
- [ ] Preguntado con la sesión de una profesora, sobre una clase con 2 respuestas: devuelve **cero
      filas individuales**. Con 3: las devuelve.
- [ ] Preguntado con la sesión de una profesora, sobre una clase **de otra**: cero filas.
- [ ] Una liquidación calculada sobre un mes con comentarios muy malos da **exactamente el mismo
      monto** que sin ellos.
- [ ] El pop-up no aparece en `/comprar`, en el checkout ni al reservar.

## 10. Métrica de éxito

**Porcentaje de clases del mes con al menos una respuesta.** Si a los 30 días está bajo el 30%, el
pop-up molesta más de lo que informa y hay que cambiarlo o sacarlo.

## 11. Riesgos y supuestos

**11.1. 🔴 La decisión que hay que tomar antes de construir: el anonimato contra un reporte grave.**

Las alumnas son mayoritariamente menores y la profesora es una adulta a cargo. Un campo de texto
libre en ese contexto **va a recibir, alguna vez, algo que no es una sugerencia sobre la
coreografía.** Y el anonimato perfecto significa que ese día no vamos a poder saber quién lo
escribió ni preguntarle nada.

No se puede prometer anonimato total y a la vez poder actuar. Las tres salidas:

- **(a) Anónimo para la profesora, visible para la academia.** El pop-up lo dice con esas palabras.
  Honesto, mantiene abierto el camino para actuar, y baja un poco la franqueza.
- **(b) Anónimo de verdad, con un check opcional** *"quiero que me contacten"*. Quien marca deja de
  ser anónima. La mayoría no marca y escribe tranquila.
- **(c) Anónimo absoluto.** Lo más franco y lo que deja a XO sin poder responder a lo que importa.

**Recomendación: (b).** Es la única que no miente en ninguno de los dos sentidos. Pero es decisión
de Felipe, y hay que tomarla antes y no después: cambia el esquema, cambia la pantalla y cambia lo
que se le promete a una menor por escrito.

**11.2. Ley 19.628 / 21.719.** Texto libre escrito por menores, guardado por tiempo indefinido. Hay
que decidir y escribir cuánto se guarda, quién lo ve y qué pasa si una apoderada pide que se borre.

**11.3. Los pop-ups cansan.** Si aparece siempre, deja de contestarse y encima molesta justo cuando
la alumna venía a reservar. Supuesto a verificar: una vez por clase, con una salida clara, se
tolera.

**11.4. Con 74 alumnas el volumen es chico.** Un comentario malo va a parecer una opinión y no un
patrón, y la tentación va a ser leerlo como ruido. Supuesto: sirve igual, porque lo que se busca
no es significancia estadística sino enterarse.

**11.5. Lo que la profesora lee la afecta.** Son cinco y son el activo escaso de XO. Cómo se le
muestra —agregado, con contexto, no un muro de texto crudo— es parte del diseño, no decoración.

## 12. Notas de implementación

Se llena al terminar.
