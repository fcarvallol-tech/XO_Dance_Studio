# ADR-0007 — Proveedor de correo transaccional

| Campo | Valor |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 31 de agosto de 2026 |
| **Decide** | Felipe Carvalho |

## Contexto

`ARCHITECTURE.md` §1 dejó el proveedor de correo como "Resend o similar — **a decidir**" desde el
21 de agosto. Dejó de poder postergarse: PRD-0017 tiene **dos correos dentro del alcance** y sin
ellos el flujo no cierra.

- **Aviso de transferencia declarada a la academia.** Sin él, una compra pendiente queda esperando
  a que alguien se acuerde de mirar la bandeja. La métrica de éxito de PRD-0017 es justamente
  cuántas horas pasan entre declarar y resolver.
- **Aprobación y rechazo a la alumna.** Alguien transfirió plata: enterarse de que le acreditaron
  —o de que no, y por qué— no es una cortesía.

Vienen además el comprobante de reserva (PRD-0006 §3.5) y el aviso de clase cancelada.

Restricciones reales: no hay equipo de infraestructura, el volumen es de decenas de correos al
día, y hay un dominio propio pendiente de registrar (`CONTEXT.md` §12). El proyecto ya corre en
Vercel con Next.js.

**Lo que no es este ADR:** los correos de autenticación —magic link, confirmación— los manda
Supabase Auth con su propio SMTP. Esto es solo el correo transaccional de la aplicación. Los dos
pueden terminar apuntando al mismo proveedor, y conviene que lo hagan, pero son configuraciones
distintas.

## Opciones evaluadas

### Opción A — Resend
A favor: SDK pensado para Next.js; plantillas como componentes React con `react-email`, que es el
mismo lenguaje del resto del proyecto y evita mantener HTML de correo a mano; plan gratuito de
3.000 correos al mes, muy por encima de lo que este volumen necesita; configuración de dominio
con SPF, DKIM y DMARC guiada.
En contra: empresa joven comparada con las otras; menos herramientas de análisis.

### Opción B — SMTP de Gmail / Google Workspace
A favor: ya existe la cuenta `xo.dancestudioo@gmail.com`, costo cero, nada nuevo que contratar.
En contra: **no es correo transaccional**. Gmail limita el envío programático, no entrega
reputación de dominio ni reintentos, y un correo automático desde una cuenta personal termina en
spam con facilidad. Además obliga a guardar credenciales SMTP de una cuenta que además usan
personas.

### Opción C — Amazon SES
A favor: el más barato por volumen, con diferencia; máxima confiabilidad.
En contra: onboarding lento —hay que salir del *sandbox* pidiéndolo a AWS—, credenciales IAM que
gestionar, y ninguna ventaja real a decenas de correos al día. Es la respuesta correcta a un
problema de escala que no tenemos.

### Opción D — SendGrid / Mailgun
A favor: maduros, muy probados, buena entregabilidad.
En contra: consolas pesadas para lo que se necesita; plantillas fuera del repo, que es
exactamente lo que este proyecto evita con el catálogo y los precios; el plan gratuito de SendGrid
dejó de existir.

## Decisión

**Resend**, con las plantillas escritas en `react-email` y versionadas en el repo.

## Razón

Lo que decide no es el precio —a este volumen todos son gratis o casi— sino **dónde viven las
plantillas y quién las puede tocar**. Con `react-email` un correo es un componente más: se revisa
en un pull request, usa los mismos tokens de `BRAND.md` que el sitio, y no hay una consola aparte
donde alguien edita HTML sin que quede rastro. Eso es coherente con cómo está construido todo lo
demás acá.

SES es mejor a escala y peor ahora: pedir salida del sandbox y administrar IAM es trabajo real
para ahorrar un dinero que a este volumen no existe. Gmail no compite: no es correo transaccional
y mandar avisos de pago desde una cuenta personal es pedir terminar en spam justo cuando el correo
avisa que alguien transfirió plata.

## Consecuencias

**Más fácil:** un correo nuevo es un componente y un `await`. Las plantillas quedan bajo control de
versiones y con la identidad de marca sin duplicar.

**Más difícil:** una dependencia externa más, con su llave (`RESEND_API_KEY`, sensible) y su
configuración de DNS.

**Consecuencia no obvia — el dominio.** Resend exige verificar un dominio propio para enviar con
buena reputación. Hoy el sitio corre en el subdominio de Vercel y `xodancestudio.cl` **sigue sin
registrarse** (`CONTEXT.md` §12). Se puede empezar con el dominio de prueba de Resend, pero eso
manda desde una dirección que no es de XO, y para correos de dinero eso resta confianza.
⚠️ **Esto convierte registrar el dominio en un requisito de PRD-0017**, no en una tarea suelta de
marca.

**Regla que no depende del proveedor:** el correo **nunca es parte de una transacción**. Si el
envío falla, la compra se aprobó igual y la reserva existe igual. Se reintenta. No se revierte
plata por un problema de correo.

## Cuándo revisar

- Si el volumen supera los 3.000 correos al mes, o si el costo empieza a notarse: ahí SES pasa a
  tener sentido y la migración es acotada, porque el envío está detrás de un módulo propio.
- Si la entregabilidad resulta mala tras verificar el dominio.
- Si se decide unificar el SMTP de Supabase Auth con este proveedor, que es lo recomendable pero
  es configuración aparte.
