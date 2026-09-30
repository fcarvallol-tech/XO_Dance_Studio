# PRD-0022 — De una landing a un sitio con páginas propias

| Campo | Valor |
|---|---|
| **Estado** | ✅ **Construido el 28/09/2026**, fases 0 a 6, **más once ajustes de Felipe el 29/09/2026** y **cuatro más al calendario** el mismo día (§14). ⏸ **Falta desplegar**: el video del hero y el visto bueno de Felipe |
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

### 8.6 ✅ La captación se retira, y el objetivo del sitio cambia (Felipe, 28/09/2026)

**Camino C.** El sitio deja de ser un folleto que capta datos y pasa a ser **un portal funcional
para las alumnas: que compren, reserven y gestionen sus clases**. Se asume que llegan sabiendo qué
es XO, porque vienen de redes sociales.

Dos consecuencias, las dos de Felipe:

- **El formulario no tiene función.** Los datos quedan al registrarse con el correo, y en este
  modelo no tiene sentido llamar por teléfono a alguien para que compre.
- **La clase de prueba gratis se elimina.** Ese incentivo pasa a los **cupones de descuento de
  PRD-0013**, para quien se inscribe por primera vez — y ahí además se puede medir, limitar y
  apagar sin desplegar, cosa que la clase gratis nunca permitió.

`CLAUDE.md` y `CONTEXT.md` quedaron actualizados con el objetivo nuevo. De paso se cerró una
pregunta que `CONTEXT.md` tenía abierta desde agosto —*"¿sobrevive la clase de prueba gratis?"*—.

**Qué se retiró y qué se conservó**, que era la parte que Felipe pidió proponer:

| Pieza | Qué se hizo | Por qué |
|---|---|---|
| `Formulario.tsx`, `ClaseDePrueba.tsx` | **Retirados** | Son el formulario y su antesala. Sin objetivo de captación no tienen función |
| `BotonInscripcion`, `Seleccion`, `PreseleccionPorUrl` | **Retirados** | Existían solo para llevar al formulario con curso y profesora preseleccionados |
| `lib/lead.ts` | **Retirado** | Validaba lo que ya nadie envía |
| `/api/lead` | **Retirado** | Una ruta que escribe en la base con la service role y que **nadie llama** es superficie de ataque sin contrapartida |
| **La tabla `leads`** | **Se conserva entera**, con su RLS y sus grants | Guarda lo que haya entrado. Instrucción explícita de Felipe |
| **`/admin/leads`** | **Se conserva** | Es la única forma de mirar esos registros. Una tabla que nadie puede leer es una tabla perdida |

**Vestigio anotado:** en producción la tabla está **vacía** —verificado el 28/09—, así que no se
perdió ningún dato. Si con el tiempo sigue vacía, retirar la tabla y su pantalla es un PRD de diez
líneas; mientras tanto no estorban.

### 8.6.b Lo que decía antes esta sección

Quedaba así, y se conserva porque explica de dónde salió la pregunta: **esto contradecía el
objetivo declarado del sitio y por eso no lo decidí yo.**

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

Construido el 28/09/2026, fases 0 a 6. Lo que se desvió y lo que solo apareció al hacerlo:

### El logo que sobresale necesita tres cosas, no una

Se ve como un detalle de CSS y se rompe por tres lados distintos: el logo **absoluto** y más alto
que la barra —si no, la estira y deja de sobresalir—, `overflow-visible` en la barra —si no, el
navegador lo recorta— y **el espacio reservado en `MarcoSitio`**, no en cada página. Esto último es
lo que importa mantener: un margen repetido en siete archivos es un margen que en el octavo se
olvida, y el síntoma sería el logo tapando el título de una sola página.

### Las tres cabeceras se volvieron una

El sitio tenía **tres**: la de la landing, la de las páginas públicas nuevas y la del perfil de
profesora, cada una con su logo y su acción a la derecha. Con siete páginas eso deja de ser una
duplicación tolerable y pasa a ser tres sitios que se parecen. Ahora es `MarcoSitio`.

### Un caso que no había previsto

