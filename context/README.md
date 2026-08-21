# XO Dance Studio — Repositorio de Contexto

Este es el **sistema de contexto** del proyecto XO Dance Studio. Su función es que cualquier
sesión de IA (Claude Code, Claude Desktop, Fable) parta con el 100% del contexto del negocio,
la marca y el software, sin que tengas que explicarlo de nuevo cada vez.

---

## 1. Qué es esto y por qué existe

Cuando abres una sesión nueva de Claude Code, la IA no recuerda nada. Lo único que sabe es:

1. Lo que hay en el archivo `CLAUDE.md` (que carga automáticamente al iniciar).
2. Lo que le pidas explícitamente que lea.
3. El código que tiene delante.

El "context repo" del que te habló tu amigo CTO es exactamente esto: un conjunto de
documentos versionados en git que son **la fuente de verdad del proyecto**. El código cambia
todos los días; el contexto cambia poco y explica *por qué* el código es como es.

La regla mental es:

> El código dice **qué** hace el sistema.
> El contexto dice **por qué** lo hace así y **qué falta por hacer**.

---

## 2. Estructura

```
xo-context/
├── README.md            ← este archivo (cómo funciona el sistema)
├── CLAUDE.md            ← lo que Claude Code lee AUTOMÁTICAMENTE al iniciar sesión
├── CONTEXT.md           ← contexto de negocio: quiénes somos, modelo, estado actual
├── BRAND.md             ← manual de marca: colores, tipografía, tono, arquetipos
├── ARCHITECTURE.md      ← stack técnico, modelo de datos del ERP, convenciones
├── ROADMAP.md           ← fases, hitos, qué se construye y en qué orden
├── prds/                ← un PRD por feature, numerados cronológicamente
│   ├── 0000-TEMPLATE.md
│   ├── 0001-landing-captacion-leads.md
│   └── 0002-alumnas-apoderados-inscripciones.md
└── decisions/           ← ADRs: decisiones importantes y por qué se tomaron
    ├── 0000-TEMPLATE.md
    └── 0001-erp-propio-vs-saas.md
```

---

## 2.b Cómo se integra con lo que el repo ya tiene

El repo ya tenía la mitad de este sistema armado. Así queda al integrarlo:

| Archivo existente | Qué pasa |
|---|---|
| `CLAUDE.md` | **Se reemplaza** por `context/CLAUDE.md`, que conserva todas sus reglas y agrega el sistema de contexto y las convenciones del ERP |
| `AGENTS.md` | **Se mantiene tal cual.** El aviso de que Next 16 rompe supuestos es valioso |
| `.claude/rules/estilo.md` | **Se mantiene tal cual.** Es reglas de implementación con `paths:`, se carga sola al editar `.tsx`. Cumple un rol distinto de `BRAND.md`: ese dice el *porqué*, este el *cómo* |
| `docs/marca.md` | **Se borra.** Su contenido está integrado en `context/BRAND.md`. Dejar los dos garantiza que uno quede desactualizado |
| `README.md` | Sigue siendo el de `create-next-app`. Vale la pena reescribirlo alguna vez |

El patrón de `.claude/rules/` con `paths:` es bueno y conviene extenderlo cuando exista el ERP:
una regla que aplique solo a `supabase/migrations/**` con las convenciones de esquema, por
ejemplo, se carga justo cuando hace falta y no ocupa contexto el resto del tiempo.

## 3. ¿Repo separado o carpeta dentro del repo de código?

Tu amigo tiene un repo separado porque en su empresa hay **muchos repos** (frontend, backend,
mobile, infra) que comparten el mismo contexto de negocio. Un repo aparte evita duplicarlo.

**Para ti, hoy, con un solo repo, la recomendación es distinta:**

👉 Mete esta carpeta **dentro** del repo de la aplicación, como `/context`, y deja un
`CLAUDE.md` en la raíz que apunte a ella.

```
XO_Dance_Studio/
├── CLAUDE.md          ← copia de context/CLAUDE.md (Claude Code lo lee solo)
├── context/           ← esta carpeta completa
├── app/
├── components/
├── lib/
└── package.json
```

Ventajas: un solo `git commit` deja código y contexto sincronizados, y nunca vas a tener
un contexto que describe una versión del sistema que ya no existe.

**Cuándo mover a repo separado:** cuando tengas 2+ repos (por ejemplo si separas la app
pública del ERP, o agregas una app móvil). Ahí lo conviertes en repo propio y lo enlazas
con `git submodule` o simplemente lo clonas al lado.

---

## 4. Flujo de trabajo (lo que tu amigo llama "el proceso")

### Al empezar una sesión de Claude Code

No hagas nada especial. `CLAUDE.md` se carga solo. Si quieres forzarlo:

```
Lee context/CONTEXT.md, context/ARCHITECTURE.md y el PRD activo antes de escribir código.
```

### Al empezar una feature nueva

1. **Primero el PRD, nunca el código.** Le pides a Claude:
   > "Vamos a construir el módulo de asistencia. Escribe el PRD siguiendo
   > `context/prds/0000-TEMPLATE.md` y guárdalo como `0003-asistencia.md`.
   > No escribas código todavía."
2. Lo lees, lo corriges, lo apruebas. Cambias el estado a `Aprobado`.
3. Recién ahí:
   > "Implementa `context/prds/0003-asistencia.md`."
4. Al terminar, cambias el estado del PRD a `Implementado` y anotas qué quedó fuera.

**Por qué importa:** el PRD es el contrato. Sin él, la IA improvisa alcance, y tú descubres
a las tres horas que construyó algo que no era. Con él, cualquier sesión futura puede leer
`prds/` en orden y reconstruir la historia completa del producto.

### Al tomar una decisión técnica o de negocio importante

Escribes un ADR en `decisions/`. Ejemplos de decisiones que merecen ADR: Supabase vs Postgres
propio, ERP propio vs SaaS, cobrar con Flow vs Mercado Pago, multi-sede desde el día uno o no.

Regla: si dentro de seis meses te vas a preguntar *"¿por qué hicimos esto así?"*, es un ADR.

### Al cerrar un hito

Actualizas `CONTEXT.md` (estado actual, números) y `ROADMAP.md` (qué se movió a hecho).
Estos dos archivos son los únicos que se reescriben; los PRDs y ADRs **no se editan
retroactivamente**, se agregan nuevos que reemplazan a los viejos.

---

## 5. Numeración

- PRDs y ADRs se numeran con 4 dígitos, en orden cronológico de creación: `0001`, `0002`…
- El número **nunca se reutiliza ni se reordena**, aunque el PRD se cancele.
- Un PRD cancelado se queda en el repo con estado `Descartado` y una línea explicando por qué.
  Eso vale tanto como uno implementado: evita que alguien reproponga lo mismo en tres meses.

---

## 6. Higiene del contexto

- Si un documento tiene más de ~500 líneas, pártelo. Contexto largo se lee peor, no mejor.
- Un dato vive en **un solo archivo**. Si el precio de la mensualidad aparece en tres lugares,
  dos van a quedar desactualizados.
- Marca explícitamente lo que no está confirmado con `⚠️ POR CONFIRMAR`. La IA rellena huecos
  con suposiciones plausibles si no le dices que son huecos.
