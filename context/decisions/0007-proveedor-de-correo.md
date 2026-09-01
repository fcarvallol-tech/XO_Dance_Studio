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

Restricciones reales: no hay equipo de infraestructura y el volumen es de decenas de correos al
día. El proyecto corre en Vercel con Next.js, y `xodancestudio.cl` ya está registrado y en línea.

**Lo que no es este ADR:** los correos de autenticación —magic link, confirmación— los manda
Supabase Auth con su propio SMTP. Esto es solo el correo transaccional de la aplicación. Los dos
pueden terminar apuntando al mismo proveedor, y conviene que lo hagan, pero son configuraciones
distintas.

## Opciones evaluadas

### Opción A — Resend
A favor: SDK pensado para Next.js; las plantillas viven en el repo, y si crecen hay `react-email`
para escribirlas como componentes; plan gratuito de 3.000 correos al mes, muy por encima de lo que
necesita este volumen; configuración de dominio con SPF, DKIM y DMARC guiada.
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

**Resend**, con las plantillas versionadas en el repo (`lib/correo.ts`).

## Razón

Lo que decide no es el precio —a este volumen todos son gratis o casi— sino **dónde viven las
plantillas y quién las puede tocar**. Acá un correo es una función del repo: se revisa en un pull
request y usa los mismos colores de `BRAND.md` que el sitio, en vez de vivir en una consola donde
alguien edita HTML sin que quede rastro. Eso es coherente con cómo está construido todo lo demás.

⚠️ **Cómo quedaron escritas, para que no haya sorpresa:** son funciones que devuelven HTML con
estilos en línea y una tabla de maquetación, no componentes `react-email`. No es pereza: los
clientes de correo —Outlook sobre todo— no entienden hojas de estilo ni layout moderno, así que
igual habría que escribir eso. `react-email` vale la pena cuando haya media docena de plantillas
y empiece a doler la repetición; con cuatro, agregar la dependencia es más ceremonia que ayuda.

SES es mejor a escala y peor ahora: pedir salida del sandbox y administrar IAM es trabajo real
para ahorrar un dinero que a este volumen no existe. Gmail no compite: no es correo transaccional
y mandar avisos de pago desde una cuenta personal es pedir terminar en spam justo cuando el correo
avisa que alguien transfirió plata.

## Consecuencias

**Más fácil:** un correo nuevo es un componente y un `await`. Las plantillas quedan bajo control de
versiones y con la identidad de marca sin duplicar.

**Más difícil:** una dependencia externa más, con su llave (`RESEND_API_KEY`, sensible) y su
configuración de DNS.

**Consecuencia operativa — verificar el dominio en Resend.** `xodancestudio.cl` **ya está
registrado**, apuntado a Vercel y con certificado: el sitio corre ahí. Lo que falta es agregar en
Vercel los registros DNS que pide Resend —SPF, DKIM y el subdominio de envío— para verificar el
dominio y poder mandar desde `hola@xodancestudio.cl`.

Es un trámite corto y **no bloquea el desarrollo**: se puede construir y probar con el dominio de
prueba de Resend. Sí conviene tenerlo listo antes de que la primera alumna transfiera de verdad,
porque un correo sobre plata que llega desde una dirección que no es de XO resta la confianza
justo donde más hace falta.

**Regla que no depende del proveedor:** el correo **nunca es parte de una transacción**. Si el
envío falla, la compra se aprobó igual y la reserva existe igual. Se reintenta. No se revierte
plata por un problema de correo.

## Cuándo revisar

- Si el volumen supera los 3.000 correos al mes, o si el costo empieza a notarse: ahí SES pasa a
  tener sentido y la migración es acotada, porque el envío está detrás de un módulo propio.
- Si la entregabilidad resulta mala tras verificar el dominio.
- Si se decide unificar el SMTP de Supabase Auth con este proveedor, que es lo recomendable pero
  es configuración aparte. Hoy los magic links salen por el SMTP de Supabase, con sus límites de
  envío: si el volumen de registros sube, eso se nota antes que cualquier otra cosa.