Las anclas viejas (`/#planes`) se rescatan con un componente cliente, porque **el navegador no
manda lo que va después del `#`** y una redirección de servidor nunca las ve. Pero al probarlo
apareció otro caso: si alguien **ya está en la portada** y aprieta un enlace viejo, el navegador
solo cambia el hash y no vuelve a montar nada, así que el rescate no corría. Se resolvió
escuchando `hashchange`, y el verificador prueba los dos caminos.

### Lo verificado

`scripts/verificar-sitio.mjs`, con Chromium en **375, 768 y 1280**: **19 de 19**. Ninguna página
desborda a lo ancho, el logo es más alto que la barra y sobresale **sin tapar el título**, los seis
caminos y Mi Cuenta están, el CTA viejo y "Entrar" ya no, el menú móvil abre, la portada quedó con
el eslogan y los packs, y las tres anclas viejas rescatan.

Y el chequeo de rutas de PRD-0020, otra vez: las ocho públicas responden 200 sin sesión, y las
siete privadas redirigen cada una con **su** `volver`.

### ⚠️ Lo que falta antes de publicar

- ~~**El texto de Nosotros**~~ y ~~**las tres preguntas frecuentes**~~: resueltos en los ajustes
  9 y 10 del 29/09. No queda nada marcado como "Falta" en pantalla.
- **El video del hero.** La portada mínima depende mucho más de él que la anterior: hoy el hero es
  negro plano y la portada quedó corta.


---

## 14. Los once ajustes del 29/09/2026

Felipe miró el sitio construido y pidió once cambios "en una pasada, commiteando por bloque". Van
acá porque son del mismo trabajo, no de un PRD nuevo: ninguno cambia una decisión de §8.

| # | Qué pidió | Cómo quedó |
|---|---|---|
| 1 | El logo quedó cortado y el efecto no era el de deathwishcoffee: la barra tiene que **acompañar la forma del logo**, no que el logo sobresalga a secas | Un bulto negro con borde, anclado a la izquierda de `<header>`, con la esquina inferior derecha redondeada. **El borde es lo que hace visible el efecto**: negro sobre negro no se ve |
| 2 | La sección de planes de la portada: título "Elige el pack que más te guste" y **tres cuadros** —clases sueltas, packs, especiales | `CaminosPortada` |
| 3 | Debajo, **profesoras en la portada**: foto y nombre, cada una a su perfil | `ProfesorasPortada` |
| 4 | **Alternancia de fondos**: packs en rosado con letras negras, profesoras en negro, pie siempre negro | Rosa XO solo como **fondo de bloque** con texto `xo-negro`, nunca como color de texto sobre claro (`BRAND.md`) |
| 5 | El calendario como **grilla semanal** en tramos de media hora, con la media marcada más tenue, porque hay clases de hora y media | `GrillaCalendario` + `lib/dominio/grilla.ts` con 11 tests. **No se reusó `GrillaSemanal`**: esa apila las clases en una lista sin eje de tiempo, y en una lista todas las clases miden lo mismo. Segunda vuelta más abajo: siete días siempre, cuadrícula completa y un día a la vez en el teléfono |
| 6 | Página de profesoras: título nuevo, **buscador por nombre y filtro por estilo** | `BuscadorProfesoras`. Los estilos **salen de los horarios**, no de una lista a mano: un segundo lugar donde viva el catálogo es la incoherencia que este repo ya tuvo |
| 7 | "Compras clases, no un mes" → "Compra un pack de clases y prueba distintos estilos" | `/comprar` |
| 8 | "Una coreo, una fecha" → "Encuentra apasionantes proyectos de nuestras profesoras" | `/clases-especiales` |
| 9 | Nosotros: fuera la advertencia de borrador y dos párrafos | `/nosotros` |
| 10 | Reescribir dos preguntas frecuentes, borrar la de ir a mirar, y **ninguna promesa de plazo** para los reclamos | `lib/ayuda.ts`. La respuesta de cómo llegar cubre **dos sedes**: EB Dance Studio no aparece, y **no se dice que falta** |
| 11 | Instagram nuevo: `@xo.dance.co` | `lib/contacto.ts`. Los Instagram personales de las profesoras **no se tocaron** |

### La dirección de Los Leones

