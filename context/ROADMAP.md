# ROADMAP.md — XO Dance Studio

> Qué se construye, en qué orden y por qué.
> Última actualización: 21 de agosto de 2026.
> ⚠️ Replanificado tras el cambio a modelo de paquetes y reservas.

---

## Principio de secuenciación

> **Primero lo que capta, después lo que cobra, después lo que ordena, al final lo que mide.**

El objetivo declarado es que la operación sea **lo más autónoma posible a través de la página**.
Eso es correcto como destino, pero implica que la primera versión ya incluye cuentas, pagos
online y reservas — bastante más de lo que era "una landing".

**El lanzamiento no se mueve de septiembre.** Si el software compite con el Open Day, gana el
Open Day. La academia puede abrir cobrando por transferencia y agendando por WhatsApp mientras
la plataforma se construye; no puede abrir sin alumnas.

Nada se implementa sin PRD aprobado.

---

## Hito 0 — Lanzamiento (septiembre 2026) 🔴 EN CURSO

| # | Entregable | Estado |
|---|---|---|
| 0.1 | Landing pública one-page | ✅ Hecho |
| 0.2 | Captación de leads → Supabase + WhatsApp | ✅ Hecho |
| 0.3 | Deploy en Vercel | ✅ Hecho |
| 0.4 | Variables de entorno en Production | ✅ Hecho 21/08 |
| 0.5 | Verificación de punta a punta del formulario | ✅ Hecho 21/08 |
| 0.6 | Confirmar vista previa Open Graph al compartir | ⚪ Pendiente |
| 0.7 | Ajustes de copy y captación por profesora (PRD-0003) | ✅ Código hecho 21/08 — 🔴 falta aplicar la migración |
| 0.8 | Precios, horarios y cupos reales | 🔴 Bloqueado — falta decisión |
| 0.9 | Bios, fotos y videos reales | 🔴 Bloqueado — falta contenido |
| 0.10 | Confirmar las sedes y su capacidad | ✅ Dos sedes con dirección pública y 22 cupos cada una |
| 0.11 | Dominio propio | ⚪ Pendiente |

**Criterio de salida:** el Open Day ocurre y hay alumnas inscritas, con o sin plataforma.

---

## Hito 1 — Cuentas y catálogo (base de todo lo demás)

| # | Entregable | PRD |
|---|---|---|
| 1.1 | Autenticación con Google y magic link, perfiles y roles | ✅ PRD-0004 (menores ⏳, ver §9) |
| 1.2 | Catálogo en base de datos: cursos y profesoras | ✅ PRD-0015 (sedes y salas ⏳ con PRD-0006) |
| 1.3 | Clases y horarios recurrentes | PRD-0006 |
| 1.4 | Perfiles públicos de profesoras con CTA a inscribirse | ✅ Adelantado en PRD-0003 |

Sin esto no existe nada más: no hay a quién cobrarle ni quién reserve.

---

## Hito 2 — Venta de clases

| # | Entregable | PRD |
|---|---|---|
| 2.1 | Planes y página de compra | PRD-0005 |
| 2.2 | Integración con pasarela de pago | PRD-0005 · ADR-0003 |
| 2.3 | Créditos: lotes, saldo, movimientos, vencimiento | PRD-0005 |
| 2.4 | Comprobante por email | PRD-0005 |
| 2.5 | Suscripción mensual de Teens (rama híbrida) | PRD-0011 |

⚠️ **Requisito no técnico:** Inicio de Actividades en el SII (en curso, falta la firma de Carla)
y cuenta de comercio con la pasarela. Puede tomar semanas y no depende de programar.
Mientras tanto se puede operar con transferencia y registro manual del pago.

---

## Hito 3 — Reservas

| # | Entregable | PRD |
|---|---|---|
| 3.1 | Calendario de clases con filtro por profesora | PRD-0006 |
| 3.2 | Detalle de clase y reserva con descuento de crédito | PRD-0006 |
| 3.3 | Comprobante de reserva por email | PRD-0006 |
| 3.4 | Gestión y cancelación de reservas | PRD-0007 |

Es el corazón del producto. También lo más delicado: concurrencia por el cupo 22 y
transaccionalidad del crédito.

---

## Hito 4 — Portales

