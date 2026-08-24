# BRAND.md — Manual de marca XO Dance Studio

> Fuente de verdad de identidad verbal y visual.
> **Reemplaza a `docs/marca.md`.** Al adoptar este sistema de contexto, borrar `docs/marca.md`
> y apuntar `CLAUDE.md` acá, para que el dato viva en un solo lugar.
> Las reglas de *implementación* visual siguen viviendo en `.claude/rules/estilo.md`, que se
> carga solo cuando se editan `.tsx`. Este documento es el porqué; ese archivo es el cómo.

---

## 1. Qué es XO

**Academia de baile** en Las Condes. El nombre viene de **XO** — *kiss & hug* —
que representa afecto, feminidad y la comunidad que se forma dentro de la academia.

**Tagline:** *"Un lugar donde bailar también significa sentirte parte."*

### Valores
- **Comunidad** — las alumnas no solo aprenden a bailar, hacen amigas reales
- **Cercanía** — las profesoras son accesibles, cálidas y genuinamente apasionadas
- **Actitud** — el baile en XO es empoderador: te hace sentir segura, poderosa y femenina
- **Autenticidad** — nada forzado. El ambiente es real, no performativo

### Personalidad
Femenina, vibrante, cercana, con actitud. No es seria ni fría: es como tu amiga que baila
increíble y te contagia las ganas.

### Lo que XO NO es
No es una academia masiva ni impersonal · no es seria ni distante · no es solo técnica ·
no usa neón ni efectos brillantes · no mezcla muchos colores en un diseño · no es ballet ni
danza contemporánea.

---

## 2. Arquitectura de marca

```
XO Dance Studio          ← marca paraguas
├── XO Teens    (11–15)  ← curso de entrada
├── XO Girly    (16+) ── Básico · Intermedio
└── K-Pop       (11+)
```

**XO Kids (7–10) salió del catálogo el 21/08/2026** y ya no es una submarca: la franja deja de
ofrecerse y las alumnas migran a Teens, que pasa a ser el curso de entrada. En código el id `kids`
sobrevive desactivado para que los leads históricos sigan siendo legibles, pero no se nombra en
ninguna pieza de comunicación. Desde el 24/08/2026 **K-Pop también parte en los 11**, así que hoy
la academia entera es de 11 años para arriba.

Las submarcas **no son marcas distintas**: son la misma marca hablando con tonos distintos
según a quién le habla. Mismo logo, misma tipografía, misma estructura. Cambia la voz.

Escribir siempre "XO" en mayúsculas, sin puntos ni espacios internos.

---

## 3. Arquetipo ⚠️ PENDIENTE

Modelo de 12 arquetipos de Mark & Pearson. La selección la hace Carla.

Reglas ya definidas:

1. **Un solo arquetipo primario** para XO Dance Studio, expresado en tonos distintos por
   submarca. No un arquetipo por curso.
2. Debe reflejar **la transformación que vive la alumna**, no con qué se identifican los
   fundadores.
3. **Amante no puede ser el primario de la marca paraguas.** Aunque XO Kids sale del catálogo,
   Teens sigue siendo público menor de edad (11–15) y quien compra sigue siendo la mamá. La
   restricción se mantiene, con menos margen que antes: puede funcionar como secundario y solo
   dentro de Girly.

Mientras no se resuelva, el copy se escribe sobre los valores de §1, que sí están acordados.

---

## 4. Color

Estos valores están **resueltos** y viven implementados como tokens `@theme` en
`app/globals.css`. Tailwind v4: no hay `tailwind.config.ts`.

| Token | Hex | Uso |
|---|---|---|
| `xo-negro` | `#1A1A1A` | Fondo base de casi toda la página |
| `xo-negro-alt` | `#232323` | Superficies elevadas sobre negro (tarjetas, fichas) |
| `xo-rosa` | `#F7ADBF` | Color estrella. Acentos, botones, títulos sobre negro |
| `xo-rosa-claro` | `#F2D0DC` | Acento secundario, texto sobre negro, territorio Teens |
| `xo-blanco` | `#F7F7F7` | Texto sobre negro, fondo de las pocas secciones claras |
| `xo-gris` | `#6B6B6B` | Texto secundario sobre fondos claros |

> Nota histórica: el documento estratégico de junio de 2026 mencionaba un rosa `#D4A0B0` y
> DM Sans. **Está superado.** El sistema vigente es el de esta tabla.

**Contraste verificado, sin excepciones:**
- Rosa sobre negro 9.7:1 y rosa claro sobre negro 12.3:1 → sirven para todo, incluido texto chico
- Gris sobre blanco 5.0:1 → texto secundario
- **Rosa sobre blanco 1.7:1 → PROHIBIDO para texto.** Solo bordes, líneas, fondos de bloque
- **Gris sobre negro 3.3:1 → PROHIBIDO para párrafos.** Usar `xo-rosa-claro` o `xo-blanco` con opacidad

Botones primarios: fondo `xo-rosa`, texto `xo-negro`. Nunca blanco sobre rosa.

---

## 5. Tipografía

