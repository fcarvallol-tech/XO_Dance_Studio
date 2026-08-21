# ADR-0002 — Paquetes de clases con reserva por horario, en vez de mensualidad

| Campo | Valor |
|---|---|
| **Estado** | **Aceptada** — modelo híbrido (Opción C), 21/08/2026 |
| **Fecha** | 21 de agosto de 2026 |
| **Decide** | Felipe Carvalho |

## Contexto

El modelo original era el de una academia clásica: la alumna se inscribe a un curso con horario
fijo y paga una mensualidad ($45.000 en Kids). El objetivo declarado ahora es que la operación
sea **lo más autónoma posible a través de la página**: que la persona se registre, compre y
reserve sola, sin que nadie intervenga por WhatsApp.

## Opciones

### A — Mensualidad por curso
A favor: simple de cobrar y de proyectar; ingreso predecible; es lo que ya funciona con las 8
alumnas actuales; las mamás de Kids entienden el formato sin explicación.
En contra: obliga a la alumna a comprometerse con un horario fijo; no aprovecha que hay cinco
profesoras y varios estilos; poco compatible con la idea de elegir con quién bailar.

### B — Paquetes de clases con reserva libre
A favor: la alumna elige profesora, estilo y horario clase a clase; el ingreso entra por
adelantado y en bloque; permite construir el producto alrededor de las profesoras, que es la
visión de plataforma de talentos; llena horarios que de otro modo quedarían con tres personas.
En contra: el ingreso deja de ser predecible; los créditos no consumidos son un pasivo; exige
pagos online, cuentas y reservas **desde la primera versión**; hace mucho más difícil planificar
cuántas alumnas habrá el martes.

### C — Híbrido
Teens con inscripción continua y horario fijo; Girly y K-Pop con paquetes y reserva libre.
A favor: respeta que una niña de 7 años va el mismo día siempre y su mamá no quiere reservar cada
semana; mantiene el ingreso predecible donde se puede.
En contra: dos modelos de cobro conviviendo, más complejidad en el esquema y en la interfaz.

## Decisión

Se adopta el **modelo híbrido (Opción C)**:

- **XO Teens (11–15): suscripción mensual.** Horario fijo, la mamá paga, no se reserva.
- **Girly Básico, Girly Intermedio y K-Pop: packs de clases con reserva libre.**

## Razón

Es el único de los tres que hace posible el objetivo de autonomía total por la web, y es
coherente con la visión de fondo del negocio: si XO es una plataforma de talentos y la pregunta
de captación pasa a ser "¿con quién quieres tomar clases?", el producto tiene que dejar elegir
profesora clase a clase. Con mensualidad por curso, esa promesa no se puede cumplir.

## Cómo se resolvió la decisión abierta

**¿Aplica también a XO Teens?** El 21/08/2026 se decidió sacar XO Kids del catálogo y migrar a
sus alumnas a Teens, que queda como curso de entrada. Eso **no cierra la pregunta, la traslada**:
Teens son niñas de 11 a 15 con horario fijo, cuya mamá paga. Pedirle que reserve cada semana es
fricción sin beneficio, y Teens pasa a ser ahora el curso que sostiene la caja.

**El pricing lo vuelve cuantificable.** Las alumnas que migran a Teens pagan hoy $45.000 al mes
por 4 clases ($11.250 por clase). El pack de 4 cuesta $30.000 ($7.500 por clase): **un 33%
menos por alumna**. La mudanza a salas más baratas alivia el costo y por lo tanto el margen,
pero no cambia la caída del ingreso por alumna: son dos palancas distintas. Antes de aplicar
créditos a Teens hay que ver el número con el arriendo nuevo sobre la mesa.

**Resuelto el 21/08/2026: se adopta el híbrido.** Teens mantiene mensualidad; Girly y K-Pop van
con packs. El sistema soporta las dos ramas desde el primer esquema, que era justamente la razón
de decidirlo antes de programar.

## Consecuencias

**Más fácil:** llenar horarios; poner a las profesoras al centro; cobrar por adelantado.

**Más difícil:** proyectar ingresos y asistencia; explicar el modelo a las mamás; y sobre todo,
el alcance de la v1 crece mucho — cuentas, pasarela de pago, créditos y reservas pasan a ser
requisitos de lanzamiento del software, no mejoras posteriores.

**Nuevos riesgos:** créditos no consumidos como pasivo · clases con 45 reservas y 6 asistentes
si no hay política de cancelación · caja que se ve bien mientras el servicio no se entrega.

**Consecuencia de la mudanza de sedes:** con salas a $17.000 y $0 en vez de $60.000, el riesgo
de abrir un horario nuevo cae mucho. Tres alumnas cubren la sala en Los Leones; en Los Dominicos,
ninguna. Eso hace viable una parrilla amplia de horarios, que es justamente lo que el modelo de
reserva libre necesita para funcionar.

## Cuándo revisar

Si a los tres meses la tasa de utilización de créditos está por debajo del 60%, o si las mamás
de Teens no se adaptan a reservar, se reevalúa volver a mensualidad en ese curso.
