# PRD-0018 — Clases especiales (clases sueltas de coreografía)

| Campo | Valor |
|---|---|
| **Estado** | **Borrador** — esperando aprobación de Felipe. Tiene una decisión abierta que bloquea el modelo de datos: §8 |
| **Autor** | Propuesto por Claude a pedido de Felipe Carvalho |
| **Fecha** | 8 de septiembre de 2026 |
| **Hito** | Hito 3 — Reservas (extiende el calendario) · Hito 4 — Portales (formulario en admin) |
| **PRDs relacionados** | PRD-0006 (calendario y reservas) · PRD-0009 (portal de administración) · PRD-0010 (métricas: atribución y ocupación) · PRD-0014 (sección Planes) · PRD-0016 (horarios y sedes) · PRD-0017 (compras, créditos, `clases`) · ADR-0002 (créditos universales) |

> **Sobre el nombre.** Felipe las llamó "clases sueltas". Ese nombre **ya está tomado**: el plan de
> 1 clase de la tabla `planes` se llama "Clase suelta" y se publica así en la landing a $8.500.
> Poner al lado una entrada "Ver clases sueltas" que lleve a otra cosa, más cara, es confundir a
> la visitante en la sección donde compara precios. Este PRD usa **"clase especial"** como nombre
> de trabajo (`tipo = 'especial'` en el código). El nombre público lo decide Carla; alternativas:
> "Coreos", "Clase única", "Masterclass". Lo que no puede ser es "clase suelta".

---

## 1. Problema

La parrilla fija es semanal y de nivel principiante en los cuatro cursos. Cuando una coreografía
gusta —se ve en las historias, la piden por Instagram, la alumna quiere repetirla o traer a una
amiga— no hay dónde ponerla: el horario de Pau del jueves es el horario de Pau del jueves, y la
semana siguiente toca otra cosa.

Hoy eso se resuelve mal o no se resuelve: la profesora improvisa una repetición dentro de su
horario fijo (y la alumna que fue la semana pasada la ve de nuevo), o se organiza algo por
WhatsApp que no queda en el sistema: no se reserva por la web, no descuenta nada, no se cobra por
la plataforma, no aparece en las métricas ni en la liquidación de la profesora.

Lo que se quiere es poder **agendar una clase puntual, con una coreografía específica, fuera de
la parrilla, a un precio propio más alto**, y que la visitante la vea con video antes de decidir.
Es además la primera pieza del negocio que empieza a tratar a la profesora como producto (visión
de plataforma de talentos, `CONTEXT.md` §7): la coreografía es de ella, el video es de ella.

## 2. Usuario y contexto de uso

| Quién | Desde dónde | Cuándo | Qué necesita |
|---|---|---|---|
| **Visitante** que llegó por Instagram | Teléfono, sin cuenta | Viendo el video de una coreo que le gustó | Ver cuándo es, cuánto cuesta, quién la dicta y dónde, y reservar en menos de dos minutos |
| **Alumna** con cuenta y créditos | Teléfono | Mirando el calendario o el link que le mandaron | Saber si la puede pagar con lo que ya tiene o si es aparte, y reservar |
| **Owner** (Felipe o Carla) | Computador | Después de acordar con la profesora fecha, sala y coreo | Crear la clase con video en cinco minutos, fijar el precio, publicarla, compartir el link |
| **Admin** | Computador | Lo mismo que owner, sin tocar el precio | Crear y editar la clase con el precio por defecto |
| **Profesora** | Teléfono | Antes de la clase | Verla en su grilla e inscritas igual que una clase normal. En v1 la propone por WhatsApp, no por el portal |

## 3. Alcance

1. Una **clase especial** es una fila más de `clases`, con `tipo = 'especial'`, sin `horario_id`,
   creada una a una desde el portal de administración. Tiene título de coreografía, descripción,
   video de preview, estilo (curso), dificultad propia, precio propio, fecha y hora, duración,
   sede, profesora y cupo.
2. **Formulario de creación y edición** en `app/(admin)/admin/especiales/`, para admin y owner.
   El precio solo lo edita **owner**; admin ve el valor por defecto y no lo cambia.
