# PRD-0003 — Ajustes de landing y captación por profesora

| Campo | Valor |
|---|---|
| **Estado** | Borrador |
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

- Quitar "gratis" del CTA **elimina la promesa de clase de prueba sin costo**. ⚠️ Confirmar que
  es intencional: hoy es la principal herramienta de conversión de la landing.
- Los perfiles públicos de profesoras usan foto y bio reales. Mientras no existan, placeholder
  evidente, nunca stock.

## 6. Criterios de aceptación

- [ ] No queda ninguna mención a "baile urbano femenino" en el sitio ni en la metadata.
- [ ] El CTA dice "Reservar clase" en todas sus apariciones.
- [ ] El formulario pregunta por profesora y guarda `profesora_id`.
- [ ] Los leads existentes siguen legibles tras la migración.
- [ ] Cada profesora tiene página propia con CTA a inscribirse.

## 7. Métrica de éxito

Que la conversión visita → lead no baje al quitar la palabra "gratis". Si baja de forma
apreciable, es señal de que la prueba gratis sí estaba haciendo el trabajo.
