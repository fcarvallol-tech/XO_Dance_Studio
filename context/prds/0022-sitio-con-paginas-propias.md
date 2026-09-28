# PRD-0022 — De una landing a un sitio con páginas propias

| Campo | Valor |
|---|---|
| **Estado** | **Borrador.** Propuesto el 28/09/2026 a pedido de Felipe. §8 tiene sus cuatro decisiones tomadas; **§8.6 es una pregunta abierta y bloquea la fase 1** |
| **Autor** | Claude, a pedido de Felipe Carvallo |
| **Fecha** | 28 de septiembre de 2026 |
| **Hito** | Hito 0 — Lanzamiento |
| **PRDs relacionados** | PRD-0001 y PRD-0003 (la landing y la captación) · PRD-0014 (precios) · PRD-0016 (sedes) · PRD-0017 (reservas) · PRD-0018 (clases especiales) · PRD-0020 (links de compra) · `BRAND.md` |

---

## 1. Problema

La página es **una sola con scroll**: hero, qué es XO, profesoras, cursos, planes, sedes, clase de
prueba y formulario, todo apilado. Eso funcionaba cuando el sitio era un folleto con un formulario
al final y no había nada detrás.

Ya no es así. Detrás hay **cuentas, packs que se compran, un calendario de 60 días, clases
especiales con página propia y links de compra compartibles**. Y la página sigue tratando a todo
como una sola cosa que se recorre de arriba abajo:

- **Quien ya es alumna** tiene que pasar por el material de captación para llegar a lo suyo, y el
  único acceso a su cuenta es un enlace chico en la barra.
- **Quien quiere ver horarios** no puede: el calendario vive detrás de la sesión.
- **Quien llega por un link de una clase especial** aterriza en una página propia, y si vuelve al
  inicio se encuentra con una estructura que no se parece en nada.
- **Quien tiene una duda** —cómo funcionan los packs, qué pasa si no puede ir, a quién reclama— no
  tiene dónde leerla.

El pedido de Felipe, textual: **"no abrumar con información mezclada"**. Cada cosa a su página, y
la portada reducida a lo que de verdad es primera impresión.

## 2. Usuario y contexto de uso

| Quién | Qué busca | Hoy |
|---|---|---|
| **Visitante que llegó por Instagram** | Ver si le acomoda: horarios, profes, precios | Todo mezclado en un scroll |
| **Visitante que ya decidió** | Comprar un pack | Tiene que bajar hasta Planes |
| **Alumna** | Su calendario y su cuenta | Un enlace chico que se agregó el 26/09 |
| **Alguien con una duda** | Cómo funciona, a quién le escribe | No existe |
| **Quien quiere reclamar** | Un canal formal | No existe |

## 3. Alcance

1. **Barra nueva**: Calendario · Nuestras Profes · Packs de clases · Clases Especiales · Nosotros ·
   Ayuda, y **"Mi Cuenta"** como botón a la derecha. Desaparecen el CTA "Reservar clase" y el
   enlace "Entrar".
2. **El logo sobresale de la barra**, más alto que ella, anclado a la izquierda (§8.5).
3. **Portada mínima**: el video con el eslogan, los packs, y poco más (§8.4).
4. **`/calendario` público**: horarios, profesora, sede y cupos **sin sesión**. Reservar pide
   entrar y vuelve a la misma clase (§8.3).
5. **`/nuestras-profes`**: el lineup, que hoy vive en la portada. Cada una sigue teniendo su
   `/profesoras/<slug>`.
6. **`/nosotros`**: qué queremos transmitir y qué nos motiva. **Las sedes van dentro**, como un
   dato, no como el tema (§8.2).
7. **`/ayuda`**: preguntas frecuentes, contacto y gestión de reclamos (§8.1).
8. **Packs y Clases Especiales** ya existen —`/comprar` y `/clases-especiales`— y solo entran a la
   barra.
9. **Una sola cabecera y un solo pie para todo el sitio público**, en vez de las tres variantes de
   hoy.

## 4. Fuera de alcance

- **Rediseñar la identidad.** `BRAND.md` manda y no se toca: mismos tokens, misma tipografía,
  mismas reglas de contraste. Cambia la **distribución**, no la estética.
- **El video del hero.** Sigue pendiente de Carla; la portada queda lista para recibirlo.
- **Tocar los portales** (`/mis-clases`, `/admin`, …). Esto es el sitio público.
- **Cambiar precios, packs o el modelo de créditos.**
- **Un blog, novedades o cualquier sección nueva** que no esté en la lista de §3.
- **Traducir o duplicar contenido legal.** `/privacidad` y `/terminos` quedan como están.