El ajuste 10 también cambia el dato, no solo el texto: la sala Seducción Latina es **Av. Nueva
Providencia 2260, local 130, piso 3**. Está en
`supabase/migrations/20260929120000_direccion_de_los_leones.sql`, **aplicada en staging el
29/09/2026** con la aprobación de Felipe. Comprobado leyendo la fila después: el nombre, la comuna
y la referencia quedaron como estaban. **Falta producción**, que necesita su propia aprobación.

### Cuatro profesoras, no cinco

Al verificar apareció que el sitio muestra **cuatro** profesoras y no cinco. No es un bug: Maida
está inactiva a propósito desde que K-Pop salió del catálogo (Felipe, 29/09/2026). Lo que sí
estaba mal era lo escrito alrededor —la descripción de `/nuestras-profes` decía "las cinco
profesoras"— y, de paso, apareció que `CLAUDE.md` seguía nombrando `lib/cursos.ts` y
`lib/profesoras.ts` como fuente única de horarios, cupos y profesoras. **Esos dos archivos ya no
existen**: el catálogo vive en la base desde PRD-0010. Corregido, porque un `CLAUDE.md` que manda
a un archivo borrado le cuesta una hora a la sesión siguiente.

### Tres componentes que se fueron

`Lineup.tsx`, `Planes.tsx` y `QueEsXo.tsx` eran secciones de la página única. Nadie las importaba
después de esta reorganización. Se borran: un componente huérfano que dice el título viejo se lee
como vigente.

### Lo verificado

`scripts/verificar-sitio.mjs` creció de 19 a **31 casos, todos como se esperaba**, con Chromium a
375, 768 y 1280.

Lo que se agregó no es "la página carga": el buscador se **escribe** y se cuenta cuántas profes
quedan, el chip de estilo se **aprieta**, y del calendario se mide **el bloque dibujado** —su alto
contra los tramos que dice ocupar, su borde de arriba contra el tramo en que dice empezar, y la
hora impresa contra el eje. Una grilla que dibujara todo del mismo alto, o corrida media hora,
compila igual de bien.

**Dos de los casos que escribí primero estaban mal, no el código**, y vale anotarlo porque es el
mismo error de siempre —afirmar cómo se comporta algo en vez de mirarlo—: di por hecho que la
grilla mostraría **los siete días** (en ese momento mostraba solo los que tenían clases —lo que
se revirtió después, ver "El calendario, segunda vuelta"—) y que cada bloque imprimiría un **rango**
horario (las clases de una hora muestran solo el inicio, que es justo la regla que pidió PRD-0021).

### El calendario, segunda vuelta (Felipe, 29/09/2026)

Mirando la grilla, Felipe pidió cuatro cambios más. El primero **revierte** lo que arriba quedó
como deliberado: ocultar los días sin clases hacía que la semana pareciera empezar el martes, y
un día vacío también es un dato.

| # | Qué pidió | Cómo quedó |
|---|---|---|
| a | **Los siete días siempre**, aunque no tengan clases | Las columnas salen de `diasDeLaSemana(lunes)`, no de las clases |
| b | **Sin el número de la fecha** en los encabezados | Solo el nombre del día. Como sin fecha nada decía qué semana se estaba mirando, el rango ("Del 28 de septiembre al 4 de octubre") va **una vez**, junto a Antes / Después |
| c | **Cuadrícula completa**, como Google Calendar | Borde exterior, línea vertical entre días y horizontal en cada tramo; la hora en punto más marcada y la media más tenue, como antes. Tipografía y colores, los de `BRAND.md` |
| d | Siete columnas en el teléfono quedan angostas: proponer | **Bajo `lg`, un día a la vez** (era `md`; ver los lugares, más abajo), con los siete días como botones arriba (los que tienen clases llevan un punto). Abre en hoy si le quedan clases, si no en el primer día con clases de la semana. Desde `lg`, la semana entera. Es el mismo DOM con otras clases de CSS, no dos grillas |

**Por qué d y no otra cosa:** a 375 px siete columnas son de unos 44 px, donde no cabe "Salsa ·
19:30 · Pau · 8 lugares", y cortar el texto justo donde está lo útil es peor que no mostrarlo. Se
descartó el scroll horizontal que había, porque con siete columnas esconde más de la mitad de la
semana, y la vista de tres días, porque parte la semana en pedazos que no calzan con lunes a
domingo.

