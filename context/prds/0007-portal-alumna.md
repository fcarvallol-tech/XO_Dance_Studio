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

## 8. Ajustes al calendario de reservar (Felipe, 04/10/2026)

Dos ajustes a `/reservar`. No abren un PRD propio: son de esta pantalla y de PRD-0006 §12.

### 8.1 De listado a calendario, con la grilla que ya existía

`/reservar` era un listado por día. Ahora es **`GrillaCalendario`, la misma del sitio público**
—siete días, tramos de media hora, un día a la vez bajo 1024 px con los siete días como
botones—, y no un segundo calendario: la grilla tiene que verse igual en todos los portales.

Para reutilizarla sin copiarla se le agregaron dos cosas, y nada más:

- **`tema`**: la grilla era solo para fondo negro (texto blanco, días en rosa) y el portal es
  claro. En `claro` **ningún texto es rosa** —1,7:1 sobre blanco, prohibido por `estilo.md`—: lo
  secundario va en `xo-gris`.
- **`bloque`**: qué va dentro de cada clase. La grilla calcula dónde cae y cuánto mide, y se lo
  entrega al bloque; el sitio público no lo pasa y sigue con su enlace de siempre, con el mismo
  HTML.

En el portal cada clase es **accionable**, según `estadoParaAlumna` (`lib/dominio/reservas.ts`,
con tests):

| Estado | Qué dice el bloque | Qué ofrece al tocarlo |
|---|---|---|
| Reservable | `N lugares` | **Reservar esta clase**, y cuántas le quedan |
| Reservada por ella | `✦ Reservada`, en negro | Cancelar su reserva (hasta 30 min antes) |
| Llena | `Llena` | Nada que apretar: "se llenó" |
| Sin créditos | `N lugares` | **No hay botón**: "No te quedan clases" y el enlace a comprar |
| Especial | `Especial` | Se paga aparte: enlace a su página, sin botón de reservar |

**Tocar una clase abre su detalle; no reserva.** En un bloque de una hora (56 px) no cabe un
botón, y reservar de un toque en el teléfono es reservar sin querer. Es el mismo patrón de dos
pasos que la bandeja de transferencias (PRD-0017 §19), con el `<dialog>` nativo y el foco en
"Volver".

### 8.2 El filtro por profesora destaca y atenúa

Antes, al elegir una profesora el resto se ponía gris y la elegida no cambiaba: faltaba la mitad
del patrón. Ahora **sus clases van con fondo `xo-rosa` y texto `xo-negro`**, y su chip también,
para que se lea qué filtro está puesto. Las demás siguen visibles en `xo-gris` sobre blanco.

**Atenuadas por color, no por opacidad**: con opacidad el contraste depende de lo que haya
debajo. Y **medido, no estimado**: `scripts/verificar-reservar.mjs` pinta cada color en un canvas,
lee el píxel y calcula la razón WCAG contra el fondo real del bloque. **Atenuado: 4,97:1 como
mínimo** en 25 textos. **Destacado: 9,68:1** en 8. Las dos pasan AA (4,5:1).

Sus reservas van en negro **con o sin filtro**: "Reservada" es un estado de ella, no del filtro.

**En el teléfono, el punto de los botones de día sigue al filtro** (Felipe, 04/10/2026). Se ve un
día a la vez, así que sin esto había que tocar día por día para encontrar las clases de la
profesora elegida. Con Pau elegida, solo los días con clases de Pau llevan el punto; el botón
de un día con clases de otras sigue en negro, porque esas clases siguen ahí. Es la prop `marca`
de `GrillaCalendario`: sin ella cuentan todas, que es lo que usa el sitio público.

### 8.3 Lo que apareció al hacerlo

**Las clases especiales se ofrecían para reservar con el pack**, y la base lo rechazaba: "Las
clases especiales se pagan aparte, no con tus clases del pack". La plata nunca corrió riesgo
—el rechazo es de `reservar()`—, pero el listado viejo y el calendario público las mostraban como
una clase más, con el nombre del curso en vez de su título. **PRD-0018 lo había especificado y no
se implementó**: `getCalendario` y `getCalendarioPublico` ahora traen `tipo`, `slug`, `titulo` y
`precio_clp`, filtran las especiales sin publicar —explícito, además de RLS—, y una especial lleva
a `/clases-especiales/<slug>`. `/reservar/<id>` de una especial redirige ahí. No se muestran sus
lugares: su cupo cuenta también las pendientes de pago y este conteo no.

### 8.4 Verificado

Contra staging, con el sitio construido:

- `scripts/verificar-reservar.mjs`, nuevo: **30/30**. Con el filtro puesto a 375 px recorre los
  siete días y comprueba que el punto esté **si y solo si** al abrir ese día aparece una clase
  de ella. Una alumna con créditos reserva desde la
  grilla y se le descuenta, y lo cancela desde ahí; una sin créditos no tiene botón de reservar y
  ve que no le quedan; a 375 px los siete botones de día cambian la columna; el contraste se mide.
- `verificar-sitio.mjs`: **148/148**. Dos arreglos al verificador, no al sitio: leía la posición
  de cada clase del texto del atributo `style`, que el navegador escribe distinto cuando la
  grilla la dibuja el cliente; y medía la semana de hoy aunque estuviera vacía —un domingo—, con
  lo que sus casos pasaban sin medir nada.
- `verificar-transferencias.mjs`: **34/34**, con el paso de reservar por la grilla.

### 8.5 Pendientes

- ~~En el teléfono, con una profesora elegida, los botones de día no dicen qué días tienen
  clases de ella~~ — resuelto el mismo día, ver §8.2.
- **La grilla abre en la semana de hoy aunque ya no le queden clases** (un domingo): hay que
  apretar "Después". Es de la grilla, igual en el sitio público.
- **El portal de profesora sigue con `GrillaSemanal`**, que apila sin eje de tiempo. Es la otra
  grilla que diverge.
- La clase que empieza fuera de una media hora (14:50) sigue dibujándose corrida (PRD-0022 §14).