3. **Subida de video** desde el formulario a un bucket de Supabase Storage, con límites de
   tamaño y formato, y una miniatura opcional. Sin video no se publica.
4. **Estados** `borrador` → `publicada` → (`cancelada` | realizada por el paso del tiempo). Solo
   las publicadas son visibles fuera del admin.
5. **Página pública** `/clases-especiales`: las publicadas que aún no pasaron, con video, en
   orden de fecha. Se ve sin cuenta.
6. **Página pública por clase** `/clases-especiales/[slug]`, compartible por Instagram: video
   grande, ficha, cupos libres, botón de reservar. Con Open Graph propio (la miniatura).
7. **Entrada en la sección Planes** de la landing: una fila más, después de los cuatro packs,
   con el nombre público, el texto "desde $X" calculado sobre las publicadas y el enlace a
   `/clases-especiales`. Si no hay ninguna publicada, la fila no aparece.
8. **Reserva** de una clase especial por la alumna, con sesión, por el camino que decida §8.
   Reservar y cobrar siguen siendo una sola transacción en la base.
9. **Cancelación** por la alumna y por la academia, con la misma ventana y el mismo trigger que
   hoy. Lo que se devuelve depende de §8.
10. Las especiales **aparecen en la grilla de la profesora** y en `inscritas_de_clase` sin
    trabajo extra, porque viven en `clases`.
11. **Métricas**: las especiales cuentan en ocupación por clase, cancelaciones y atribución a
    profesora. No cuentan en "por horario", porque no tienen uno.

## 4. Fuera de alcance

- **Pago en línea.** Sigue siendo transferencia declarada hasta que exista Flow (ADR-0003).
  Consecuencia grave para la alternativa B de §8: ver ahí.
- **Que la profesora cree la clase desde su portal.** En v1 la propone por WhatsApp y la crea
  admin. Cuando se haga, se hace extendiendo `solicitudes_horario` con un tipo `especial`, no
  con otra tabla. Queda para PRD-0009 o uno propio.
- **Talleres de varias sesiones** ("intensivo de 3 sábados"). Una especial es una fecha. Si hace
  falta, se crean tres y se enlazan después.
- **Lista de espera** cuando se llena. Se anota como palanca, igual que en PRD-0017 §7.4.
- **Correo** al publicar una especial o a las alumnas de esa profesora. El correo de reserva y de
  cancelación sale igual que hoy; el de marketing no existe todavía.
- **Teens.** Las especiales son para 15+. El tramo de 11 a 14 no entra: cambia quién paga y qué
  puede aparecer en un video.
- **Precio distinto por sede.** Decisión pendiente de `CONTEXT.md` §12 que este PRD no abre.
- **Umbral mínimo de alumnas para que la clase se realice.** Se propone como campo (§7) pero
  **sin automatismo**: cancelar sigue siendo una decisión de una persona.

## 5. Flujo principal

### 5.1 Owner crea la clase

1. Entra a `/admin/especiales` → "Nueva clase especial".
2. Llena: título de la coreografía, canción y artista, descripción corta, estilo (uno de los
   cursos activos), dificultad, profesora, sede, fecha, hora, duración, cupo, precio (si es
   owner), y sube el video y una miniatura.
3. Guarda como **borrador**. Ve la vista previa tal como la vería la visitante.
4. Aprieta **Publicar**. La página pública y la fila en Planes se actualizan (webhook de
   revalidación, el mismo de PRD-0015). Copia el link y lo comparte.

### 5.2 La visitante reserva

1. Abre el link desde Instagram en el teléfono. Ve el video reproduciéndose sin sonido, el
   título, la profesora, la fecha, la sede con dirección, el precio y cuántos cupos quedan.
2. Aprieta **Reservar**. Si no tiene cuenta, pasa por `/entrar` y vuelve a la misma clase.
3. Lo que pasa después depende de §8. En las dos alternativas termina con una reserva
   `confirmada` en `reservas`, el cupo descontado en la misma transacción, y el comprobante por
   correo.
4. La ve en "Mis clases" con la misma tarjeta que una clase normal, marcada como especial.

### 5.3 La profesora la dicta