**Un error que apareció al hacer a:** las semanas se armaban agrupando las clases, así que
**una semana sin clases no existía** y "Después" saltaba dos de una vez sin que se notara. Además
se contaban con `getDay()` del navegador, que empieza la semana en domingo. Ahora las da
`semanasDeLaGrilla` en `lib/dominio/grilla.ts` —continuas, desde la de hoy hasta la de la última
clase, en días de Santiago—, con 8 tests. El `hoy` lo pasa la página desde el servidor, para que
la grilla y los datos usen el mismo día.

**Verificado:** `scripts/verificar-sitio.mjs` pasa de 31 a **39 casos, 39/39**. Los que esperaban
"solo días con clases" ahora piden los siete, en orden, sin números y con su línea vertical. Se
suman: el rango impreso junto a los botones, que **cada "Después" avance exactamente siete días**
—leído del rango que ve la persona, no del estado del componente; hoy son ocho saltos de 7—, y a
375 px siete botones, una sola columna visible que es la del botón marcado, y que tocar otro día
la cambie. `npm test` 152/152 y `npm run build` limpios.

**Los lugares en las clases de una hora (Felipe, 30/09/2026).** Al revisar las capturas apareció
que un bloque de una hora —56 px— se cortaba después de la profesora, y **los lugares, que
estaban al final, no se veían**. Es el dato que decide si alguien reserva. Se ordenó el bloque
por importancia, porque lo que no cabe se corta por abajo: nombre, luego **hora y lugares en la
misma línea** —se parte sola donde la columna es angosta—, luego la profesora y, si hay alto, la
sala. Se descartó achicar la fuente —11 px ya es el piso legible— y sacar la profesora, que sigue
saliendo cuando cabe. El verificador suma un caso por ancho que **mide** que el texto de los
lugares quede dentro de la caja: con `overflow: hidden` el texto cortado sigue en el DOM, así que
buscarlo por contenido daría por bueno justo lo que estaba roto.

Ese caso encontró algo más: **a 768 px seguían cortados** (Reggaeton Femme y Slow Femme). Siete
columnas en una tablet dejan unos 65 px de texto, el nombre y la línea de hora y lugares se parten
en dos cada uno, y no caben en 56 px. **La semana entera pasa de `md` a `lg`**: bajo 1024 px se ve
un día a la vez, como en el teléfono. Se mide en 375, 768, 1023, 1024 y 1280, los dos del medio
para clavar el borde. Verificador **44/44**. Lo que sí se corta ahora, donde el nombre ocupa dos
líneas, es la profesora: es el orden elegido.

### El logo, segunda vuelta (Felipe, 30/09/2026)

Dos cambios a la cabecera del ajuste 1:

| # | Qué pidió | Cómo quedó |
|---|---|---|
| a | El bulto quedó **rectangular**: en deathwishcoffee.com la barra baja **en curva** alrededor del logo | El bulto pasa de `div` con una esquina redondeada a **un SVG en cuenco** que cuelga bajo la barra. Su trazo sale de la línea de la barra con un redondeo, baja rodeando el logo y vuelve a subir: se lee como la misma línea estirándose, sin paredes verticales dentro de la barra. Ajustado al contorno del logo —216 × 64 px en escritorio, 144 × 26 en móvil—, no más grande |
| b | El logo estaba **pegado al borde** izquierdo | Bulto y logo se separan del borde de la ventana —12 px en móvil, 32 en `sm`, 40 en `lg`— y siguen anclados a ella, no al contenedor centrado |

**Mirado en la referencia con Chromium**, no con fetch: allá el cuenco es el mismo círculo negro
del logo, que queda medio dentro y medio fuera de la barra.

**Verificado** con el sitio construido contra **staging** en un puerto aparte (`.env.local` apunta
a producción): verificador **44/44**, sin desborde a 375 y 1280, y el contenido sigue empezando
debajo del cuenco (168 px en escritorio, 128 en móvil). **A 1024 px la barra desborda 142 px**: los
seis enlaces y Mi Cuenta no caben en una línea. **No es de este cambio**: `main` desborda lo mismo,
medido. El verificador no lo ve porque mide 375, 768 y 1280. Queda pendiente.
