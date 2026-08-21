# ADR-0001 — Construir ERP propio en vez de usar un SaaS de gestión de academias

| Campo | Valor |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | Agosto 2026 |
| **Decide** | Felipe Carvalho |

## Contexto

XO Dance Studio lanza formalmente en septiembre de 2026 con cinco profesoras y varios cursos
nuevos. Hoy la operación son 8 alumnas gestionadas con memoria, WhatsApp y planillas.

Existen SaaS de gestión de academias y estudios de baile (tipo Mindbody, Bsport, o soluciones
locales chilenas) que resuelven inscripciones, cobros y asistencia sin escribir una línea de
código. Al mismo tiempo, ya existe un proyecto Next.js + Supabase construido para la landing,
y el equipo tiene capacidad de desarrollo asistido por IA.

La decisión original era "landing primero, ERP después del lanzamiento". Se está cambiando.

## Opciones evaluadas

### Opción A — SaaS de gestión
A favor: cero desarrollo, funciona el día uno, cobros online resueltos, soporte incluido.
En contra: costo mensual recurrente desde el primer mes con 8 alumnas; el modelo de negocio de
XO (profesor-cliente, revenue share, rentabilidad por profesora y por sección) no encaja en el
modelo de datos de un SaaS de academias tradicional; los datos quedan en un tercero; personalizar
es imposible o caro.

### Opción B — Planillas hasta tener volumen
A favor: gratis, inmediato.
En contra: sin trazabilidad; el conocimiento operacional queda en la cabeza de una persona; no
escala a cinco profesoras; imposible medir los KRs de Fase 1 (retención, ocupación, margen por
sección) de forma confiable.

### Opción C — ERP propio sobre el stack existente
A favor: mismo repo, mismo stack, mismo deploy que la landing; el modelo de datos se diseña
alrededor del modelo de negocio real de XO, incluido el revenue share de Fase 2; los datos son
propios; costo marginal cercano a cero sobre Supabase y Vercel.
En contra: hay que construirlo; riesgo real de sobre-ingeniería; el cobro online es la parte
cara y hay que integrarla a mano más adelante.

## Decisión

Se construye ERP propio (Opción C), sobre el mismo proyecto Next.js + Supabase de la landing,
por fases estrictas definidas en `ROADMAP.md`.

## Razón

La razón principal no es el costo: es que **el modelo de negocio de XO no es el de una academia
normal**. La visión de Fase 2 es que las profesoras sean el cliente, con revenue share y
rentabilidad medida por profesora y por sección. Ningún SaaS de academias modela eso, porque
asume que el profesor es un empleado. Adoptar un SaaS ahora significaría migrar justo cuando el
negocio empiece a funcionar de verdad.

La razón secundaria es la trazabilidad. Los KRs de Fase 1 —retención ≥ 85%, dos cursos con 12
alumnas, caja neta positiva— no se pueden medir de forma confiable con planillas.

## Consecuencias

**Más fácil:** medir lo que importa; adaptar el sistema al modelo profesor-cliente sin migrar;
tener un solo lugar donde vive la operación.

**Más difícil:** el lanzamiento carga con trabajo de desarrollo que compite con marketing y
operación. El cobro online no llega gratis: hay que integrar una pasarela chilena (ADR pendiente).

**Mitigación del riesgo principal (sobre-ingeniería):** ninguna feature se construye sin PRD
aprobado, y el orden del roadmap es innegociable. El Hito 0 es solamente captar leads; el ERP
completo viene después del lanzamiento, no antes. Si el ERP retrasa el Open Day, el ERP cede.

## Cuándo revisar

Si a los seis meses el desarrollo del ERP está consumiendo más tiempo del que ahorra en
operación, o si aparece un SaaS que sí modele revenue share con profesoras, se reevalúa.
