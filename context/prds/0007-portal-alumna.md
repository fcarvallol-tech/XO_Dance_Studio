# PRD-0007 — Portal de la alumna

| Campo | Valor |
|---|---|
| **Estado** | Borrador |
| **Fecha** | 21 de agosto de 2026 |
| **Hito** | Hito 4 |
| **Relacionados** | PRD-0005 · PRD-0006 |

## 1. Problema

Una vez que la alumna compra y reserva, necesita un lugar donde ver qué compró, cuántas clases
le quedan, a qué se inscribió y poder deshacer un error.

## 2. Alcance

1. **Tu perfil:** nombre, correo, plan actual (contador de clases disponibles) y "afiliado"
   (⚠️ campo por definir, ver §5).
2. **Tus créditos:** saldo disponible y, si los créditos vencen, cuándo vence cada lote.
3. **Tu calendario:** las clases de esta semana a las que está inscrita, destacadas dentro del
   calendario general.
4. **Tus reservas:** próximas e históricas, con estado.
5. **Cancelar reserva**, sujeto a la ventana de cancelación.
6. Acceso directo a comprar más clases cuando el saldo llega a cero.

## 3. Fuera de alcance

- Editar nombre o correo: vienen de Google.
- Historial de pagos descargable como documento tributario.
- Mensajería con la profesora.

## 4. Casos borde

- **Saldo cero con reservas futuras vigentes.** Es un estado normal: los créditos ya se
  consumieron. No mostrarlo como error.
- **Cancelar fuera de la ventana.** Se permite cancelar —libera el cupo, que es bueno para XO—
  pero **no se devuelve el crédito**, y hay que decirlo antes de confirmar, no después.
- **Clase cancelada por XO.** Aparece marcada, con el crédito devuelto visible en el historial.
- Alumna sin ninguna compra todavía: estado vacío que empuja a comprar, no una tabla en blanco.

## 5. ⚠️ Pendiente

**"Afiliado"** aparece en la definición del perfil pero no está claro qué significa: ¿un código
de referido? ¿la profesora con la que entró? ¿un convenio de empresa o colegio? Cada opción
implica un modelo de datos distinto. Definir antes de implementar.

## 6. Criterios de aceptación

- [ ] El contador de clases coincide siempre con el libro de movimientos.
- [ ] La cancelación avisa con claridad si devuelve o no el crédito **antes** de confirmar.
- [ ] Cancelar libera el cupo de inmediato.
- [ ] El calendario destaca las clases propias dentro del general.
- [ ] Funciona bien en pantalla de teléfono: es donde va a vivir.

## 7. Métrica de éxito

Que las consultas por WhatsApp del tipo "¿cuántas clases me quedan?" y "¿a qué hora era?"
desaparezcan casi por completo.
