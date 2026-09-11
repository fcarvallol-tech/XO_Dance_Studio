# PRD-0019 — Correo que no se pierde: registro, reintento y visibilidad

| Campo | Valor |
|---|---|
| **Estado** | **Borrador.** Propuesto el 11/09/2026 a pedido de Felipe. Necesita aprobación antes de escribir código |
| **Autor** | Claude, a pedido de Felipe Carvallo |
| **Fecha** | 11 de septiembre de 2026 |
| **Hito** | Hito 3 — Reservas. **Bloquea la publicación de la primera clase especial** (PRD-0018) |
| **PRDs relacionados** | PRD-0006 §5 y §11 (la promesa y el hallazgo) · PRD-0017 §11 (la repite) · PRD-0018 §8.2 (el correo que lleva el plazo del cupo) · ADR-0007 (Resend) |

---

## 1. Problema

**Tres documentos prometen desde agosto algo que no existe.** PRD-0006 §5, ADR-0007 y PRD-0017
§11 dicen, con estas palabras: *"Falla el email pero la reserva se creó. La reserva vale. El
comprobante se reintenta; no se revierte una reserva por un problema de correo."*

La primera mitad está implementada y bien: `enviar()` en `lib/correo.ts` no lanza nunca, así que
un problema de correo no revierte ni una reserva ni una compra. La segunda mitad **no está
implementada en ninguna parte del repositorio**. `enviar()` atrapa el error, hace `console.error`
y devuelve `false`; las cuatro llamadas de `lib/acciones.ts` son `await avisarX({ … })` sin mirar
ese `false`. No hay tabla de envíos, no hay cola, no hay reintento.

Lo que eso significa en la operación: si Resend está caído treinta segundos, o rechaza un envío,
o la API key está mal, **la alumna reservó, se le descontó el crédito y su comprobante no existe
ni va a existir**. Lo único que queda es una línea en el log de una función de servidor, que
nadie lee, y que en Vercel se retiene unos días.

Nadie lo notó en dos meses porque **el fallo se ve exactamente igual que el caso normal**: un
correo que no llega no se distingue de uno que llegó a spam o de uno que la persona no abrió.
Es la misma forma del defecto de PRD-0017 §17 —un error que se convierte en ausencia de datos—
y la misma lección: lo que no deja rastro no se reporta.

**Por qué ahora sí urge.** En las clases especiales el correo deja de ser una cortesía. Es el que
lleva **hasta qué hora queda tomado el cupo** (PRD-0018 §8.2), y es lo que la alumna mira antes de
transferir. Un correo que no llega ahí cuesta un cupo bloqueado, una transferencia que nadie
esperaba y una conversación por WhatsApp que empieza mal.

## 2. Usuario y contexto de uso

| Quién | Desde dónde | Cuándo | Qué necesita |
|---|---|---|---|
| **Alumna** | Teléfono | Segundos después de reservar o declarar una transferencia | Recibir el comprobante. Si el sistema falló, que alguien se entere y se lo mande |
| **Admin** | Computador, una vez al día | Revisando la bandeja de transferencias | Ver de un vistazo si hay correos que no salieron, a quién y por qué. Poder reintentar uno a mano |
| **Owner** | Computador | Cuando algo se reclama | Poder responder "se te mandó el 3 a las 18:04" o "no salió, perdón, acá está" con un dato, no con una suposición |

## 3. Alcance

1. **Tabla `envios_correo`**: cada correo transaccional que el sistema decide mandar queda
   registrado **antes** de intentar mandarlo, con su destinatario, su plantilla, sus datos, su
   estado, sus intentos y su último error.
2. **`lib/correo.ts` registra y después envía.** Las cuatro plantillas actuales
   (`avisarTransferenciaDeclarada`, `avisarCompraAprobada`, `avisarCompraRechazada`,
   `avisarReserva`) y las que agregue PRD-0018 pasan por el mismo camino.
3. **Reintento automático** desde el cron diario que ya existe, con tope de intentos y espera
   creciente entre uno y otro.
4. **Caducidad por plantilla**: un aviso cuyo contenido deja de ser cierto **no se reintenta, se
   descarta con motivo**. Ver §8.3, que es la regla menos obvia de este PRD.
5. **Visibilidad en el portal de admin**: una sección con los envíos fallidos y descartados, con
   destinatario, plantilla, error y botón de reintentar ahora.
6. **El fallo deja de ser invisible en el momento**: la acción que dispara el correo sabe si
   salió, y la pantalla lo dice. "Reservaste, pero no pudimos mandarte el comprobante" es
   información; el silencio actual no lo es.
7. **Purga de datos personales**: el contenido de un envío entregado se borra a los 30 días; queda
   la fila con el rastro (a quién, cuándo, qué plantilla, qué resultado) sin el cuerpo.

## 4. Fuera de alcance