Aparece en su grilla semanal como un bloque más, con el título de la coreografía en vez del
nombre del curso. Las inscritas se ven con `inscritas_de_clase`, sin cambios.

## 6. Casos borde y errores

| Caso | Qué pasa |
|---|---|
| Se publica sin video | No se puede: el botón Publicar exige `video_url`. Un borrador sí puede no tenerlo |
| Video demasiado pesado o en formato raro | Se rechaza al subir, con el límite dicho: hasta 40 MB, `mp4` o `webm`, se recomienda vertical y de 15 a 30 segundos |
| La sede tiene otra clase a esa hora | Se rechaza al guardar: la validación de solape mira `clases` publicadas de esa sede en la ventana de duración, no solo `horarios`. Es una función de base de datos, no un chequeo en el cliente |
| La profesora tiene otra clase a esa hora | Igual que arriba, por profesora |
| Se llena mientras la visitante mira el video | `reservar()` ya rechaza con "La clase está llena": la fila de la clase se bloquea con `for update`. Nada nuevo |
| La alumna cancela a tiempo | Libera el cupo. Lo que recupera depende de §8 |
| La alumna cancela tarde | Libera el cupo, no recupera nada. Igual que hoy |
| La academia cancela | El trigger `clases_al_cancelar` corre igual. Con la alternativa A devuelve el crédito; con la B hay que devolver **plata**, y eso es manual: ver §8 |
| Owner cambia el precio con reservas ya hechas | Las reservas hechas no cambian: el monto quedó congelado en su compra o en su movimiento. Solo afecta a las siguientes |
| Se edita fecha u hora con reservas hechas | Se permite, con aviso en pantalla de cuántas reservas hay. **No manda correo** (fuera de alcance), así que el aviso dice que hay que avisar por WhatsApp |
| Se intenta borrar una especial publicada | No se borra: se cancela. Un borrador sin reservas sí se puede borrar |
| Video con menores o con otra persona identificable | Regla de `CLAUDE.md`: el formulario pide confirmar que solo aparece la profesora, o que hay autorización firmada de quien más aparezca |

## 7. Modelo de datos

**Decisión de diseño: extender `clases`, no crear una tabla nueva.** Todo lo que cuesta plata y
ya está probado —`reservar()`, `cancelar_reserva()`, el trigger de devolución, el bloqueo de cupo,
`inscritas_de_clase`, la grilla de la profesora, las métricas de ocupación— trabaja sobre
`clases`. Una tabla `clases_especiales` obligaría a duplicar exactamente la parte del sistema
donde un bug le cuesta plata a alguien. Una especial es una clase que no vino de un horario.

```sql
-- Propuesta. Va a supabase/migrations/ cuando se apruebe el PRD y §8.

alter table public.clases
  -- Las especiales no vienen de un horario. El unique (horario_id, fecha) sigue
  -- funcionando: los null no chocan entre sí. generar_clases() no se toca.
  alter column horario_id drop not null,

  add column if not exists tipo text not null default 'parrilla'
    check (tipo in ('parrilla', 'especial')),

  -- Ficha de la especial. Todo null en las de parrilla.
  add column if not exists slug text,                 -- para /clases-especiales/[slug]
  add column if not exists titulo text,               -- "Coreo de 'Yo Perreo Sola'"
  add column if not exists cancion text,              -- canción y artista, texto libre
  add column if not exists descripcion text,
  add column if not exists video_url text,
  add column if not exists miniatura_url text,
  add column if not exists dificultad text
    check (dificultad in ('principiante', 'intermedio', 'avanzado')),
  add column if not exists fin timestamptz,           -- inicio + duración; hoy todo dura 1 h
  add column if not exists precio_clp int check (precio_clp >= 0),
  add column if not exists publicada_at timestamptz,  -- null = borrador
  add column if not exists creada_por uuid references public.perfiles (id),
  add column if not exists minimo_alumnas smallint;   -- informativo, sin automatismo

-- Una fila es coherente con su tipo, o no entra.
alter table public.clases add constraint clases_tipo_coherente check (
  (tipo = 'parrilla' and horario_id is not null and titulo is null and precio_clp is null)
  or
  (tipo = 'especial' and horario_id is null and titulo is not null and slug is not null
   and profesora_id is not null and sede_id is not null)
);

-- Publicar exige video.
alter table public.clases add constraint clases_publicada_con_video check (
  publicada_at is null or tipo = 'parrilla' or video_url is not null
);

create unique index if not exists clases_slug_unico on public.clases (slug) where slug is not null;
create index if not exists clases_especiales_idx
  on public.clases (inicio) where tipo = 'especial' and publicada_at is not null;

-- El precio por defecto que ve admin. Owner lo cambia sin desplegar.
insert into public.parametros (clave, valor, descripcion) values
  ('especial_precio_default_clp', '<POR DEFINIR>', 'Precio con que nace una clase especial. Lo edita owner.')
on conflict (clave) do nothing;
```

