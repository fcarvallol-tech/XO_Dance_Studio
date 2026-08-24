---
paths:
  - "app/**/*.tsx"
  - "components/**/*.tsx"
---

# Reglas visuales — XO Dance Studio

## Color

Usa únicamente los tokens definidos con `@theme` en `app/globals.css`. Nunca un
hex suelto, nunca un color de la paleta por defecto de Tailwind.

| Token | Hex | Uso |
|---|---|---|
| `xo-negro` | `#1A1A1A` | Fondo base de casi toda la página |
| `xo-negro-alt` | `#232323` | Superficies elevadas sobre negro (tarjetas, fichas) |
| `xo-rosa` | `#F7ADBF` | Acentos, botones, títulos sobre negro, estrellas |
| `xo-rosa-claro` | `#F2D0DC` | Acento secundario, texto sobre negro, territorio Teens |
| `xo-blanco` | `#F7F7F7` | Texto sobre negro, fondo de las pocas secciones claras |
| `xo-gris` | `#6B6B6B` | Texto secundario sobre fondos claros |

Contraste verificado — respetar sin excepción:

- Rosa XO sobre negro 9.7:1 — sirve para todo, incluido texto chico.
- Rosa claro sobre negro 12.3:1 — sirve para todo.
- Gris sobre blanco 5.0:1 — sirve para texto secundario.
- **Rosa XO sobre blanco 1.7:1 — PROHIBIDO para texto.** Solo bordes, líneas,
  fondos de bloque.
- **Gris sobre negro 3.3:1 — PROHIBIDO para párrafos.** Sobre negro el texto
  secundario va en `xo-rosa-claro` o en `xo-blanco` con opacidad.

Botones primarios: fondo `xo-rosa`, texto `xo-negro`. No blanco sobre rosa.

## Tipografía

Tres roles, sin excepciones:

- **Bebas Neue** (`font-display`) — títulos grandes. Es la voz de la página.
  Mayúsculas, `leading-none` o cercano, tracking apenas positivo.
- **Cormorant Garamond** (`font-serif-xo`) — frases sueltas y taglines, en
  itálica. Con moderación, como contrapunto.
- **Montserrat** (`font-sans`) — cuerpo, formularios, datos prácticos. Neutra a
  propósito.

Escala:

```
Eyebrow / label      Montserrat 600 · 11px · mayúsculas · tracking 0.15em
Body                 Montserrat 400 · 16px · leading 1.6
Body grande          Montserrat 400 · 18px · leading 1.6
Botón                Montserrat 600 · 14px · mayúsculas · tracking 0.08em
H3                   Bebas · 28px móvil / 36px desktop
H2                   Bebas · 40px móvil / 64px desktop
H1 (hero)            Bebas · 56px móvil / hasta 140px desktop · leading 0.9
Tagline              Cormorant italic 400 · 20px móvil / 28px desktop
Nombres del lineup   Bebas · clamp(3rem, 12vw, 9rem) — lo más grande de la página
```

Un solo `h1` en toda la página (el del hero).

## Composición

- Mucho espacio negativo. La página respira, no se llena.
- Estrellas `✦` como separador o viñeta, con criterio. No regadas.
- Grano/ruido muy sutil sobre los fondos negros: se intuye, no se ve.
- Sin degradados. Sin sombras difusas. Sin efectos brillantes. Sin neón.
- Los cursos no llevan numeración `01/02/03` — no son una secuencia.
- Sin tarjetas de "3 columnas con ícono + título + texto".

## Movimiento

Poco y con intención: fade-in al entrar cada sección, la transición del lineup
de profesoras, y hover en los botones. Nada más.

Todo debe degradarse limpiamente bajo `prefers-reduced-motion: reduce`: sin
crossfades, sin desplazamientos, sin autoplay de video decorativo.

## Accesibilidad

- Foco de teclado visible en todo elemento interactivo (nunca `outline: none`
  sin reemplazo).
- `alt` en todas las imágenes; `alt=""` si son puramente decorativas.
- Los links de Instagram abren en pestaña nueva con `rel="noopener noreferrer"`.
- Responsive real desde 375px.

## Copy

Español de Chile, escrito desde el lado de la alumna. Los botones dicen
exactamente qué pasa al apretarlos. Específico antes que ingenioso. Sin cadenas
de signos de exclamación, sin emojis regados.

Teens le habla a la mamá: confianza y entusiasmo. Es la única submarca donde
quien lee y quien baila son personas distintas.
Girly y K-Pop le hablan a la alumna: aspiración y pertenencia. K-Pop mantiene la
voz de alumna aunque tenga menores, porque el curso se elige por fandom: la niña
llega sabiéndose las coreografías, no la trae la mamá.

Si una frase podría estar en la landing de cualquier academia de baile,
reescríbela.