## 5. Flujo principal

1. Alguien llega a `/`. Ve el video con el eslogan y, bajando, los packs. Nada más.
2. Si quiere ver cuándo hay clases, aprieta **Calendario** y las ve **sin que le pidan nada**.
3. Elige una y aprieta **Reservar**: ahí sí le piden el correo, entra con el enlace, y **vuelve a
   esa misma clase**.
4. Si en cambio quiere saber quiénes son, **Nuestras Profes**; si le interesa la academia,
   **Nosotros**; si tiene una duda, **Ayuda**.
5. Si ya es alumna, **Mi Cuenta** a la derecha, separado de todo lo comercial.

## 6. Casos borde y errores

| Caso | Qué pasa |
|---|---|
| Alguien con sesión aprieta "Mi Cuenta" | Va a su inicio según su rol, como hoy hace `/entrar` |
| Alguien sin sesión aprieta "Mi Cuenta" | Va a `/entrar`, y de ahí a lo suyo |
| El calendario no tiene clases en 60 días | Lo dice y ofrece los packs. No una página en blanco |
| Alguien sin sesión aprieta Reservar | `/entrar?volver=/calendario` … ver §8.3, que tiene un detalle |
| Un enlace viejo a `/#planes` o `/#profesoras` | **Hay que redirigirlo.** Están en Instagram y en los perfiles de profesora (§9.4) |
| Móvil a 375px con seis enlaces | No caben en línea: hace falta un menú. Ver §8.5 |
| El logo sobresaliendo tapa contenido | El contenido arranca debajo de lo que el logo ocupa, no de la barra |

## 7. Modelo de datos

**Ninguna tabla nueva.** Todo el contenido que estas páginas muestran ya existe: `cursos`,
`profesoras`, `sedes`, `horarios`, `planes`, `clases`. Las preguntas frecuentes van **en el
código**, no en la base: son seis u ocho textos que cambian dos veces al año, y una tabla para eso
es infraestructura que hay que mantener sin nada a cambio.

Si algún día se quieren editar desde el Table Editor, se mueven — pero entonces hay que resolver
también la revalidación, y hoy **el webhook de revalidación ni siquiera existe**
(`ARCHITECTURE.md` §10).

## 8. Decisiones

### 8.1 Ayuda es una página propia ✅ (Felipe, 28/09/2026)

Con tres bloques: **preguntas frecuentes**, **contacto** y **gestión de reclamos**.

**Sobre enlazar lo legal desde Ayuda: sí, conviene.** Están en el pie y ahí seguirán, pero el pie
es donde se buscan *cuando ya se sabe que existen*. Alguien con un problema entra a Ayuda, y si lo
que necesita es la política de privacidad —"¿qué hacen con los datos de mi hija?"— no tiene por qué
volver a buscar. Se enlazan desde Ayuda **sin duplicar el texto**.

**Las preguntas frecuentes propuestas**, a partir de lo que el proyecto ya sabe. Las marcadas con
⚠️ **las tiene que completar Felipe**: son datos que no están en ninguna parte y **no se inventan**.

| # | Pregunta | De dónde sale la respuesta |
|---|---|---|
| 1 | ¿Cómo funcionan los packs? | `CONTEXT.md` §5.b: se compran clases, no un mes; sirven para cualquier clase de la parrilla, con cualquier profe y en cualquier sede; 60 días para usarlas |
| 2 | ¿Tengo que venir siempre el mismo día? | No. Es el corazón del crédito universal (ADR-0002) |
| 3 | ¿Cómo pago? | Transferencia, y nos avisas por la web. Te acreditamos al confirmar (PRD-0017) |
| 4 | ¿Qué pasa si no puedo ir? | Cancelas hasta 30 minutos antes y recuperas la clase; después, no. Si cancelamos nosotras, se devuelve siempre (PRD-0006) |
| 5 | ¿Qué son las clases especiales? | Coreografía puntual, fuera de la parrilla, con precio propio; **se pagan aparte** y no usan las clases del pack (PRD-0018) |
| 6 | ¿Desde qué edad? | 15+ en la parrilla; Teens es de 11 a 15 (`lib/lead.ts`, `CONTEXT.md`) |
| 7 | ¿Necesito experiencia? | Los cuatro cursos de la parrilla son de nivel principiante (PRD-0018 §1) |
| 8 | ¿Qué llevo a la clase? | ⚠️ **Felipe**: ropa, calzado, si hay que llevar agua, si hay camarines |
| 9 | ¿Cuánto dura una clase? | Una hora en la parrilla. Las especiales lo dicen en su página |
| 10 | ¿Dónde son las clases? | Las tres sedes con dirección, enlazando a Nosotros |
| 11 | ¿Hay estacionamiento? ¿Cómo llego? | ⚠️ **Felipe**: metro más cercano de cada sede, estacionamiento |
| 12 | ¿Puedo ir a mirar antes? | ⚠️ **Felipe**: hoy no hay política escrita |