**`curso_id` se mantiene obligatorio** y es lo que el formulario llama "estilo": una especial de
Reggaeton Femme apunta al curso `reggaeton-femme`. Así ninguna consulta que hace `join cursos`
se rompe, y el filtro por curso del calendario la incluye. Si algún día hay una especial de un
estilo que no es curso, se crea el curso con `activo = false` para que no salga en la landing.

**Lo que cambia en consultas existentes:**

| Dónde | Cambio |
|---|---|
| `getCalendario` (`lib/compras-consultas.ts`) | Traer `tipo, titulo, precio_clp, video_url, miniatura_url`; filtrar `publicada_at is not null or tipo = 'parrilla'` |
| `clases_lectura_publica` (RLS) | Hoy es `using (true)`. Pasa a `tipo = 'parrilla' or publicada_at is not null`: un borrador no es público. La consulta filtra igual, como defensa en profundidad |
| `metricas_demanda` → `por_horario` | El `join horarios` es interno y deja fuera a las especiales, que es lo correcto. Se documenta en el comentario de la función |
| `metricas_demanda` → `atribucion` | Depende de §8. Con A funciona sin tocar nada; con B hay que atribuir `precio_clp` cuando la reserva no viene de un lote de pack |
| `GrillaSemanal` | Mostrar `titulo` en vez de `cursos.nombre` cuando `tipo = 'especial'` |

**Storage.** Bucket `videos-especiales`, lectura pública, escritura solo desde el servidor con la
service role (la subida pasa por un Route Handler que valida tamaño y tipo). Un archivo por clase,
nombrado por el `id` de la clase; reemplazar sobreescribe. Las políticas del bucket se escriben en
la migración, igual que las de las tablas. Alternativas descartadas: pegar el link de un Reel (no
se puede reproducir embebido sin el script de Instagram y sin consentimiento de cookies) y Vercel
Blob (otro proveedor para lo mismo que Supabase ya ofrece).

## 8. ⚠️ Decisión abierta: ¿se pagan con créditos o son una compra aparte?

**No se resuelve en este PRD.** Bloquea la migración y el flujo de reserva, así que la fase 0 del
plan es esta decisión. Las dos alternativas, con lo que arrastran:

### Alternativa A — Se pagan con créditos normales, a razón de N créditos por clase

La especial declara cuántos créditos cuesta (`costo_creditos`, por ejemplo 2). `reservar()`
descuenta N en vez de 1, en orden de vencimiento, cruzando lotes si hace falta. El "precio" de la
especial se expresa en créditos, y en pesos solo como referencia.

| | Consecuencia |
|---|---|
| **Producto** | Una sola billetera. La alumna no compra nada nuevo: usa lo que tiene. La promesa "un crédito sirve para cualquier clase" se sostiene casi entera, con una nota: "las especiales cuestan 2" |
| **Precio real** | **No es un precio, es un rango.** Un crédito vale entre $6.000 (pack de 8) y $8.500 (suelta), y con promo menos. Dos créditos son entre $12.000 y $17.000 según cómo los compró. "Precio propio editable por owner" pasa a ser "costo en créditos editable por owner", que es más grueso: no hay 1,5 créditos |
| **Caja** | No entra plata nueva al publicar una especial: se consume pasivo ya cobrado. Bueno para la brecha vendido/entregado del tablero, neutro para la caja |
| **Cancelación** | Todo funciona hoy sin tocar nada: `cancelar_reserva` y el trigger devuelven al lote original. Con N créditos hay que devolver N, potencialmente a N lotes: `reservas.credito_id` deja de ser una sola columna. **Este es el costo técnico real de A** |
| **Liquidación de la profesora** | El variable es $250 por crédito consumido (`CONTEXT.md` §5.b). Con 2 créditos cobra $500 por alumna, automático y coherente |
| **Atribución en métricas** | Funciona sola: `monto_compra / clases_compra × n`, con n = 2 |
| **Riesgo** | Una alumna que compró el pack de 8 en promo paga una especial a $10.000 en créditos que le costaron $5.000 cada uno. Si la especial vale más que eso, la academia subsidia. Owner lo controla subiendo N, pero solo de a saltos enteros |

