# PRD-0003 — Ajustes de landing y captación por profesora

| Campo | Valor |
|---|---|
| **Estado** | Implementado |
| **Fecha** | 21 de agosto de 2026 |
| **Hito** | Hito 0 — Lanzamiento |
| **Relacionados** | PRD-0001 (landing original) · PRD-0004 (cuentas) |

## 1. Problema

La landing describe la academia como "de baile urbano femenino", ofrece una "clase gratis" y
pregunta por **curso**. Tres cosas cambiaron: el descriptor se amplía a "academia de baile", el
CTA deja de prometer gratuidad, y la captación pasa a organizarse por **profesora**, que es el
eje de la visión de plataforma de talentos.

## 2. Alcance

1. Cambiar el descriptor a "Academia de baile" en todos los textos y en la metadata.
2. Cambiar el CTA principal de "Reservar clase gratis" a **"Reservar clase"**.
3. Cambiar la pregunta del formulario de "¿Qué curso te interesa?" a
   **"¿Con quién quieres tomar clases?"**, con las cinco profesoras como opciones.
4. Migración de base de datos: `curso_id` pasa a nullable, `profesora_id` a obligatorio.
5. Ajustar `lib/lead.ts` y `app/api/lead/route.ts` a la nueva validación.
6. Perfil público por profesora, con CTA a "Inscribirse".

## 3. Fuera de alcance

- El flujo de compra y reserva → PRD-0004 a 0006. Mientras no existan, el CTA sigue llevando al
  formulario de WhatsApp.
- Publicar precios.

## 4. Casos borde

- **Leads antiguos** tienen `curso_id` poblado y `profesora_id` nulo. La migración no puede
  romperlos: los campos quedan opcionales a nivel de datos históricos y la obligatoriedad se
  impone en la aplicación, no con un `NOT NULL` retroactivo.
- Una profesora que dicta varios cursos: al elegirla, ¿se pregunta también el curso? Propuesta:
  no. Se captura la profesora y el resto se conversa por WhatsApp.
- Profesora inactiva: no aparece en el selector.

## 5. Reglas de negocio

- Quitar "gratis" del CTA **elimina la promesa de clase de prueba sin costo**. ✅ Confirmado por
  Felipe el 21/08/2026: la promesa se retira **entera**, no solo del botón. La sección que decía
  "La primera clase va por nuestra cuenta" pasa a "Primero vienes, después decides", el
  subtítulo de Cursos deja de prometerla y la metadata también. Sigue pendiente en
  `CONTEXT.md` §12 la decisión de fondo sobre si existe alguna clase de prueba.
- Los perfiles públicos de profesoras usan foto y bio reales. Mientras no existan, placeholder
  evidente, nunca stock.

## 6. Criterios de aceptación

- [x] No queda ninguna mención a "baile urbano femenino" en el sitio ni en la metadata.
- [x] El CTA dice "Reservar clase" en todas sus apariciones. En la ficha del lineup y en el
      perfil público dice "Reservar clase con «nombre»": mantiene la frase y agrega a quién,
      que es justo el eje que este PRD pone al centro.
- [x] El formulario pregunta por profesora y guarda `profesora_id`.
- [x] Los leads existentes siguen legibles tras la migración.
- [x] Cada profesora tiene página propia (`/profesoras/[slug]`) con CTA que lleva al formulario
      con la profe ya elegida.

## 7. Métrica de éxito

Que la conversión visita → lead no baje al quitar la palabra "gratis". Si baja de forma
apreciable, es señal de que la prueba gratis sí estaba haciendo el trabajo.

## 8. Cómo quedó implementado

| Alcance | Dónde |
|---|---|
| Descriptor | `app/layout.tsx`, `app/opengraph-image.tsx`, `components/Hero.tsx` |
| CTA | `Barra` · `Hero` · `Cursos` · `ClaseDePrueba` · `Lineup` · perfil público |
| Pregunta por profesora | `components/Formulario.tsx` + `components/Seleccion.tsx` |
| Validación | `lib/lead.ts`: `cursoId` opcional, `profesoraId` obligatorio |
| Migración | `supabase/migrations/20260821120000_leads_captacion_por_profesora.sql` |
| Perfil público | `app/profesoras/[slug]/page.tsx`, con `?profesora=` leído por `PreseleccionPorUrl` |

Decisiones tomadas al implementar:

- **`profesora_id` no queda `not null` en la base.** La obligatoriedad se impone en la
  aplicación, como pide §4. Lo que sí garantiza la base es que ningún lead quede sin curso *y*
  sin profesora, con un check que los históricos ya cumplen.
- **`lib/profesoras.ts` gana el campo `activa`.** Es lo que resuelve el caso borde de la
  profesora inactiva: no aparece en el selector, no tiene perfil público y el servidor rechaza
  su id, pero los leads históricos que la nombran siguen legibles.
- **El curso se sigue guardando** cuando el lead entró desde una tarjeta de curso. No se
  pregunta, pero es información que no cuesta nada capturar y la columna quedó nullable
  justamente para eso.
- **El `origen` `clase-de-prueba` no se renombró** aunque la sección ya no prometa una clase
  gratis: es la llave con que se comparan los leads de antes y después, que es la métrica de
  éxito de §7.

Fuera del alcance, detectado y **no** tocado: desactivar `kids` en `lib/cursos.ts`
(`CONTEXT.md` §4 lo pide), las columnas de seguimiento del lead y las políticas RLS de
`admin`/`owner` de `ARCHITECTURE.md` §6.

⚠️ **La migración está escrita pero no aplicada.** El archivo queda en `supabase/migrations/`
para revisión de Felipe. Hasta que corra `supabase db push`, el formulario en producción falla
al insertar un lead sin curso, porque `curso_id` sigue siendo `not null` en la base.