- **Cambiar de proveedor.** Resend se queda (ADR-0007). Esto es lo que falta alrededor.
- **Webhooks de entrega y rebote de Resend.** Saber que Resend *aceptó* el correo ya es el 90 % del
  problema que tenemos hoy; saber que el buzón lo *recibió* es otro PRD. Se anota como siguiente
  paso natural.
- **Correo de marketing, campañas o recordatorios.** Solo transaccional.
- **Plantillas nuevas.** Las de PRD-0018 las define PRD-0018. Acá se define cómo se mandan, no qué
  dicen.
- **El correo de clase cancelada por XO**, que sigue pendiente desde PRD-0006 §10 por otra razón
  (un trigger no puede mandarlo). Este PRD le deja el riel puesto: una vez que exista `envios_correo`,
  el trigger puede **encolar** en vez de mandar. Construirlo es de PRD-0009.
- **Reintentar desde el cliente.** Ninguna pantalla de alumna reintenta nada.

## 5. Flujo principal

1. Algo pasa que merece un correo: una reserva, una compra declarada, una transferencia aprobada.
2. La acción **encola**: inserta una fila en `envios_correo` con estado `pendiente`, dentro de la
   misma transacción lógica que ya usa, pero sin ser parte de la transacción de plata —si el
   registro del envío fallara, la reserva sigue valiendo, como hoy.
3. Inmediatamente después intenta mandarlo. Si Resend acepta, la fila pasa a `enviado` con la
   hora. Si no, queda `fallido` con el error y una hora de próximo intento.
4. La acción devuelve a la pantalla si el correo salió o no. La alumna ve su reserva confirmada y,
   si el correo falló, lo sabe.
5. El cron diario toma los `fallido` cuyo próximo intento ya pasó, descarta los caducados (§8.3) y
   reintenta el resto.
6. Lo que agota los intentos queda `fallido` para siempre y **aparece en el portal de admin**,
   donde alguien lo reintenta a mano o resuelve por WhatsApp.

## 6. Casos borde y errores

| Caso | Qué pasa |
|---|---|
| Resend caído al reservar | La reserva vale. El envío queda `fallido` con el error, y el cron lo manda cuando vuelve |
| Falta `RESEND_API_KEY` | Igual que arriba: se registra el intento y el motivo. Hoy solo hay un `console.error` |
| El correo es `@ejemplo.invalid` (alumnas importadas sin correo real) | No se intenta: nace `descartado` con motivo "sin correo real". Hoy simplemente no se llama, y no queda registro de que había algo que decirle a alguien |
| El mismo aviso se dispara dos veces (doble clic, reintento del navegador) | Una clave de idempotencia por evento evita el duplicado: dos filas iguales no mandan dos correos |
| El reintento sale cuando el plazo ya venció | **No se manda.** Se descarta con motivo (§8.3) |
| La alumna cambia de correo entre el intento y el reintento | Se manda al que está registrado en la fila. Cambiar de correo no reescribe lo que ya se decidió mandar |
| El cron no corre | Nada se pierde: las filas quedan `fallido` y el portal de admin las muestra. Ya pasó que el cron estuviera roto semanas sin que nadie se enterara (PRD-0018 §14) |
| Un envío queda `pendiente` para siempre porque el proceso murió entre el insert y el intento | El cron lo toma igual: `pendiente` con más de N minutos se trata como `fallido` sin error |

## 7. Modelo de datos

```sql
create table public.envios_correo (
  id uuid primary key default gen_random_uuid(),

  -- Qué correo es. `plantilla` es el nombre de la función de lib/correo.ts.
  plantilla text not null,
  destinatario text not null,
  -- Los datos con que se arma el cuerpo. Se purgan a los 30 días (§3.7).
  datos jsonb,

  -- Una clave por evento: dos intentos del mismo hecho no mandan dos correos.
  clave_idempotencia text unique,

  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviado', 'fallido', 'descartado')),
  intentos smallint not null default 0,
  ultimo_error text,
  motivo_descarte text,
  proximo_intento_at timestamptz,
  enviado_at timestamptz,

  -- A qué se refiere, para poder mirarlo desde la bandeja y desde la alumna.
  perfil_id uuid references public.perfiles (id),
  compra_id uuid references public.compras (id),
  reserva_id uuid references public.reservas (id),
  clase_id uuid references public.clases (id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index envios_correo_pendientes_idx on public.envios_correo (proximo_intento_at)
  where estado in ('pendiente', 'fallido');
```

**RLS.** La tabla guarda correos, nombres y el cuerpo de avisos de menores de edad: es de las más
sensibles del sistema. Sin política para `anon` ni para `authenticated`; lectura solo con
`tiene_nivel('admin')`, escritura solo `service_role`. Ninguna función `security definer` que la
lea puede tener grant a `anon`.

