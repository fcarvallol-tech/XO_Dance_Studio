# CLAUDE.md — XO Dance Studio

> Este archivo lo lee Claude Code automáticamente. Va en la **raíz del repo**.
> Es una evolución del `CLAUDE.md` que ya existe: mantiene todas sus reglas y le agrega
> el sistema de contexto y la parte de ERP. Reemplázalo entero.

Plataforma de una academia de baile en Providencia y Las Condes, Santiago de Chile: sitio público de
captación + cuentas de alumnas, venta de paquetes de clases, reserva por horario y portales
para alumna, profesora, administración y owner.

@AGENTS.md

## Contexto — leer antes de escribir código

| Archivo | Cuándo |
|---|---|
| `@context/CONTEXT.md` | Siempre. Es el negocio, el estado real y lo que está sin definir |
| `@context/ARCHITECTURE.md` | Siempre que toques datos, esquema o estructura |
| `@context/BRAND.md` | Siempre que toques UI o copy |
| `@context/ROADMAP.md` | Cuando haya duda de prioridad o alcance |
| `context/prds/` | El PRD de la feature en curso. Obligatorio |
| `context/decisions/` | Antes de proponer cambiar algo ya decidido |

Las reglas visuales de implementación viven en `@.claude/rules/estilo.md` y se cargan solas al
editar `.tsx`.

## Objetivo del sitio público

Que la visitante deje sus datos para una clase de prueba gratis en el curso que le interese.
Todo lo que no sirva a ese objetivo, sobra.

El ERP se construye sobre la misma base, por fases, según `context/ROADMAP.md`. Las decisiones
del sitio deben ser compatibles con ese futuro, pero **no implementes ERP mientras no haya PRD
aprobado**.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · **Tailwind v4** · Supabase · Vercel.
Fuentes vía `next/font/google`.

⚠️ Tailwind v4 **no usa `tailwind.config.ts`**. Los tokens viven con `@theme` en
`app/globals.css`.
⚠️ Next 16 rompe convenciones anteriores: lee `node_modules/next/dist/docs/` antes de asumir.

## Reglas no negociables