### 8.2 Las sedes van dentro de Nosotros, pero no son el tema ✅ (Felipe, 28/09/2026)

El propósito de esa página es **qué queremos transmitir como academia y qué nos motiva**. Las sedes
son un dato dentro de eso.

⚠️ **El texto de Nosotros lo tiene que escribir Felipe o Carla.** Hay materia prima en el proyecto
—`BRAND.md` §7 tiene la voz, `CONTEXT.md` la visión de plataforma de talentos, y existe el eslogan
"Acá nadie baila sola"— pero **qué los motiva no está escrito en ninguna parte y no se inventa**.
La página se construye con la estructura y un texto marcado como provisional, evidente, para que no
se publique por descuido.

### 8.3 El calendario se ve sin sesión ✅ (Felipe, 28/09/2026)

Horarios, profesora, sede y cupos. Reservar pide entrar y vuelve a la misma clase.

⚠️ **Un detalle que el patrón actual no cubre.** `?volver=` guarda **el pathname**, así que devuelve
a `/calendario` pero **no a la clase que la persona había elegido**. Con las clases especiales no
pasa porque cada una tiene su URL; una clase de la parrilla no la tiene.

Propuesta: **darle URL propia a la reserva de una clase**, `/reservar/<id>`, igual que
`/reservar-especial/<slug>`. Es el mismo patrón ya resuelto dos veces, y hace que el `volver`
funcione sin tocar el proxy —que es la pieza que ya produjo un bucle (PRD-0004 §12)—.

**Y el calendario público no puede usar `getCalendario` tal cual:** recibe un `perfilId` y marca
cuál clase ya reservó quien mira. Se necesita una versión sin sesión, que es la misma consulta sin
esa parte.

### 8.4 La portada queda mínima ✅ (Felipe, 28/09/2026)

**Se queda:** el video con el eslogan y los packs que vendemos.

**Se muda:** profesoras → `/nuestras-profes` · cursos → `/calendario` y `/nuestras-profes` · sedes
→ `/nosotros` · qué es XO → `/nosotros`.

**Queda pendiente de decidir:** la sección "clase de prueba" y el formulario de captación. Ver
§8.6, que es la pregunta abierta.

### 8.5 El logo sobresale de la barra

Más alto que la barra, anclado al **costado izquierdo**, sobresaliendo hacia abajo. Referencia de
efecto: Death Wish Coffee, pero a la izquierda en vez de centrado.

⚠️ **Fui a mirar esa referencia y no pude confirmar el efecto**: lo que devuelve es un header
estándar sin desborde. Así que la especificación es la de Felipe, no la del sitio: logo más alto
que la barra, sobresaliendo por abajo, a la izquierda.

Lo que hay que resolver al construirlo, y que el diseño tiene que contemplar:

- **El contenido arranca debajo del logo**, no de la barra, o el logo tapa lo primero de cada
  página.
- **En móvil el logo no puede comerse la barra**: a 375px, un logo grande más seis enlaces más el
  botón no caben. La barra móvil lleva menú, y el logo se achica —sin dejar de sobresalir— o se
  reduce a la marca.
- **Al hacer scroll**: o se queda igual —más simple, y el desborde acompaña toda la página— o se
  achica. Propuesta: **que se quede**, porque achicarlo es una animación que `BRAND.md` no pide y
  el proyecto tiene la regla de "poco movimiento y con intención".

### 8.6 🔴 Pregunta abierta: ¿qué pasa con la captación de leads?

**Esto contradice el objetivo declarado del sitio y por eso no lo decido yo.**

`CLAUDE.md` dice, como primera regla del sitio público:

> *"Que la visitante deje sus datos para una clase de prueba gratis en el curso que le interese.
> Todo lo que no sirva a ese objetivo, sobra."*

El CTA "Reservar clase" que desaparece de la barra es **exactamente el botón que lleva a ese
formulario**. Y el formulario —`Formulario.tsx`, 424 líneas, con validación compartida
cliente/servidor, preselección por URL y medición de origen— es la pieza más trabajada del sitio
público. Detrás hay una tabla `leads`, una API, y una página de admin para verlos.

Tres caminos posibles:

| | Qué implica |
|---|---|
| **A. El formulario se queda, en la portada** | La portada deja de ser "mínima": el formulario es largo. Contradice §8.4 |
| **B. Se muda a su propia página** (`/clase-de-prueba`) y se enlaza desde Ayuda y la portada | La portada queda mínima y la captación sigue existiendo, con un clic de distancia |
| **C. Se retira** | El sitio pasa de captar leads a vender directo. Es coherente con una barra que ofrece comprar packs y reservar, pero **cambia el objetivo declarado del negocio** y deja sin uso `leads`, `/api/lead` y `/admin/leads` |

**Mi recomendación es B**, y con una razón concreta: la captación sirve a quien **todavía no está
lista para comprar**, y esa persona existe —es la que llega por Instagram sin saber qué es XO—. Con
la barra nueva, alguien así no tiene ninguna puerta que no sea pagar. B conserva esa puerta sin
volver a mezclar la portada.

**Si es C, hay que actualizar `CLAUDE.md` y `CONTEXT.md`**, porque es un cambio de modelo, no de
maquetación.

## 9. Reglas de negocio

1. `BRAND.md` manda en todo lo visual: tokens `xo-*`, nada de hex sueltos, rosa nunca como texto
   sobre claro, copy en español de Chile.
2. **Una sola cabecera y un solo pie** para todas las páginas públicas.
3. El calendario público **no muestra datos de nadie**: horarios, profesora, sede y cupos. Nunca
   quién reservó.
4. **Los enlaces viejos no se rompen.** `/#planes`, `/#profesoras`, `/#cursos` y `/#sedes` están
   publicados en Instagram y en los perfiles de profesora: redirigen a su página nueva.
5. Mobile-first: la barra tiene que funcionar a 375px antes que en escritorio.
6. Ninguna página nueva exige sesión.

## 10. Criterios de aceptación

- [ ] La barra tiene los seis enlaces y "Mi Cuenta" a la derecha, y **no** tiene "Reservar clase"
      ni "Entrar".
- [ ] El logo sobresale de la barra por abajo, anclado a la izquierda, y **no tapa** el contenido
      de ninguna página.
- [ ] A **375px** la barra funciona: el logo se ve, el menú abre, "Mi Cuenta" se alcanza, y no hay
      scroll horizontal en ninguna página.
- [ ] La portada tiene el hero y los packs. Las profesoras, las sedes y los cursos **ya no están**.
- [ ] `/calendario` se ve **sin sesión**, con horarios, profesora, sede y cupos.
- [ ] Reservar desde `/calendario` sin sesión lleva a `/entrar` y **vuelve a esa misma clase**.
- [ ] `/nuestras-profes` lista las cinco y cada una lleva a su perfil.
- [ ] `/nosotros` cuenta la academia y muestra **las tres sedes** con dirección.
- [ ] `/ayuda` tiene las preguntas frecuentes, el contacto y el canal de reclamos, y enlaza lo
      legal.
- [ ] `/#planes`, `/#profesoras`, `/#cursos` y `/#sedes` **no dan 404**.
- [ ] Ninguna ruta privada quedó accesible sin sesión: se abre cada una y se mira a dónde va.
- [ ] `npm run build` y `npm test` en verde.

## 11. Métrica de éxito

**Que alguien que llega por Instagram encuentre lo que busca sin scrollear la portada entera.**
Medible cuando existan métricas por página; mientras tanto, la señal es que Carla pueda mandar el
link de una sección concreta en vez de "mira la página y baja hasta…".

## 12. Riesgos y supuestos

- **El riesgo está en la barra y en `lib/rutas.ts`, no en las páginas nuevas.** Cada página nueva
  es contenido; la barra la ve todo el sitio y el guard decide qué exige sesión. Los criterios de
  §10 incluyen abrir cada ruta privada sin sesión, que es la lección de PRD-0020.
- **Dos textos no los puedo escribir yo:** el de Nosotros y tres preguntas frecuentes. Si se
  publican con relleno, el sitio dice cosas que nadie decidió. Van marcados como provisionales.
- **El video del hero sigue sin existir.** La portada mínima depende mucho más de él que la actual:
  si el hero es negro plano, la portada queda casi vacía. Es un riesgo de percepción, no técnico.
- **Supuesto: los seis enlaces caben en escritorio.** A 1280px con el logo grande, hay que medirlo.
- **`/calendario` sin sesión agrega una página que lee la base en cada visita.** Se resuelve con
  revalidación como el resto del catálogo, pero el cupo cambia seguido: hay que elegir la ventana
  con criterio.

## 13. Notas de implementación

Se llena al terminar.
