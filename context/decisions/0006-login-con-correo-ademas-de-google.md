# ADR-0006 — Magic link por correo además de Google

| Campo | Valor |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 25 de agosto de 2026 |
| **Decide** | Felipe Carvalho |
| **Reemplaza a** | ADR-0004 (Google como único método de acceso) |

## Contexto

ADR-0004 eligió Google como **único** método de acceso, y su consecuencia no obvia razonaba
sobre alumnas de 7 años que obviamente no tienen cuenta propia. Ese razonamiento ya no aplica:
XO Kids salió del catálogo el 21/08/2026 y la edad mínima de la academia es 11.

Lo que cambió el problema no es la edad mínima por sí sola, sino cómo se cruza con el modelo de
venta:

- **K-Pop es de 11 años para arriba** desde el 24/08/2026 y se vende con **packs de clases con
  reserva libre** (`decisions/0002-modelo-creditos.md`). No es horario fijo: la alumna elige
  clase a clase.
- Eso significa que una alumna de 11 a 15 **necesita entrar y reservar por sí misma**. No es una
  comodidad: es el flujo central del producto para ese curso.
- **Google exige 13 años** para tener cuenta propia. Las de 11 y 12 quedan fuera, y no por un
  descuido nuestro sino por una regla del proveedor que no podemos levantar.

Con Teens la tensión no existía —horario fijo, suscripción mensual, la mamá paga y no se reserva
clase a clase—, y por eso ADR-0004 no la vio venir. Con K-Pop 11+ sí existe.

## Opciones evaluadas

### Opción A — Magic link por correo, junto a Google
A favor: cubre a cualquiera con un correo, sin piso de edad del proveedor. Sin contraseñas que
recuperar. Supabase Auth lo trae nativo y convive con Google sin migrar nada.
En contra: un método más que mantener, y depende de que el correo llegue.

### Opción B — Email y contraseña, junto a Google
A favor: universal y conocido.
En contra: arrastra recuperación de contraseña, verificación de correo y una superficie de
soporte que no queremos con el equipo que hay. Es exactamente lo que ADR-0004 evitó en su
opción B, y ese argumento sigue siendo bueno.

### Opción C — Modelar dependientes, con la mamá como titular
A favor: refleja quién paga de verdad.
En contra: toca créditos, reservas y permisos a la vez. Ver "Alternativa descartada".

## Decisión

Se agrega **magic link por correo como segundo método de acceso**, junto a Google. **Sin
contraseñas.**

## Razón

Tres cosas de una sola vez:

1. **Resuelve el piso de edad.** Una niña de 11 con correo entra igual que una de 16. El límite
   de 13 años deja de ser nuestro problema.
2. **Elimina la dependencia de Google.** Deja de ser el único camino, que era el riesgo que
   ADR-0004 declaró asumible y se comprometió a mitigar "si aparecen personas que no pueden
   entrar". Aparecieron, y son un curso entero.
3. **El magic link evita los flujos de contraseña.** Sin recuperación, sin verificación, sin
   "olvidé mi clave" por WhatsApp un domingo. Se conserva lo mejor de ADR-0004 —entrar sin
   formulario— sin su restricción.

## Consecuencias

**Más fácil:** entra cualquiera con un correo. Se cierra la decisión que PRD-0004 §5 tenía
marcada como *pendiente y bloqueante*, sin tocar el modelo de datos.

**Más difícil:** dos caminos de acceso que probar y mantener.

⚠️ **Por verificar al implementar:** si alguien entra un día con Google y otro con magic link
usando **el mismo correo**, ¿queda con un perfil o con dos? Supabase tiene configuración de
vinculación de identidades por correo, así que el caso puede no darse. Hay que confirmarlo contra
la configuración real del proyecto antes de construir nada: si las identidades se vinculan, no hay
problema que resolver; si no, aplica lo que PRD-0004 §5 ya contempla, que es fusión desde admin.

### Lo que esta decisión NO resuelve

Que la alumna pueda entrar no cambia dos hechos:

- **Quien paga sigue siendo la mamá.** Una niña de 11 no tiene medio de pago propio.
- **Los datos de una menor están bajo Ley 19.628 / 21.719.** Tener cuenta propia no la vuelve
  titular de sus datos frente a la ley ni hace innecesario el consentimiento del apoderado.

### Decisión asociada

**Todo perfil menor de 18 debe registrar datos del apoderado —nombre, teléfono y correo— y una
autorización explícita, antes de poder comprar.** Bloquea la compra, no el acceso: la menor puede
entrar y mirar; no puede pagar hasta que eso esté.

**La autorización la confirma el apoderado, no la menor.** Si la niña escribe el correo de su mamá
y marca una casilla, el consentimiento es autodeclarado: la mamá nunca participó y no hay nada que
distinga una autorización real de una inventada por una niña de 12 que quiere ir a bailar. Eso no
sirve como consentimiento ni frente a la Ley 19.628 / 21.719 ni frente a la mamá cuando llegue el
cobro. Entonces: al guardar los datos se envía un correo al apoderado con un **enlace de
confirmación**, reutilizando la misma infraestructura de magic link que esta decisión ya obliga a
construir para el acceso. **La compra se desbloquea cuando el apoderado confirma, no cuando la
menor declara.** Mientras tanto el perfil queda pendiente de autorización.

Que no cueste infraestructura nueva es parte del argumento: el mismo mecanismo que resuelve el
piso de edad resuelve el consentimiento del apoderado.

**La cuenta es de la alumna.** No se modelan cuentas vinculadas ni dependientes: los datos del
apoderado son campos del perfil de la alumna, no otro perfil ni otra relación.

## Alternativa descartada

**Modelar dependientes, con la mamá como titular y las hijas colgando de su cuenta** (Opción C).

Se descartó porque toca **créditos, reservas y permisos** a la vez: obliga a responder de quién
es el crédito, quién puede cancelar la reserva de quién, y qué ve cada uno — tres preguntas que
hoy tienen respuesta simple porque hay un solo dueño por fila. Y sobre todo: el objetivo real
—que haya un adulto responsable identificado y consintiendo— **se logra con un requisito de
perfil**, sin una entidad nueva. Es la misma lógica de ADR-0005: no se agrega estructura hasta
que haya un caso que la exija de verdad.

Si más adelante una mamá con tres hijas en la academia se vuelve un caso frecuente, se
reconsidera con datos.

## Cuándo revisar

- Si aparecen apoderados con varias hijas gestionando todo desde una sola cuenta, y el requisito
  de perfil se queda corto.
- Si la entrega de los magic links resulta poco confiable —correos que caen en spam, demoras—
  al punto de costar registros. Ahí se evalúa un tercer método.
- Si la confirmación del apoderado resulta ser un embudo caro: la compra de una menor ahora
  depende de que un tercero abra un correo y haga click. Si muchas se quedan a medio camino, hay
  que buscar otra forma de obtener el consentimiento, no eliminarlo.
- Si cambia la edad mínima de la academia, porque este ADR se apoya en que es 11.
