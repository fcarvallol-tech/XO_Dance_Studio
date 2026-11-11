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

## Volver atrás

`ANTERIOR-produccion-magic-link.html` es la Magic Link que tenía producción el 08/11/2026, con
asunto **"Your sign-in link"**. Si al pegar la nueva alguien no puede entrar, **lo primero es
pegar esa de vuelta**, no investigar.

Falta la **Confirm signup** anterior de producción: no se ha recibido ese correo desde una casilla
que se pueda leer, y la configuración del panel no se lee con la CLI.

## Orden para cambiarlas (Felipe, 08/11/2026)

1. Guardar las de producción como versión anterior.
2. Revisar que `https://xodancestudio.cl/**` esté en Redirect URLs de producción. Si no está, no se
   toca la plantilla.
3. Pegarlas primero en **staging** y probar el camino completo con un navegador limpio:
   `/reservar` → pedir enlace → abrir el del correo → termina en `/reservar`, con asunto en español.
4. **El panel de producción lo toca Felipe**, con el OK de la prueba de staging.
5. Apenas esté pegada, entrar de inmediato con una cuenta existente y con una nueva.