### Alternativa B — Compra aparte, en pesos, con precio fijo

La especial tiene `precio_clp`. Reservarla crea una `compra` con ese monto y `clase_id` en vez de
`plan_id`, y la reserva queda amarrada a esa compra. Sin pasarela, es transferencia declarada,
igual que un pack.

| | Consecuencia |
|---|---|
| **Producto** | El precio es un número: "$12.000", el que dice el video. Owner lo edita en pesos. Pero la alumna con créditos **igual tiene que pagar aparte**, y eso hay que explicárselo en la pantalla: "esta clase no se paga con tus clases del pack" |
| **Promesa de los créditos** | La frase "sirve para cualquier clase" (`CONTEXT.md` §5.b, sección Planes) pasa a "cualquier clase **de la parrilla**". Hay que cambiar el copy |
| **Caja** | Entra plata nueva por cada especial. Es el modelo que hace que una especial sea un ingreso y no un consumo |
| **El problema grande: cupo y transferencia** | PRD-0017 §7.1 decidió que **una compra pendiente no retiene cupo**. Para un pack da lo mismo; para una clase con fecha, la alumna que transfirió y espera aprobación puede llegar a la aprobación con la clase llena. Hay que elegir: (i) retener el cupo N horas con una reserva `pendiente_pago` que vence sola, lo que introduce un estado nuevo en `reservas` y un proceso que lo expire, o (ii) aceptar que la reserva solo existe cuando admin aprueba y decirlo en pantalla. **Con Flow (ADR-0003) el problema desaparece**: la reserva nace pagada |
| **Cancelación** | Si la alumna cancela a tiempo, ¿se le devuelve plata por transferencia (manual), o se le emite un crédito universal de compensación (automático, pero le devuelve algo distinto de lo que pagó)? Si la **academia** cancela, el trigger hoy devuelve créditos; con B tendría que registrar una devolución de dinero pendiente y alguien tiene que transferir. **Ambas hay que decidirlas junto con B** |
| **Modelo de datos** | `reservas.credito_id` es `not null` y `compras.plan_id` también. Las dos pasan a nullable con un check de coherencia, o la especial genera un lote de 1 crédito **restringido a esa clase**, que contradice la regla "los créditos no llevan `curso_id`" (ARCHITECTURE §5.4) y hay que escribir un ADR que la matice |
| **Liquidación de la profesora** | El variable por crédito consumido no aplica: no hay crédito. Hay que definir el variable de una especial (¿$250 igual? ¿un porcentaje del precio? ¿toda la especial es de la profesora menos la sala?). Es la conversación de Fase 2 del negocio adelantada |
| **Atribución en métricas** | Hay que agregar la rama: si la reserva no tiene lote, se atribuye `compras.monto_clp` completo |

### Lo que inclina la balanza, sin decidir

- **A es más barata de construir y usa la infraestructura probada.** Su costo técnico está en
  devolver N créditos a N lotes. Su costo de negocio está en que el precio se fija en saltos.
- **B es la que convierte la especial en ingreso** y la que se parece al "precio propio" que pidió
  Felipe. Su costo es que abre tres decisiones más (retención de cupo, devoluciones en plata,
  variable de la profesora) y que sin pasarela la experiencia depende de que admin apruebe a
  tiempo.