**Retención.** Un `enviado` con más de 30 días pierde `datos` y `destinatario` en la purga diaria:
queda el rastro de que se mandó, no el contenido. Ley 19.628 / 21.719, y la regla de `CLAUDE.md`
sobre datos de alumnas.

## 8. Reglas de negocio

### 8.1 El correo nunca revierte plata

Se mantiene tal cual (ADR-0007). Si el registro del envío o el envío fallan, la reserva, la compra
y el crédito siguen como están. Esta regla ya funciona y este PRD no la toca.

### 8.2 Se registra antes de intentar

Un envío que no quedó registrado no se puede reintentar, porque no hay a quién ni qué mandarle.
Es la razón de ser de la tabla: hoy el dato de "había que escribirle a alguien" se pierde en el
mismo instante en que falla.

### 8.3 Un aviso con plazo que llega tarde miente

Es la regla menos obvia y la que este PRD no puede omitir. El correo de reserva pendiente de una
clase especial dice *"tu cupo queda tomado hasta el jueves a las 18:00"* (PRD-0018 §8.2). Si ese
correo falla y el cron lo reintenta el viernes, se manda una promesa que ya no es cierta: el cupo
se soltó, y la alumna transfiere igual.

Entonces: **cada plantilla declara si caduca y con qué**. El aviso de reserva pendiente caduca con
`expira_at`; el comprobante de una clase caduca cuando la clase empieza; el de compra aprobada no
caduca. El reintento que encuentra un envío caducado lo deja en `descartado` con motivo, y el
portal de admin lo muestra: alguien tiene que hablar con esa persona, y no por correo.

### 8.4 Reintentos con tope

Hasta 5 intentos, espaciados 5 min, 30 min, 2 h, 12 h y 24 h. Después queda `fallido` y se
resuelve a mano. Un reintento infinito contra un correo que no existe es ruido.

### 8.5 Idempotencia por evento

La clave la arma quien encola, con lo que identifica el hecho: `reserva:<id>`,
`compra-aprobada:<id>`. Dos veces el mismo hecho, un solo correo.

## 9. Criterios de aceptación

Se prueban **con el artefacto real**: apagando el envío de verdad, no simulando la función.

- [ ] Con `RESEND_API_KEY` inválida, reservar una clase: la reserva existe, el crédito se
      descontó, y hay una fila `fallido` en `envios_correo` con el error de Resend.
- [ ] La pantalla dice que la reserva quedó y que el comprobante no salió. No dice solo "listo".
- [ ] Con la llave correcta, correr el reintento: el correo **llega al buzón de verdad y se abre**,
      y la fila queda `enviado` con hora.
- [ ] Un envío con plazo vencido no se manda: queda `descartado` con motivo, y se ve en admin.
- [ ] Dos disparos del mismo evento producen **un** correo y una fila.
- [ ] Un destinatario `@ejemplo.invalid` nace `descartado`, sin intento.
- [ ] `anon` no puede leer `envios_correo` por la API REST. Una alumna con sesión tampoco.
- [ ] A los 30 días, un `enviado` conserva la fila y ya no conserva `datos` ni `destinatario`.
- [ ] `npm run build` y `npm test` en verde.

## 10. Métrica de éxito

**Correos transaccionales que quedan sin entregar y sin que nadie lo sepa: cero.** Medible como
filas `fallido` con más de 24 horas y sin revisar en el portal. Hoy ese número no se puede
calcular, que es justamente el problema.

## 11. Riesgos y supuestos

- **El cron es el único disparador del reintento, y ya falló una vez.** `CRON_SECRET` vs
  `CRON_SECRETO` dejó la generación de clases muerta semanas sin que nadie se enterara
  (PRD-0018 §14). Si el cron se cae, los reintentos se detienen en silencio: por eso la
  visibilidad en el portal (§3.5) es parte del alcance y no un extra.
- **La tabla concentra datos personales de menores.** Es una tabla más para revisar en cualquier
  auditoría de RLS, y la purga tiene que existir desde el primer día, no después.
- **Supuesto: los fallos de Resend son transitorios.** Si resultan ser rechazos permanentes
  (dominio mal configurado, reputación), el reintento no los arregla y hará falta el PRD de
  webhooks de rebote.
- **Alcance real: son cuatro plantillas y una tabla**, pero toca el camino de plata. No es un
  parche de media hora y por eso no se hizo dentro de PRD-0018.

## 12. Notas de implementación

Se llena al terminar.

---

## 13. Por qué esto bloquea a PRD-0018

La primera clase especial se publica para compartir el link en el momento y que alguien reserve
desde una historia. Ese camino depende de un correo que dice hasta cuándo le guardamos el cupo.
Publicarla con el correo como está hoy es prometer un plazo por un canal que puede fallar sin
dejar rastro, y descubrirlo cuando la alumna reclame.

**Queda anotado como bloqueante**: no se publica la primera clase especial sin este PRD
implementado. Está escrito también en PRD-0018 §10 y en la fase 7 de su plan.
