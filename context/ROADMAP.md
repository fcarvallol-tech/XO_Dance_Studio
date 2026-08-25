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
| 0.10 | Confirmar la nueva ubicación (sala de 45) | 🔴 Bloqueado — decisión |
| 0.11 | Dominio propio | ⚪ Pendiente |

**Criterio de salida:** el Open Day ocurre y hay alumnas inscritas, con o sin plataforma.

---

## Hito 1 — Cuentas y catálogo (base de todo lo demás)

| # | Entregable | PRD |
|---|---|---|
| 1.1 | Autenticación con Google y magic link, perfiles y roles | PRD-0004 |
| 1.2 | Catálogo en base de datos: sedes, salas, cursos, profesoras | — |
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

Es el corazón del producto. También lo más delicado: concurrencia por el cupo 45 y
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