- **Hay una C** —aceptar las dos: N créditos **o** pagar aparte— que da lo mejor de cada una y el
  doble de superficie de error. No se recomienda para v1, pero si la decisión es B, conviene dejar
  el esquema abierto para sumar A después (la columna `costo_creditos` no estorba).

**Lo que se necesita de Felipe para cerrar §8:** A, B o C; y si es B, las tres decisiones de la
fila "Cancelación" y "Cupo y transferencia". Sin eso la migración no se puede escribir completa.

## 9. Reglas de negocio

1. Solo `admin` o superior crea y edita especiales. Solo `owner` edita `precio_clp` (o
   `costo_creditos`). Se valida en la función de base de datos, no en el formulario.
2. No se publica sin video, sin profesora, sin sede, sin fecha futura.
3. No se guarda una especial que se solape, en sede o en profesora, con otra clase publicada o
   con una clase de parrilla. La duración manda: 19:30 choca con 20:00.
4. Una especial publicada no se borra; se cancela con motivo, como cualquier clase.
5. La reserva descuenta cupo y cobra (créditos o compra) en **una sola transacción**. Igual que
   hoy: ninguna operación desde el cliente.
6. El cupo por defecto es 22, el de la sala. Owner puede bajarlo (grupo chico); no subirlo.
7. Las especiales son para 15+. El formulario no ofrece Teens como estilo.
8. `precio_clp` y `costo_creditos` de reservas ya hechas no se recalculan nunca.

## 10. Criterios de aceptación

Se prueban **con el artefacto que toca la persona**, en staging, antes del `db push` a producción.

- [ ] Owner crea una especial con video desde `/admin/especiales`, la guarda como borrador y
      **no aparece** en `/clases-especiales` ni en la landing.
- [ ] Owner la publica: aparece en `/clases-especiales`, en su página propia y en la fila de
      Planes con "desde $X" correcto. Sin sesión, desde un teléfono, el video se reproduce sin
      sonido y sin bloquear la página.
- [ ] El link de la página propia, pegado en WhatsApp, muestra la miniatura y el título (Open
      Graph).
- [ ] Una visitante sin cuenta aprieta Reservar, entra por magic link **abriendo el enlace del
      correo**, y vuelve a la misma clase.
- [ ] Reserva por el camino de §8. En `reservas` hay una fila `confirmada`; el cupo bajó en 1; el
      cobro está registrado (movimiento de −N créditos, o compra) en la misma transacción.
- [ ] Dos reservas simultáneas al último cupo: una entra y la otra recibe "La clase está llena".
- [ ] La alumna cancela a tiempo: cupo liberado y lo que corresponda según §8, registrado en el
      libro.
- [ ] La academia cancela desde admin con motivo: la alumna lo ve en "Mis clases" y recibe lo
      que corresponda según §8.
- [ ] Admin intenta cambiar el precio: no puede. Owner lo cambia: la landing y la página lo
      muestran tras la revalidación.
- [ ] Intentar guardar una especial en Diaguitas el jueves a las 20:00 (Pau tiene Reggaeton
      Femme 19:30 desde esta misma semana) se rechaza por solape.
- [ ] La especial aparece en la grilla de la profesora con su título, y `inscritas_de_clase` la
      lista.
- [ ] El tablero de owner suma sus reservas en ocupación y atribución sin romper la
      conciliación.
- [ ] `npm run build` y `npm test` en verde. La política RLS de `clases` no expone borradores a
      `anon` (probado con la API, no leyendo la política).

## 11. Métrica de éxito

**Porcentaje de especiales dictadas que cubrieron su costo fijo** en los primeros 30 días. El
costo fijo es sala más base de la profesora (`CONTEXT.md` §5.b: $35.000 en Los Leones, $18.000 en
Diaguitas); el piso de alumnas sale de dividir eso por lo que deja cada una. Si la mitad de las
especiales se dicta a pérdida, el precio o el formato están mal, y ese dato es lo que hay que
saber antes de programar más.

## 12. Riesgos y supuestos

- **El nombre.** Ya dicho arriba: "clase suelta" está tomado. Si se publica con ese nombre, la
  fila de Planes va a confundir.
- **El precio no está definido.** Este PRD no lo inventa. La única referencia es que tiene que
  ser mayor que $8.500, que es lo que cuesta hoy una clase comprada de a una. Va en `parametros`
  y lo escribe Felipe.
