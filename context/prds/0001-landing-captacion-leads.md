# PRD-0001 — Landing pública y captación de leads

| Campo | Valor |
|---|---|
| **Estado** | Implementado y funcionando en producción. Pendientes solo de contenido |
| **Autor** | Felipe Carvalho |
| **Fecha** | Agosto 2026 · documentado retroactivamente contra el código real |
| **Hito** | Hito 0 — Lanzamiento |
| **PRDs relacionados** | PRD-0002 (alumnas e inscripciones) |

> Se construyó antes de que existiera el sistema de PRDs. Este documento la formaliza para
> cerrar el hueco de contexto y dejar registrado qué quedó abierto.

---

## 1. Problema

XO pasa de ser un curso personal de Carla a una academia con cinco profesoras y cinco cursos,
y **nadie la conoce**. El único punto de contacto era Instagram y WhatsApp: las conversaciones
vivían en el chat de Felipe, sin registro de cuántas personas preguntaron, por qué curso, de
dónde venían ni cuántas terminaron inscribiéndose.

## 2. Usuario

**Primaria:** mamá de Las Condes, llega desde Instagram o un flyer, desde el teléfono, con poco
tiempo y comparando alternativas de extracurricular para su hija.
**Secundaria:** mujer de 16+ que llega desde Instagram o TikTok y quiere probar reggaetón o K-Pop.

Necesita resolver en menos de un minuto: qué cursos hay, para qué edad, quién hace clases, dónde
queda y cómo probar sin comprometerse.

## 3. Alcance (implementado)

1. Una sola página con scroll: Hero · Qué es XO · Profesoras · Cursos · Clase de prueba ·
   Formulario · Footer.
2. Lineup de profesoras como elemento firma: se toca un nombre y se despliega quién es.
3. Los cinco cursos con público, estilo, profesoras, y horario/valor/cupos como "Por confirmar".
4. Formulario de clase de prueba: nombre, WhatsApp, para quién es, edad si es para una hija,
   curso de interés.
5. `POST /api/lead` valida en servidor e inserta en Supabase con service role key.
6. Tras guardar, abre WhatsApp en pestaña nueva con mensaje precargado.
7. Se captura el `origen` del click (barra, hero, tarjeta de curso, ficha de profesora, etc.).
8. Metadata y Open Graph propios, con imagen generada por satori.

## 4. Fuera de alcance

- Pago o inscripción en línea → Hito 4.
- **Publicar precios.** Decisión de negocio: se informan al contactar.
- **Publicar la dirección exacta.** Solo "Las Condes, Santiago"; el resto va por WhatsApp.
- **Publicar la fecha exacta de lanzamiento.** Solo "Las clases parten en septiembre".
- Leer o gestionar leads desde la web → Hito 0.11 / Hito 1.
- Blog, galería, testimonios en video.

## 5. Flujo implementado

1. Llega desde Instagram, TikTok o flyer.
2. Ve el hero, baja, encuentra el curso que calza.
3. Toca cualquier CTA. El `origen` queda registrado según de dónde salió el click.
4. Completa el formulario. La validación corre en el cliente para avisar antes de enviar.
5. Al enviar, el servidor revalida e inserta el lead.
6. Se abre WhatsApp en pestaña nueva con el mensaje precargado, y la conversación sigue ahí.

> **Nota de diseño:** el "aviso al equipo" no es un email ni un webhook: es que la propia
> visitante abre la conversación de WhatsApp. Simple y funciona, pero significa que **un lead
> que se guarda y no manda el WhatsApp queda invisible**. Ese hueco lo cierra el panel de leads
> (Hito 0.11).

## 6. Casos borde cubiertos

- WhatsApp: se exigen exactamente 8 dígitos, sin el `+56 9`. Se limpia todo lo que no sea dígito.
- Nombre: entre 2 y 80 caracteres.
- Edad: entero entre 4 y 17, y **solo** si la clase es para una hija. Hay un check en base de
  datos que lo garantiza.
- Curso inválido o inexistente: rechazado contra la lista real de cursos.
- JSON malformado: 400 con mensaje claro.
- Faltan variables de entorno o falla Supabase: 500 con mensaje que empuja a WhatsApp, para que
  la visitante nunca quede sin salida.

## 7. Modelo de datos implementado

Tabla `public.leads` (ver `supabase/migrations/20260801000000_leads.sql` y
`ARCHITECTURE.md` §3). Decisión de seguridad: **RLS activo sin políticas**, `revoke all` a
`anon` y `authenticated`, y solo `grant insert to service_role`. La landing escribe leads y
nunca los lee.

## 8. Criterios de aceptación

- [x] El formulario persiste el lead en `leads`.
- [x] Cada curso muestra las profesoras correctas (K-Pop → Maida).
- [x] El prefijo `+56 9` se renderiza correctamente.
- [x] Desplegada en Vercel.
- [x] Ningún dato inventado: lo indefinido se muestra como "Por confirmar".
- [x] `NEXT_PUBLIC_SITE_URL` seteada en producción (21/08/2026).
- [x] Verificado de punta a punta: envío real desde producción guardado en `leads` (21/08/2026).
- [ ] Vista previa de Open Graph confirmada al compartir el link por WhatsApp e Instagram.
- [ ] Sin `"Por confirmar"` visible el día del lanzamiento.
- [ ] Fotos y videos reales en lugar de placeholders.
- [ ] Bios reales de las cinco profesoras.
- [ ] Dominio propio apuntando al sitio.

## 9. Métrica de éxito

**Conversión visita → lead ≥ 5%** durante el mes de lanzamiento, y al menos **20 leads** en las
dos semanas alrededor del Open Day. El campo `origen` debe permitir decir qué sección convierte.

## 10. Riesgos

- El cuello de botella real es difusión, no producto: si Instagram no trae tráfico, la landing
  no tiene qué convertir.
- Sin precios ni horarios definidos, la página pide confianza sin dar información. Cada
  "Por confirmar" es fricción.
- Sin fotos propias, compite en desventaja con academias que sí las tienen.

## 11. Notas de implementación

- Catálogo hardcodeado en `lib/cursos.ts` y `lib/profesoras.ts`. Deuda consciente: migra a base
  de datos en Hito 1.
- `lib/lead.ts` es lógica pura sin dependencias: el mejor candidato del repo para los primeros
  tests, si alguna vez se agregan.
- `README.md` sigue siendo el de `create-next-app`.