| # | Entregable | PRD |
|---|---|---|
| 4.1 | Portal de la alumna: perfil, créditos, calendario, reservas | PRD-0007 |
| 4.2 | Portal de la profesora: clases, inscritas, solicitar horario | PRD-0008 |
| 4.3 | Portal de administración: profesoras, cursos, calendario general, alumnas, reservas, solicitudes | PRD-0009 |

---

## Hito 5 — Owner: métricas y finanzas

| # | Entregable | PRD |
|---|---|---|
| 5.1 | Dashboard de métricas | PRD-0010 |
| 5.2 | Egresos y caja | PRD-0010 |
| 5.3 | Liquidación de profesoras | PRD-0010 |

---

## Hito 6 — Fase 2 del negocio (Gate 3)

Modelo profesor-cliente: comisiones, rentabilidad por profesora, marca personal.

---

## Fuera de alcance (decidido, no olvidado)

- App móvil nativa · facturación electrónica automática al SII · multi-idioma ·
  marketplace de profesoras · lista de espera cuando una clase se llena (candidato a Hito 3.5).

---

## Changelog

| Fecha | Cambio |
|---|---|
| 25 ago 2026 | Arreglado un **bucle de redirección infinito** al entrar: el layout de `(cuenta)` mandaba a `/completar-perfil`, que vivía dentro de `(cuenta)`, así que se reejecutaba y volvía a redirigir. La guarda contra el bucle existía, pero dependía de un argumento que el layout no pasaba. Se movió la ruta fuera de los grupos en vez de pasar el pathname: así el bucle no queda mitigado, queda **inalcanzable**. `lib/rutas.ts` declara qué cubre cada grupo, los cuatro layouts pasan el suyo y el guard se niega a redirigir hacia adentro de sí mismo. De paso se agregó el `grant select on perfiles to service_role` que faltaba. ⚠️ La migración **ya estaba aplicada**, así que ese grant no toma efecto hasta volver a correrla. Ver PRD-0004 §12 |
| 25 ago 2026 | El rol `profesora` deja de poder existir sin identidad. Antes, promover a alguien a profesora la dejaba con `profesora_id` en null: entraba al portal y no veía ninguna clase, porque el sistema no sabía cuál de las cinco era. Ahora `cambiar_rol` exige `p_profesora_id` para ese rol y **lo limpia al salir**, un check de tabla lo garantiza incluso contra un `update` a mano, y la ruta de servidor valida el slug contra `PROFESORAS_ACTIVAS` — validación que existe solo mientras no haya FK, y que se cae sola cuando el catálogo migre a base de datos. El libro `cambios_rol` registra también a qué profesora quedó amarrada |
| 25 ago 2026 | **PRD-0004 implementado con recorte de alcance**, en la rama `prd-0004-cuentas`. Supabase Auth con Google y magic link, sin contraseñas. `perfiles` creada por trigger sobre `auth.users`, con `rol` en `alumna` por defecto. La jerarquía de roles es aritmética (`nivel_rol`/`tiene_nivel`), así que `owner` incluye a `admin` sin listas paralelas. RLS explícita en `perfiles`, `cambios_rol` y `leads` — esta última **por fin la puede leer admin**. Protección en tres capas: `proxy.ts` refresca el token y hace un chequeo optimista, el layout de cada grupo autoriza de verdad con `getClaims()`, y RLS es la última línea. El cambio de rol va por `POST /api/roles` con la service role key, porque `authenticated` no tiene grant sobre la columna `rol` ni siendo admin, y queda registrado en `cambios_rol`, que es append-only de verdad. ⏳ **Recortado:** todo lo de menores de edad, porque XO Mini entra con rango etario sin definir y eso tumba el supuesto de ADR-0006. ⚠️ Migración escrita y **sin aplicar**; falta cargar `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y habilitar Google en Supabase |
| 4 sep 2026 | 🔴 **Una clase cancelada le hacía perder el crédito a la alumna, no solo desaparecer.** PRD-0006 §5 prometía desde agosto que cancelar devuelve el crédito a todas las reservas, y **no existía ninguna función que lo hiciera**: cancelar era poner `estado` a mano en el Table Editor, y eso dejaba la clase fuera del calendario, **la reserva fuera también** —la consulta descartaba reservas sin clase—, la reserva en `confirmada` y el crédito sin devolver. Arreglado con un **trigger** y no solo una función, que es lo que hace que sirva: mientras no exista el portal de administración se cancela editando la fila, y una función que hay que acordarse de llamar no se llamaría nunca. Devuelve siempre, al lote original, y es idempotente. Ella ve la clase tachada arriba, con el motivo y el aviso de que le devolvieron la clase, y el historial distingue quién canceló. ⚠️ Falta el correo, que un trigger no puede mandar, y falta probarlo con datos: 0 reservas en la base |
| 4 sep 2026 | **Grilla semanal en el portal de profesora.** `/profesora/mis-clases` deja de ser una lista y pasa a mostrar **la parrilla completa de la academia** con los días como columnas y flechas por semana: quien va a pedir un horario necesita saber qué está ocupado y en qué sede, y sin la parrilla pide a ciegas. Las suyas en rosa y con enlace al detalle; las ajenas sin conteo, sin enlace y sin parecer tocables. **No reabre el bug de septiembre**: `clases` ya era pública, lo que estaba mal era que su lista mezclara las ajenas sin distinguirlas — y el conteo ajeno no se oculta en la interfaz, RLS no lo devuelve. Las canceladas se muestran tachadas, lo que obligó a exponerlas en RLS y de paso arregla que a la alumna se le **desaparecieran** del calendario. Se corrige `BRAND.md`: el patrón de calendario pedía "opacidad reducida" y a la vez texto legible, que sobre fondo claro se contradicen; ahora la jerarquía va por **saturación** y lo retrocedido se lee al 100%. Corregido también el `opacity-55` del calendario de la alumna |
| 3 sep 2026 | **Arreglado el magic link, que estaba roto desde PRD-0004 sin que nadie lo supiera.** El correo antes no llegaba —el SMTP de Supabase devolvía 429— así que el enlace nunca se probó; al pasar a Resend se vio que llevaba a "ese enlace ya no sirve". La causa: el template usa `{{ .ConfirmationURL }}`, que apunta al verificador de Supabase, **consume el token** y redirige con la sesión en el **fragmento** — que el navegador nunca manda al servidor. `/auth/confirmar` leía `token_hash`, no lo recibía, y mostraba un mensaje nuestro diciendo que el enlace había expirado. Arreglado en dos partes: el template pasa a apuntar directo a la ruta con `{{ .TokenHash }}` —configuración de panel, y lo único que funciona **entre dispositivos**— y la ruta acepta además `?code=` de PKCE. Deja de mentir cuando no recibe nada: distingue enlace usado, abierto en otro navegador y error de configuración. ⚠️ **La lección quedó en `CLAUDE.md`: verificar la ruta de datos no es verificar el flujo.** Cada prueba anterior llamaba `verifyOtp()` por el SDK y nunca abrió el enlace del correo, que es lo único que usa una persona |
| 3 sep 2026 | 🔴 **El arreglo anterior rompió el login** y se corrigió el mismo día. La causa no fue revocarle funciones a `anon` sino a **`PUBLIC`**, que en Postgres es el pseudo-rol que cubre a todos los roles, `authenticated` incluido. `tiene_nivel`, `mi_rol` y `nivel_rol` nunca habían tenido grant explícito: funcionaban por el default de `PUBLIC`. Como `tiene_nivel` la llaman las políticas RLS de casi todas las tablas, cualquier select con sesión respondía 42501 —7 de 14 operaciones rotas— y `perfilActual()` devolvía null, así que entrar y quedar afuera. Restaurado con grants explícitos a `authenticated`; **no se devolvió nada a `anon`** y los datos de transferencia siguen cerrados. Se escribieron además los grants de otras nueve funciones que dependían del default: lo que funciona por defecto se rompe silencioso al primer revoke. ⚠️ Apareció de paso que el SMTP de Supabase devuelve **429 por límite de envío** en los magic links, que es lo que ADR-0007 ya había anotado como señal para mover el SMTP a Resend |
| 3 sep 2026 | **Arreglado un error conceptual de RLS que estaba en dos lugares.** Una profesora reportó ver clases ajenas: `clases_de_la_profesora` no restringía nada, porque **las políticas permisivas de Postgres se combinan con OR** y `clases_lectura_publica` ya exponía todas las clases programadas. Verificado con sesión real: veía 73 en vez de 10. No se arregla restringiendo —las clases son públicas a propósito, las alumnas necesitan la parrilla para reservar— sino aceptando que "solo sus clases" es **presentación**, y filtrando en la consulta. La política se borra: una que no restringe es peor que ninguna. 🔴 **Buscando el mismo error apareció otro peor:** `parametros` era legible por `anon`, y ahí estaban cargados desde el 31/08 el nombre completo, el **RUT**, el número de cuenta y el correo personal de Carla. Corregido — y revocar la tabla **no alcanzaba**: `parametros_como_json` es `security definer` con grant a `anon` y los exponía igual, así que una tabla cerrada con una función que la abre es una tabla abierta. Se auditó todo lo que expone la API —17 tablas y vistas, 20 funciones, sacadas del OpenAPI y no de memoria— y el inventario de qué es público quedó escrito en PRD-0008 §14. 🟢 **Ninguna alumna quedó expuesta**: `inscritas_de_clase`, `perfiles` y `saldo_creditos` bloquearon todo, verificado con sesión real — haber resuelto los nombres con una función y no con una política sobre `perfiles` fue lo que evitó que este error filtrara datos de menores. Auditadas las quince tablas de PRD-0004, 0015, 0016 y 0017: el resto está bien. La lección queda escrita en `CLAUDE.md`. Además, la barra se agrupa por rol y "Mis clases" deja de aparecer dos veces |
| 2 sep 2026 | **PRD-0008: portal de la profesora**, en la rama `prd-0008-portal-profesora`. Ve sus clases con el conteo de inscritas, el detalle de cada una con quiénes vienen sobre 22, pide horarios nuevos y ve la respuesta. Se adelanta de PRD-0009 solo la bandeja para resolverlos, porque una solicitud en un buzón que nadie abre no sirve. **La restricción de datos decidió el diseño:** RLS filtra filas y no columnas, así que darle acceso a `perfiles` le entregaría el correo y el teléfono de cada alumna — los nombres salen de `inscritas_de_clase`, cuya firma de tres columnas *es* el contrato. Se cierra además una fuga que este PRD volvía alcanzable: `saldo_creditos` era `security definer` y estaba concedida a `authenticated`, o sea que cualquiera con un `perfil_id` ajeno podía ver su saldo. El reemplazo ya funcionaba —`clases.profesora_id` se copia del horario— y solo faltaba hacerlo legible. ⚠️ Migración escrita y **sin aplicar** |
| 2 sep 2026 | Arreglada la **bandeja de transferencias vacía**: decía "no hay transferencias esperando" con cinco compras pendientes en la base. No era RLS —la política estaba bien— sino un **embed ambiguo**: `compras` tiene dos llaves foráneas a `perfiles` (`perfil_id` y `aprobada_por`) y PostgREST respondía `PGRST201` sin devolver filas. Se desambiguan las dos, y también la de `movimientos_credito`, que tenía el mismo problema latente. **Lo importante es la causa de fondo:** las consultas desestructuraban solo `data` y hacían `?? []`, así que cualquier fallo de lectura se veía como "no hay nada" — indistinguible del caso normal, que es por lo que nadie lo notó. Ahora todas devuelven `Lectura<T> = { datos, error }` y las páginas lo muestran con `<ErrorDeLectura>`, siguiendo el patrón que PRD-0004 ya usaba en la página de leads. Se extendió a `getCatalogoCompleto`, que alimenta el resto del portal de admin |
| 31 ago 2026 | **PRD-0017 parte 2: la interfaz completa.** Comprar por transferencia, bandeja de aprobación para admin, calendario de 60 días con reserva y cancelación, y "mis clases" con saldo, reservas y compras. **Los precios se unifican en la base**: `lib/planes.ts` queda solo con tipos y formato, y la promoción se mueve a tres columnas provisionales de `planes` que PRD-0012 reemplazará — de paso la promo deja de necesitar deploy para apagarse. Correo con Resend (ADR-0007), siempre fuera de la transacción. `pg_cron` sigue sin confirmarse, así que hay camino alternativo con Vercel Cron y secreto, y los dos pueden convivir porque `generar_clases` es idempotente. El monto no viaja en el formulario: lo calcula el servidor. Encontrado y corregido un defecto de la parte 1, `parametros` sin grant para `service_role`, que es el mismo descuido que hubo con `perfiles`. ⚠️ Migración de la parte 2 sin aplicar; la de la parte 1 sí lo está. Parte 3 (importación) pendiente |
| 31 ago 2026 | **PRD-0017 aprobado y parte 1 implementada**, en la rama `prd-0017-transferencias`: compras por transferencia con aprobación manual, créditos, calendario de 60 días y reservas. Sin pasarela y con demanda entrando, es la alternativa que ADR-0003 ya había previsto. Esquema nuevo —`planes`, `compras`, `creditos`, `movimientos_credito`, `clases`, `reservas`, `parametros`— y **tres funciones que concentran la plata**: `acreditar_compra`, `reservar` y `cancelar_reserva`. `authenticated` no inserta ni actualiza nada de plata o cupo. La acreditación vive en una sola función, así que **Flow entra después como segundo camino sin desarmar esto**. El último cupo se serializa bloqueando la fila de la clase. Se agrega **ADR-0007: Resend** como proveedor de correo, con las plantillas en el repo — y de paso convierte registrar el dominio en requisito, no en tarea de marca. Las alumnas importadas sin correo se detectan con dos vistas, `duplicados_probables` y `perfiles_sin_actividad`: con 36 sin correo, alguna se va a registrar sola. Los ~$950.000 ya recibidos entran como **compras** y no como regalos, para que la conciliación bancaria cuadre. ⚠️ Migración escrita y **sin aplicar**; parte 2 (interfaz) y parte 3 (importación, que se implementa pero no se ejecuta) quedan pendientes |
| 30 ago 2026 | **La capacidad de sala baja de 45 a 22**, confirmada en las dos sedes. El 45 era un supuesto y era más del doble. Se corrige en `ARCHITECTURE.md`, `CONTEXT.md`, `CLAUDE.md`, `ROADMAP.md` y los PRD-0006, 0008, 0009 y 0010, y **se recalcula lo que dependía del número**: una clase llena deja $119.000 en Los Leones y $136.000 en Los Dominicos, contra los $280.000 que figuraban. ⚠️ El techo cae un 57% y el piso de 5–6 alumnas pasa a ser **un cuarto de la sala en vez de un octavo**: cambia el riesgo de abrir un horario, no solo la cifra. El cupo se confirma como atributo de la **sala**, nunca del curso. Además **el precio sale de las tarjetas de curso**: con créditos universales no depende del curso y la misma línea se repetía en las cuatro, compitiendo con la sección Planes |
| 30 ago 2026 | **Aclaración de negocio: los créditos son universales.** Un pack de N clases sirve para cualquier clase de la parrilla, con cualquier profesora y en cualquier sede; no están atados a un curso. Cierra la pregunta abierta de `CONTEXT.md` §4 sobre el formato intensivo por artista, que **desaparece**, y con él la columna `cursos.formato`. Refuerza ADR-0002 en vez de cambiarlo: si la captación pregunta con quién quieres bailar, un crédito atado a un curso cumplía esa promesa a medias. Simplifica PRD-0005 —sin compatibilidad plan↔curso ni validación al reservar— y queda escrito en `ARCHITECTURE.md` §5.4 que `creditos` **no lleva `curso_id`**, para que nadie se lo agregue creyendo que falta. **Teens sigue siendo la única excepción**: suscripción mensual con horario fijo |
| 30 ago 2026 | **PRD-0016: catálogo nuevo, sedes y horarios**, en la rama `prd-0016-catalogo-nuevo`. Girly Básico e Intermedio se funden en **Girly**; entran **Reggaeton Femme** y **Slow Femme**; salen **K-Pop** y **Maida**, desactivados. Teens pasa a 11–14 y el resto a 15+. Nuevas tablas **`sedes`** —con dirección **pública**, al revés de la regla que tenía `BRAND.md`— y **`horarios`**, con los siete horarios reales y dos índices únicos que impiden dos clases a la misma hora en la misma sede o una profesora en dos lugares a la vez. `cursos` gana `dificultad`. **`cursos_profesoras` se elimina**: `horarios` ya dice quién dicta qué y dos fuentes se desincronizan. **WhatsApp sale del flujo de conversión**: el formulario guarda el lead y confirma en la página, sin abrir pestaña. El sitio pasa a decir **Providencia y Las Condes** en hero, metadata, OG y páginas legales. Razón social corregida a **XO Dance Studio SpA**. ⚠️ Estado transitorio aceptado: por varias semanas el sitio informa clases ya iniciadas sin compra en línea, y el formulario es el único mecanismo de captación. ⚠️ Migración escrita y **sin aplicar** |
| 28 ago 2026 | **PRD-0015: el catálogo sale del código y pasa a la base**, en la rama `prd-0015-catalogo-en-bd`. `cursos`, `profesoras` y `cursos_profesoras` con los datos actuales como carga inicial editable desde el Table Editor: cambiar una bio deja de ser un commit. La landing sigue estática porque lee con un cliente sin cookies, y se refresca por webhook en segundos, con `revalidate = 3600` de red. `/profesoras/[slug]` pasa a `dynamicParams = true`, así que una profesora nueva ya no da 404 hasta el próximo deploy. Los slugs son inmutables por trigger. `perfiles.profesora_id`, `leads.curso_id` y `leads.profesora_id` pasan a llaves foráneas —salda la deuda de `ARCHITECTURE.md` §10— y la validación de slug de `/api/roles` se borra. `lib/cursos.ts` y `lib/profesoras.ts` se eliminan; `CursoId` y `ProfesoraId` pasan a `string`, anotado como consecuencia consciente. ⚠️ Migración escrita y **sin aplicar**: hasta que corra, el build falla a propósito con un mensaje que nombra el archivo |
| 25 ago 2026 | **Los precios se publican en el sitio (PRD-0014).** Nueva sección Planes entre Cursos y Clase de prueba, con los cuatro packs, el valor por clase y la promo de lanzamiento (4 en $20.000, 8 en $36.000) con el precio de lista tachado. `lib/planes.ts` pasa a ser la fuente única de precios: dejaron de ser por curso cuando el negocio pasó a packs, así que salen de `lib/cursos.ts`, que se queda con horarios y cupos. Las tarjetas de curso ya no dicen "Por confirmar" en el valor. `BRAND.md` §7 deja de prohibir publicar precios. Se resuelve la ambigüedad del flyer: la promo vence el **lunes 31 a las 23:59**, y en el sitio se anuncia sin hora. ⚠️ La promo se apaga **a mano**: la landing es estática y PRD-0012 todavía no existe |
| 25 ago 2026 | Saldada la deuda del fallback de `metadataBase` (`ARCHITECTURE.md` §10): `app/layout.tsx` encadena `NEXT_PUBLIC_SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → `localhost`, descartando cadenas vacías. Verificado con builds reales: con la variable de Vercel el canonical sale `https://xo-dance-studio.vercel.app`, y una variable vacía ya no gana |
| 25 ago 2026 | **Precios definitivos, un solo nivel:** 1 clase $8.500 · 2 $16.000 · 4 $28.000 · 8 $48.000. Reemplazan a la planilla del 21/08. **Se elimina la tarifa universitaria** y con ella el certificado de alumno regular: el descuento a universitarias pasa a ser un código de descuento (PRD-0013). Salen del esquema `planes.segmento` y los campos de verificación en `perfiles`. Se recalculan los derivados de `CONTEXT.md` §5.b: punto de equilibrio, clase llena y la comparación de Teens — ⚠️ con $28.000 el neto de Teens en Los Leones con 8 alumnas queda **bajo** el modelo viejo ($84.000 vs $120.000), y se cierra recién a las 10 alumnas. La promoción de lanzamiento (4 clases $20.000, 8 clases $36.000, hasta el 31/08) queda documentada como primer caso concreto de PRD-0012, con dos ambigüedades del flyer marcadas. Bios reales de Drimy, Lina y Pau en `lib/profesoras.ts`; Carli y Maida siguen con placeholder |
| 25 ago 2026 | Se cierra el hueco de la decisión asociada de ADR-0006: la autorización del apoderado **la confirma él por correo**, con un enlace que reutiliza la infraestructura de magic link. Declarada por la menor no vale: podría escribir el correo de su mamá y marcar la casilla sola. La compra se desbloquea con la confirmación, no con la declaración. Se corrige además el supuesto de perfiles duplicados —Supabase puede vincular identidades por correo, así que queda como algo a verificar al implementar, no como un hecho— y `CONTEXT.md` §12 da por resuelta la fila de la cuenta de una menor, cuya premisa (7 años) ya no existe |
| 25 ago 2026 | **ADR-0006: se agrega magic link por correo como segundo método de acceso, junto a Google y sin contraseñas.** Reemplaza a ADR-0004. Lo obliga el cruce de dos decisiones previas: K-Pop es 11+ y se vende con packs de reserva libre, así que la alumna reserva por sí misma, pero Google exige 13 años para tener cuenta propia. Decisión asociada: todo perfil menor de 18 debe registrar datos del apoderado y autorización explícita **antes de poder comprar** — la cuenta es de la alumna, sin dependientes ni cuentas vinculadas. Se descarta modelar dependientes con la mamá como titular: tocaba créditos, reservas y permisos, y el objetivo se logra con un requisito de perfil. PRD-0004 §3, §4, §5 y §7 quedan alineados y su decisión bloqueante sobre menores queda cerrada |
| 24 ago 2026 | Cierre de PRD-0003: `Formulario` pasa a `getCursoActivo`, para que el curso que se le muestra a la visitante y el que acepta el servidor usen el mismo predicado. Se corrigen tres referencias cruzadas rotas entre documentos de contexto: `CONTEXT.md` §4 apuntaba a `ARCHITECTURE.md` §2/§9 en vez de §5/§7, `ARCHITECTURE.md` §7 citaba un `CONTEXT.md` §13 que no existe (es §12) y PRD-0001 mandaba a `ARCHITECTURE.md` §3 por la tabla `leads`, que está en §6 |
| 24 ago 2026 | **Decisión: K-Pop pasa a ser de 11 años para arriba**, igual que el resto del catálogo. `publico` deja de decir "Todas las edades" y `EDAD_MINIMA` queda en 11 como constante global, coherente con que XO Teens sea el curso más chico. Se reescribe la descripción de XO Teens, que aludía a Kids, y los cursos de una profesora se resuelven con `getCursoActivo` para que un curso fuera de catálogo no reaparezca en su ficha ni en su perfil. Se sincronizan `CONTEXT.md` §2, §4, §5 y §5.b, `BRAND.md` §2 y la regla de copy de `.claude/rules/estilo.md`. En el camino se corrige una contradicción con ADR-0002: `CONTEXT.md` daba K-Pop por inscripción continua con mensualidad cuando el modelo híbrido lo dejó con packs, y seguía abierta una pregunta sobre Kids y Teens que se había resuelto el 21/08 |
| 22 ago 2026 | Se aplica en código la salida de XO Kids que ya estaba decidida en `CONTEXT.md` §4: `kids` queda `activa: false` en `lib/cursos.ts` y sale de los cursos de Drimy y Lina. No se borra: los leads históricos apuntan a ese id y `getCurso` los sigue resolviendo |
| 21 ago 2026 | **PRD-0003 implementado.** El descriptor pasa a "academia de baile", el CTA a "Reservar clase" y la captación se organiza por profesora en vez de por curso. Se retira entera la promesa de clase gratis. Cada profesora tiene perfil público en `/profesoras/[slug]`. La migración de `leads` queda escrita y **sin aplicar**, a la espera de revisión |
| 21 ago 2026 | Se cierran los parámetros del modelo: precios definitivos, créditos con vigencia de 60 días, cancelación hasta 30 min antes, verificación universitaria por certificado de alumno regular, créditos otorgables por admin/owner, y costos reales de sala ($17.000/$0) y profesora ($18.000/hora) |
| 21 ago 2026 | Sale XO Kids del catálogo (las alumnas migran a Teens). Se confirman **dos sedes**: Los Leones ($17.000) y Los Dominicos ($0), lo que baja el punto de equilibrio por clase de 8 alumnas a 3. Se resuelve el **modelo híbrido**: Teens con suscripción, Girly y K-Pop con packs. Se crea PRD-0011 |
| 21 ago 2026 | **Cambio de modelo de negocio:** de mensualidad a paquetes de clases con reserva por horario. Se replanifica el roadmap completo, se crean PRD-0003 a 0010 y ADR-0002 a 0004. PRD-0002 queda reemplazado |
| 21 ago 2026 | Incidente de producción resuelto: Supabase pausado y variables de entorno faltantes. Formulario verificado de punta a punta |
| ago 2026 | Se verifica el contexto contra el repo y producción; se resuelven conflictos de marca |
| ago 2026 | Decisión de ERP propio (ADR-0001). Se crea el sistema de contexto |
| jun 2026 | Documento estratégico v1.1 |
