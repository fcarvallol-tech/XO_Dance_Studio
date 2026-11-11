# Plantillas de los correos de entrada (Supabase Auth)

**No las aplica ningún comando.** Viven en el panel de Supabase, en
**Authentication → Emails → Templates**, una por proyecto (producción y staging). Este directorio
es la copia versionada: lo que está acá es lo que tiene que estar en el panel.

| Plantilla del panel | Asunto | Cuerpo |
|---|---|---|
| **Magic Link** | `Tu enlace para entrar a XO` | `enlace-para-entrar.html` |
| **Confirm signup** | `Confirma tu correo` | `confirmar-registro.html` |

Asuntos en español (Felipe, 11/11/2026): son lo primero que se ve en la bandeja. La primera vez que
alguien entra con su correo, Supabase le manda **Confirm signup**; las siguientes, **Magic Link**.

## Por qué el enlace se arma con `{{ .RedirectTo }}`

PRD-0026 §12.1, 08/11/2026: el enlace apuntaba a `{{ .SiteURL }}/auth/confirmar?token_hash=…`,
fijo, y perdía el `volver` que pide `FormularioEntrar`. La amiga que tocaba "Reservar mi clase"
sin sesión pasaba por `/entrar?volver=%2Freservar` y terminaba en `/mis-clases`.

`{{ .RedirectTo }}` es el `emailRedirectTo` que manda `FormularioEntrar`:
`https://xodancestudio.cl/auth/confirmar?volver=%2Freservar`. Ya trae su `?`, así que el token se
agrega con `&`. Sigue sirviendo **entre dispositivos**, que es lo que exigía PRD-0004 §13: el
enlace lleva el `token_hash` y no depende del navegador que lo pidió.

⚠️ **Supabase usa `RedirectTo` solo si está en Redirect URLs.** Si no está, lo cambia por el
Site URL a secas y el enlace queda roto (`https://xodancestudio.cl&token_hash=…`). En
**Authentication → URL Configuration** tiene que estar `https://xodancestudio.cl/**`.

## Volver atrás: las vivas al 11/11/2026

Leídas de cada proyecto con la API de administración (`GET /v1/projects/<ref>/config/auth`) y
copiadas tal cual; las de producción coinciden letra por letra con lo que Felipe transcribió del
panel ese día. **Si con la nueva alguien no puede entrar, lo primero es pegar estas de vuelta**,
con su asunto, no investigar.

| Archivo | Proyecto | Plantilla | Asunto |
|---|---|---|---|
| `ANTERIOR-produccion-magic-link.html` | producción | Magic Link | `Your sign-in link` |
| `ANTERIOR-produccion-confirmar-registro.html` | producción | Confirm signup | `Confirm your email address` |
| `ANTERIOR-staging-magic-link.html` | staging | Magic Link (la de fábrica) | `Your sign-in link` |
| `ANTERIOR-staging-confirmar-registro.html` | staging | Confirm signup (la de fábrica) | `Confirm your email address` |

La de producción se había reconstruido a ciegas el 08/11 desde un correo recibido. Se reemplazó
por la leída del proyecto.

## Quién pide estos correos (comprobado en el código el 11/11/2026)

Un solo lugar: `components/FormularioEntrar.tsx`, `signInWithOtp`, y **siempre** pasa
`emailRedirectTo` = `<origen>/auth/confirmar?volver=<ruta>`. No hay `signUp`, `resend`,
`resetPasswordForEmail`, `inviteUserByEmail` ni `updateUser` en `app/`, `lib/` ni `components/`.
`generateLink` aparece solo en `scripts/`, con la service role, y no manda correo.

**Lo que no sale del código y puede llegar con `{{ .RedirectTo }}` vacío:** un correo que se
dispare desde el panel de Supabase (invitar, mandar magic link a mano). Qué pone Supabase en ese
caso **no está probado**: no se usa ese camino desde el panel.

## Techos de envío (leídos de la API el 11/11/2026)

| | Producción | Staging |
|---|---|---|
| `rate_limit_email_sent` (Rate Limits → correos de Auth) | **30** | 2 |
| SMTP | `smtp.resend.com`, desde `no-responder@xodancestudio.cl` | apagado: servicio interno de Supabase |
| `smtp_max_frequency` (segundos entre dos correos a la misma persona) | 60 | 60 |

Es un techo **aparte** del de Resend, y no se arregla pagando el plan de Resend.
