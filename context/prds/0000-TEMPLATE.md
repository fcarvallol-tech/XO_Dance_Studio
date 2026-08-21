# PRD-0000 — [Nombre de la feature]

| Campo | Valor |
|---|---|
| **Estado** | Borrador · Aprobado · En desarrollo · Implementado · Descartado |
| **Autor** | |
| **Fecha** | |
| **Hito** | (ver `ROADMAP.md`) |
| **PRDs relacionados** | |

---

## 1. Problema

¿Qué duele hoy? Descríbelo desde la operación real, no desde la solución.
Mal: "falta un módulo de asistencia". Bien: "no sabemos qué alumnas están faltando hasta que
se retiran, y la profesora anota en su cuaderno".

## 2. Usuario y contexto de uso

Quién lo usa, desde qué dispositivo, en qué momento, con cuánto tiempo disponible.
(Ejemplo: la profesora, desde el teléfono, mientras las alumnas entran a la sala, en < 60 segundos.)

## 3. Alcance

Lo que esta feature **sí** incluye. Lista numerada, concreta, verificable.

1.
2.

## 4. Fuera de alcance

Lo que explícitamente **no** entra, aunque parezca natural. Esta sección evita el 80% del
scope creep. Si algo se deja fuera, decir para cuándo queda.

-

## 5. Flujo principal

Paso a paso de la experiencia. Un solo camino feliz, en prosa o lista.

## 6. Casos borde y errores

Qué pasa cuando: no hay conexión, el dato ya existe, el cupo está lleno, el usuario no tiene
permiso, se cancela a mitad de camino.

## 7. Modelo de datos

Tablas y campos nuevos o modificados. Migraciones necesarias. Impacto en RLS.

```sql
-- esquema propuesto
```

## 8. Reglas de negocio

Las validaciones que el sistema debe imponer sí o sí.

## 9. Criterios de aceptación

Checklist verificable. Si no se puede marcar como cierto o falso, no es un criterio.

- [ ]
- [ ]

## 10. Métrica de éxito

Cómo sabremos en 30 días si esto sirvió. Una métrica, no cinco.

## 11. Riesgos y supuestos

Qué asumimos que podría no ser cierto.

## 12. Notas de implementación

Solo se llena al terminar: qué se desvió del plan, qué quedó pendiente, qué deuda técnica quedó.