Tres roles, sin excepciones. Cargadas vía `next/font/google`.

- **Bebas Neue** (`font-display`) — títulos grandes. Es la voz de la página. Mayúsculas,
  `leading-none`, tracking apenas positivo.
- **Cormorant Garamond** (`font-serif-xo`) — frases sueltas y taglines, en itálica. Con
  moderación, como contrapunto.
- **Montserrat** (`font-sans`) — cuerpo, formularios, datos prácticos. Neutra a propósito.

La escala completa está en `.claude/rules/estilo.md`. Un solo `h1` por página.

---

## 6. Sistema visual

- Negro como fondo base, rosa como protagonista
- Estrellas `✦` como separador o viñeta, con criterio. No regadas
- Grano/ruido muy sutil sobre los fondos negros: se intuye, no se ve
- Mucho espacio negativo. La página respira, no se llena
- Sin degradados, sin sombras difusas, sin efectos brillantes, sin neón
- Sin tarjetas de "3 columnas con ícono + título + texto"
- Sin stock photos. Si falta una imagen, placeholder evidente

**Logo:** una **X** y un **corazón ♡** con trazo de pincel, gestual y expresivo, en rosa
`#F7ADBF` sobre negro. Debajo, "Dance Studio" en tipografía espaciada.

**Referencia visual:** Wild Dance Lab (@wildsdancelab).

### Calendario — patrón visual propio

El calendario aparece en los cuatro portales y es la pieza de interfaz más importante del
producto. Al filtrar por profesora, las clases de esa profesora **ganan protagonismo** (color
sólido de marca, mayor peso) y el resto **retrocede** (opacidad reducida), en vez de
desaparecer. Se mantiene el contexto completo de la semana y se destaca lo relevante.

⚠️ Cuidado con el contraste: al bajar opacidad, el texto debe seguir siendo legible. Una clase
atenuada no puede volverse ilegible — es información, no decoración.

---

## 7. Voz y copy

Español de Chile, escrito desde el lado de la alumna. Específico antes que ingenioso. Los
botones dicen exactamente qué pasa al apretarlos. Sin cadenas de exclamaciones, sin emojis
regados, sin traducir desde inglés.

**Test:** si una frase podría estar en la landing de cualquier academia de baile, se reescribe.

| | Teens | Girly y K-Pop |
|---|---|---|
| **Le habla a** | La mamá | La alumna |
| **Emoción** | Confianza y entusiasmo | Aspiración y pertenencia |
| **Promesa** | "Tu hija va a esperar el día de la clase toda la semana" | "Lo que te aprendiste sola en tu pieza, ahora con el grupo completo" |

**Nunca** lenguaje sexualizado en comunicación de Teens: son menores de 11 a 15 años. En Girly, sensualidad elegante:
empoderamiento y actitud, nunca vulgaridad.

**Reglas de negocio que afectan el copy:**
- Los precios no se publican mientras estén sin definir. Se informan al contactar
- **CTA principal: "Reservar clase"** (antes "Reservar clase gratis"). Quitar la palabra
  "gratis" cambia la promesa: ya no se ofrece una prueba sin costo, se ofrece reservar
- **La pregunta de captación es por profesora, no por curso:** "¿Con quién quieres tomar
  clases?". Pone a las profesoras al centro, coherente con la visión de plataforma de talentos
- La dirección exacta no se publica: solo "Las Condes, Santiago". Se entrega por WhatsApp
- La fecha exacta de lanzamiento no se publica: solo "Las clases parten en septiembre"

---

## 8. Aplicación en el ERP

El ERP no es una pieza de branding, pero tampoco debería ser hostil:

- **Modo claro por defecto** (`xo-blanco` de fondo, `xo-negro` de texto). El sitio público es
  negro porque es aspiracional; una herramienta que se usa tres horas al día en negro cansa.
- Rosa reservado para acentos, estados activos y acción primaria. No decorar.
- Montserrat para todo. Bebas solo en el logo del header.
- Densidad alta: tablas legibles, poco espacio muerto. Es una herramienta, no una landing.
- Estados críticos (moroso, inasistencia, cupo lleno) en color funcional —rojo, ámbar, verde—
  **no** en rosa. La semántica gana sobre la marca.
- ⚠️ Ojo: `xo-rosa` sobre fondo claro no sirve para texto (1.7:1). En un ERP en modo claro esa
  restricción pesa mucho más que en el sitio público. El rosa va como fondo de botón con texto
  negro, o como borde.

---

## 9. Redes y activos

| Canal | Handle | Estado |
|---|---|---|
| Instagram academia | @XO.dancestudioo | Se abre al público en agosto 2026 |
| TikTok Carla | — | Contenido personal, cara de la marca |
| Instagram Carla | @carlataty.20 | Personal |

- **Logo y plantillas:** Canva. Original con fondo negro incrustado en `Assets/`; versiones con
  transparencia en `public/`.
- **`Assets/`** es material crudo, no se sirve. **`public/`** es lo publicado, solo comprimido.
- ⚠️ Pendiente: video del hero, y fotos/videos de las cinco profesoras.
