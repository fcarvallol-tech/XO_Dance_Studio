# XO Dance Studio — Landing de lanzamiento

@AGENTS.md

## Contexto
@docs/marca.md

Objetivo único de la página: que la visitante deje sus datos para tomar una
clase de prueba gratis en el curso que le interese. Todo lo que no sirva a ese
objetivo, sobra.

Esto NO es el sitio final. Más adelante se construirá una plataforma con roles,
membresías y dashboards sobre la misma base. Las decisiones de acá deben ser
compatibles con ese futuro, pero no implementes nada de eso ahora.

## Stack
Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase + Vercel.
Fuentes vía `next/font/google`.

## Reglas no negociables
- Nunca commitear `.env.local`.
- Colores SOLO desde los tokens `xo-*` definidos con `@theme` en
  `app/globals.css`. Nunca hex sueltos en componentes.
  (Tailwind v4 no usa `tailwind.config.ts`; los tokens viven en CSS.)
- Rosa XO (#F7ADBF) sobre fondo claro es decorativo. Nunca texto.
- Gris (#6B6B6B) sobre fondo oscuro nunca para párrafos.
- Todo el copy en español de Chile. Nunca traducir desde inglés.
- Mobile-first: el diseño se piensa desde 375px hacia arriba.
- Correr `npm run build` antes de dar por terminada una fase.
- No inventar datos. Precios, horarios y cupos van en `lib/cursos.ts` marcados
  `TODO` y se muestran como "Por confirmar".
- No mostrar la dirección exacta ni la fecha de lanzamiento. Solo
  "Las Condes, Santiago" y "Las clases parten en septiembre".
- Sin `localStorage` ni `sessionStorage`.
- Sin librerías de animación. CSS y transiciones nativas alcanzan.
- Sin stock photos. Si falta una imagen, placeholder evidente.
- Menores de edad identificables: no usarlas sin confirmación explícita de que
  hay autorización firmada de los apoderados.

## Reglas visuales
@.claude/rules/estilo.md

## Estructura
Una sola página con scroll (`app/page.tsx`). Sin rutas adicionales salvo
`app/api/lead/route.ts`.

Secciones, en orden: Hero · Qué es XO · Profesoras (elemento firma) · Cursos ·
Clase de prueba · Formulario · Footer.

## Datos
- `lib/cursos.ts` — los 5 cursos. Fuente única de precios, horarios y cupos.
- `lib/profesoras.ts` — las 5 profesoras. Relación curso ↔ profesora es
  muchos a muchos.

## Assets
- `Assets/` es la carpeta de trabajo (material crudo, no se sirve).
- `public/` es lo que se publica. Solo versiones comprimidas.
- `Assets/Videos/originales/` está en `.gitignore`.

## Comandos
- `npm run dev`
- `npm run build`
- `npm run lint`