- **Música en el video.** Un Reel en Instagram tiene la licencia de la plataforma; **un `.mp4`
  con la canción alojado en el sitio no**. El preview debería ir sin audio (se reproduce `muted`
  igual) o con audio propio. Hay que decirlo en el formulario.
- **Peso de los videos en el teléfono.** Una lista con seis videos en autoplay consume datos. La
  lista carga la miniatura y reproduce solo el que está en pantalla; la página propia sí
  reproduce de entrada.
- **Canibalización.** Si las especiales son mucho mejores que la parrilla, la parrilla se vacía.
  Se mira en la métrica de ocupación por horario del tablero, que ya existe.
- **Consentimiento de imagen.** El video es de la profesora, que es adulta y parte del equipo.
  Si aparece una alumna, aplica la regla de autorización firmada. El formulario lo pregunta.
- **Supuesto:** una especial dura una hora salvo que se diga otra cosa. El campo `fin` existe
  para las de 90 minutos, pero la validación de solape y la grilla asumen bloques de una hora
  hoy; con 90 minutos hay que revisar la grilla.
- **Supuesto:** el cron de generación no importa acá. Una especial se crea directo en `clases`,
  así que no depende de `generar_clases()`. Pero se detectó hoy que **el cron no genera desde el
  31/08**; es un pendiente aparte, no de este PRD.

## 13. Notas de implementación

Se llena al terminar.

## 14. Para retomar — estado al cierre del 08/09/2026

Lo que quedó a medias en la sesión en que se escribió este PRD, incluida la migración de Pau que
viajó en la misma rama. Nada de esto está aplicado en ninguna base.

**Migración de Pau (`20260908150000_horarios_pau_martes_y_jueves.sql`)**

- [ ] **Sin aplicar en staging ni en producción.** Felipe aprobó el push a staging, pero la CLI no
      pudo autenticarse: la contraseña que quedó en `.env.staging` (16 caracteres, sin espacios ni
      retornos) devuelve `password authentication failed for user "postgres"`. Lo mismo pasó con la
      de producción. Antes de reintentar, confirmar en el dashboard de staging (Project Settings →
      Database) cuál es la contraseña vigente o resetearla, y actualizar `.env.staging`.
- [ ] `node_modules` de este computador no tiene `pg`, aunque `package.json` lo declara: correr
      `npm install` antes de usar los scripts de staging.
- [ ] La CLI de Supabase quedó **enlazada a staging** (`supabase/.temp/project-ref` =
      `ybopuahlzbjkkwumkllk`). Para producción hay que volver a enlazar, y el push allá necesita su
      propia aprobación.
- [ ] Orden pendiente contra staging: estado previo por SQL (horarios y clases de Pau, reservas
      sobre ellas, saldos) → `migration list` → `db push --dry-run` → `db push` → estado
      posterior. Se espera: dos horarios activos de Pau (martes 20:00, jueves 19:30), cero clases
      programadas en los viejos desde el 07/09, la Girly del 08/09 en el horario nuevo, y saldos
      de créditos iguales o mayores si había reservas sobre esas clases.
- [ ] Después, lo mismo contra producción, con aprobación explícita.
- [ ] `CONTEXT.md` §4 ya muestra los horarios nuevos. Si la migración no se aplica pronto, el sitio
      y el documento van a decir cosas distintas.

**Cron de generación de clases**

- [ ] Diagnosticado, no arreglado: Vercel solo manda `Authorization` cuando la variable se llama
      `CRON_SECRET`; el proyecto usa `CRON_SECRETO`. Opciones: agregar `CRON_SECRET` en Vercel con
      el mismo valor, o renombrar en Vercel y en `app/api/generar-clases/route.ts`. Redeploy en
      ambos casos. Detalle en `ROADMAP.md`, changelog del 8 sep.

**Este PRD**

- [ ] Aprobación de Felipe.
- [ ] Fase 0 del plan: alternativa A, B o C de §8, nombre público, precio por defecto, quién crea.
- [ ] Hay despliegues Preview en Error en Vercel de los últimos seis días, sin revisar.
