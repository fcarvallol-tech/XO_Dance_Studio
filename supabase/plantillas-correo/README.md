# Plantillas de los correos de entrada (Supabase Auth)

**No las aplica ningún comando.** Viven en el panel de Supabase, en
**Authentication → Emails → Templates**, una por proyecto (producción y staging). Este directorio
es la copia versionada: lo que está acá es lo que tiene que estar en el panel.

| Plantilla del panel | Asunto | Cuerpo |
|---|---|---|
| **Magic Link** | `Tu enlace para entrar a XO` | `enlace-para-entrar.html` |
| **Confirm signup** | `Tu enlace para entrar a XO` | `confirmar-registro.html` |

Las dos llevan el mismo asunto a propósito: para la alumna es lo mismo, entrar. La primera vez
que alguien entra con su correo, Supabase le manda **Confirm signup**; las siguientes, **Magic Link**.

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