- Nunca commitear `.env.local`.
- Colores SOLO desde los tokens `xo-*` de `app/globals.css`. Nunca hex sueltos en componentes.
- Rosa XO (#F7ADBF) sobre fondo claro es decorativo. **Nunca texto.**
- Gris (#6B6B6B) sobre fondo oscuro nunca para párrafos.
- Todo el copy en español de Chile. Nunca traducir desde inglés.
- Mobile-first: el diseño se piensa desde 375px hacia arriba.
- Correr `npm run build` antes de dar por terminada una fase.
- **Verificar la ruta de datos no es verificar el flujo.** Una prueba que se salta el camino real
  de la persona puede dar por bueno algo que está roto de punta a punta.
  - El magic link estuvo roto **desde PRD-0004 hasta el 03/09/2026** sin que nadie lo notara: cada
    verificación llamaba `verifyOtp()` por el SDK con el token en la mano, y nunca abría el enlace
    del correo. El SDK respondía `ok` y el enlace real llevaba a "este enlace ya no sirve".
  - La regla: **probar el artefacto que toca el usuario** —el enlace que llega, el formulario que
    se envía, el botón que se aprieta— y no la función que ese artefacto termina llamando. Si la
    prueba no puede fallar por lo mismo que falla en producción, no es una prueba del flujo.
  - Cuando el flujo cruza sistemas (correo, pasarela, OAuth), el punto de falla suele estar
    **entre** ellos: en el formato del enlace, en el parámetro que no llega, en el redirect
    intermedio. Ahí es donde hay que mirar, no en los extremos.
- **No inventar datos.** Los precios están definidos y publicados: viven en `lib/planes.ts` y en
  ningún otro lado. Horarios y cupos siguen en `lib/cursos.ts` marcados `TODO` y se muestran como
  "Por confirmar". Lo mismo aplica a cualquier dato de negocio que no esté en
  `context/CONTEXT.md`: si no está, se pregunta.
- **Las direcciones sí se publican** desde PRD-0016: viven en la tabla `sedes` y se muestran en
  el sitio. Lo que se sigue sin publicar es la fecha exacta de lanzamiento.
- Sin `localStorage` ni `sessionStorage`.
- Sin librerías de animación. CSS y transiciones nativas alcanzan.
- Sin stock photos. Si falta una imagen, placeholder evidente.
- Menores identificables: no usarlas sin confirmación explícita de que hay autorización firmada.

## Proceso — ninguna feature sin PRD

Si te piden construir algo que no tiene PRD en `context/prds/`, tu primera respuesta es
**proponer el PRD** usando `context/prds/0000-TEMPLATE.md`, numerado en orden. No escribas
código hasta que esté aprobado.

Al terminar: actualiza el estado del PRD y agrega una línea al changelog de `ROADMAP.md`.
No edites `CONTEXT.md` sin confirmarlo con Felipe.

Si crees que una decisión de `context/decisions/` está mal, escribe un ADR nuevo que la
reemplace. No la cambies en silencio.

## Estructura

Sitio público: una sola página con scroll (`app/page.tsx`). Secciones en orden: Hero · Qué es
XO · Profesoras · Cursos · Planes · Sedes · Clase de prueba · Formulario · Footer.

ERP: rutas bajo `app/(erp)/`, todas autenticadas. No existe todavía.

## Datos

- `lib/planes.ts` — los packs. Fuente única de precios y de la promo vigente.
- `lib/cursos.ts` — los 5 cursos. Fuente única de horarios y cupos.
- `lib/profesoras.ts` — las 5 profesoras. Relación curso ↔ profesora es muchos a muchos.
- `lib/lead.ts` — validación compartida cliente/servidor. El servidor es el que manda.
- La inserción de leads pasa **siempre** por `app/api/lead/route.ts`. La service role key salta
  RLS y no puede salir del servidor.

## Reglas críticas del modelo de créditos y reservas

- **Ninguna operación que toque créditos o cupos se ejecuta desde el cliente.** Todo pasa por
  Route Handler o función de base de datos.
- **Reservar y descontar el crédito ocurren en una sola transacción.** Nunca por separado.
- **El cupo se valida en la base de datos**, no leyendo un conteo y escribiendo después. Con 22
  cupos y campañas de Instagram, la condición de carrera es real.
- **El saldo de créditos no es un `int` en el perfil.** Son lotes con vencimiento, y todo cambio
  queda registrado en `movimientos_credito`. Ese libro nunca se edita, solo se agrega.
- La lógica de créditos, cupos y cancelación vive en `lib/dominio` como funciones puras, **con
  tests**. Es la única parte del sistema donde un bug le cuesta plata a alguien.
- Los cuatro roles son `alumna`, `profesora`, `admin`, `owner`. `owner` es superconjunto de
  `admin`: implementar como jerarquía, no como listas paralelas.

## Convenciones del ERP

- Dominio en español (`alumna`, `apoderado`, `inscripcion`, `seccion`), infraestructura en
  inglés. Sin tildes ni ñ en identificadores ni nombres de tabla.
- Base de datos `snake_case`, tablas en plural. Toda tabla con `id uuid`, `created_at`,
  `updated_at`, `deleted_at`. Borrado lógico, nunca `DELETE` sobre alumnas, pagos o asistencia.
- RLS activo en todas las tablas, con políticas explícitas. Nunca dar grants a `anon` por
  comodidad.
- **Las políticas permisivas de Postgres se combinan con OR: agregar una nunca restringe.** Una
  política nueva *suma* un camino de acceso al que ya existía. Si una tabla tiene una política
  pública y se le agrega otra "solo lo suyo", el resultado es que se sigue viendo todo.
  - Antes de escribir una política que pretenda limitar, mirar **qué otras políticas tiene esa
    tabla**. Si hay una más amplia, la nueva no hace nada.
  - **La consulta filtra igual**, como defensa en profundidad. Confiar solo en RLS deja el sistema
    a merced de haber razonado bien sobre la composición de políticas; confiar solo en la consulta
    deja la API abierta. Van las dos.
  - Una política que no restringe es **peor que ninguna**: hace creer que la protección existe.
    Ya pasó una vez — ver PRD-0008 §12.
  - Cuando el dato tiene que ser público para unos y limitado para otros, muchas veces la
    respuesta no es una política sino **una función `security definer`** cuyo tipo de retorno sea
    el contrato de columnas. RLS filtra filas, nunca columnas.
  - **Una función `security definer` con grant a `anon` anula el RLS de las tablas que lee.**
    Cerrar una tabla no sirve si una función la expone igual. Al revisar qué es público hay que
    mirar las funciones, no solo las tablas: `GET /rest/v1/` lista todo lo que la API expone.
  - **Público es una decisión, no un resto.** Se abre lo que una página pública necesita, y se
    abre esa cosa y no la tabla entera.
- **`revoke ... from public` NO es `revoke ... from anon`.** `PUBLIC` es el pseudo-rol que cubre a
  **todos** los roles, `authenticated` incluido. Y las funciones nacen con `EXECUTE` para `PUBLIC`,
  así que muchas funcionan sin grant explícito: revocar `PUBLIC` se lo quita a todo el mundo.
  - Para cerrarle una función a quien no tiene sesión: `revoke ... from public, anon` **y a
    continuación** `grant execute ... to authenticated, service_role`.
  - Toda función que alguien vaya a ejecutar debe tener su **grant explícito escrito**, aunque hoy
    funcione por el default. Lo que funciona por defecto se rompe silenciosamente al primer
    `revoke`. Ya rompió el login una vez — ver PRD-0008 §15.
  - `tiene_nivel` es el caso crítico: la llaman las políticas RLS de casi todas las tablas, así
    que sin ella **cualquier consulta con sesión falla**, no solo las de admin.
- Dinero: enteros CLP. Sin decimales, sin floats.
- Fechas: `timestamptz` en UTC, se renderizan en `America/Santiago`.
- RUT normalizado `12345678-9`, DV en minúscula, validado en servidor.
- Migraciones versionadas en `supabase/migrations/`. Nunca cambios manuales en producción.

## Datos sensibles

Las alumnas son mayoritariamente **menores de edad**. Aplica Ley 19.628 / Ley 21.719.

- Nunca exponer nombre, RUT, foto, dirección, teléfono ni observaciones médicas de una alumna en
  rutas públicas, logs, mensajes de error o URLs.
- `autoriza_uso_imagen` es `false` por defecto. Ningún flujo de marketing asume consentimiento.
- No usar datos reales de alumnas en seeds ni fixtures.

## Assets

- `Assets/` es material crudo, no se sirve. `public/` es lo publicado, solo comprimido.
- `Assets/Videos/originales/` está en `.gitignore`.
- `fuentes/` guarda el .ttf de Bebas que usa `app/opengraph-image.tsx`: satori necesita el
  archivo, no una hoja de estilos.

## Comandos

```bash
npm run dev
npm run build
npm run lint
```

## Pendientes de Carla

- Video del hero y videos/fotos de las cinco profesoras.
- Bios reales de **Carli y Maida** (siguen diciendo `Acá la bio de "Nombre"`). Drimy, Lina y Pau
  ya entregaron la suya.
- Horarios y cupos en `lib/cursos.ts`. (Precios ya definidos.)
- Confirmar la nueva ubicación.
