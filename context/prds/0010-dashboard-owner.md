# PRD-0010 — Dashboard de owner: métricas y finanzas

| Campo | Valor |
|---|---|
| **Estado** | Borrador |
| **Fecha** | 21 de agosto de 2026 |
| **Hito** | Hito 5 |
| **Relacionados** | PRD-0009 · `ARCHITECTURE.md` §8 |

## 1. Problema

El owner necesita saber si el negocio está funcionando, no solo si la operación del día corre.
En un modelo de paquetes prepagados esto es menos obvio de lo que parece: la caja puede verse
excelente mientras el negocio se vacía, porque cobrar por adelantado no es lo mismo que
entregar el servicio.

## 2. Alcance

1. **Dashboard de métricas** con los indicadores de `ARCHITECTURE.md` §8.
2. **Finanzas:** registro de egresos, caja neta del mes, comparación con el mes anterior.
3. **Liquidación de profesoras:** clases dictadas, monto y estado de pago.
4. Todas las facultades del rol `admin`.

## 3. Las métricas, y por qué cada una

**Caja y venta.** Ingresos del mes por venta de paquetes · ticket promedio · plan más vendido ·
caja neta (ingresos − arriendo de sala − pago a profesoras).

**Créditos — el indicador propio de este modelo.**
- *Clases vendidas vs. consumidas.* La diferencia es plata cobrada por un servicio que todavía
  se debe. Es pasivo, no utilidad. **La métrica más importante del tablero.**
- *Tasa de utilización de créditos.* Si baja, la gente compra y no viene: anticipa abandono
  meses antes de que se note en la caja.
- *Créditos por vencer en 30 días.*

**Demanda.** Ocupación por clase (sobre 45) y por horario · horarios saturados vs. muertos ·
ranking de profesoras por reservas y por ingreso atribuido.

**Alumnas.** Activas (con crédito vigente o reserva en 30 días) · **tasa de recompra**, que es
la retención real en este modelo · alumnas con créditos y sin reservar hace 30 días · embudo
visita → cuenta → primera compra → primera reserva → segunda compra.

**Operación.** Cancelaciones y no-shows · margen por clase dictada.

## 4. Fuera de alcance

- Proyecciones y forecasting.
- Exportar a contabilidad o integración con el SII.
- Métricas de Instagram: viven en Instagram.

## 5. Casos borde

- **Primeros meses con poca data.** Los porcentajes con denominadores chicos engañan: mostrar el
  número absoluto junto al porcentaje, siempre.
- **Ingreso atribuido a una profesora.** Requiere una regla: propuesta, se atribuye al momento
  de la reserva, no al de la compra, porque la compra no elige profesora.
- Alumna que compra y nunca reserva: cuenta en ingresos, no en alumnas activas. Es exactamente
  la brecha que el tablero debe hacer visible.

## 6. Reglas de negocio

1. Toda métrica se calcula desde el libro de movimientos y las reservas, nunca desde totales
   guardados a mano.
2. Cada indicador muestra el período y es comparable con el anterior. Un número sin comparación
   no dice nada.
3. Solo `owner` accede. `admin` no ve montos.

## 7. Criterios de aceptación

- [ ] El tablero muestra clases vendidas, consumidas y la brecha entre ambas.
- [ ] La caja neta cuadra con la suma de compras pagadas menos egresos.
- [ ] Cada indicador trae comparación con el período anterior.
- [ ] Un usuario `admin` no puede acceder, ni por URL directa.

## 8. Métrica de éxito

Que la decisión de abrir, mover o cerrar un horario se tome mirando el tablero y no por
intuición.
