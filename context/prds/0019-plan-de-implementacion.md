# Plan de implementación — PRD-0019 Correo que no se pierde

> El PRD dice **qué** y **por qué**. Esto dice **en qué orden** y **cómo se sabe que cada paso
> quedó bien**. Se lee junto a `0019-correo-que-no-se-pierde.md`.
>
> **Se trabaja sobre `main`**, y no en una rama aparte: PRD-0018 ya se mergeó, no hay nada que
> aislar, y una migración sin aplicar no cambia el comportamiento de nada. Lo que sí se aísla es
> la **aplicación**: ninguna migración toca una base sin aprobación caso a caso.
>
> **Estado: en curso.** Las tres decisiones de la fase 0 las contestó Felipe el 22/09/2026 y la
> fase 1 está hecha. Lo que sigue depende de que **staging se despause**.

---

## Fase 0 — Tres decisiones, y una es grande ✅ cerrada el 22/09/2026

| # | Decisión | Estado |
|---|---|---|
| 1 | Cadencia del reintento | ✅ **Camino D: diario**, con el texto que no promete más. Vercel Pro y Supabase Pro se pagan antes de publicar la primera especial, no ahora. **Escrito para que subir de plan sea solo editar `vercel.json`** |
| 2 | Qué caduca y con qué | ✅ Tal cual la propuesta: el pendiente con `expira_at`, los comprobantes con el inicio de la clase |
| 3 | Qué ve la alumna si el correo no sale | ✅ El mensaje en gris, sin alarma (PRD §8.6) |

Lo que sigue es el razonamiento con que se decidió, que conviene no perder.

### 1. 🔴 El reintento no puede ser cada 5 minutos con lo que hay hoy

El PRD §8.4 propone reintentar a los 5 min, 30 min, 2 h, 12 h y 24 h. **Eso no se puede con la
infraestructura actual.** `vercel.json` tiene un solo cron, `/api/generar-clases`, **una vez al
día a las 06:00 UTC**. Un reintento "a los 5 minutos" agendado sobre un cron diario es, en la
práctica, un reintento al otro día.

Importa porque el correo que motivó este PRD lleva un plazo: si la alumna declara la
transferencia a las 20:00 y el envío falla, enterarse al otro día a las 3 de la mañana es tarde
para un cupo que se guarda 24 horas.

| Camino | Qué implica | Costo |
|---|---|---|
| **A. `pg_cron` cada 5 minutos** | Es SQL puro, sin HTTP y sin secreto que se filtre. Pero el envío lo hace Resend por HTTPS, así que la base tendría que llamar a la API: `pg_net`. Dos extensiones que confirmar | Confirmar disponibilidad en el plan de Supabase. Una consulta en el SQL Editor lo resuelve |
| **B. Vercel Cron más seguido** | Un `*/5 * * * *` sobre una ruta propia. Simple y en el mismo lenguaje que todo lo demás | Vercel **Hobby permite un cron diario**; varios por hora es plan de pago |
| **C. Reintento al vuelo** | La siguiente petición de cualquiera barre lo pendiente | Gratis, pero el reintento depende de que alguien visite el sitio, y de noche no visita nadie |
| **D. Aceptar el diario** | Un solo reintento al día, y **el texto no promete otra cosa** | Gratis. Cambia la promesa: el comprobante puede tardar un día |

**Propuesta: B si el plan lo permite, y si no, D con la promesa ajustada.** No A: meterle
`pg_net` a la base para llamar a una API externa es mucha maquinaria nueva para cuatro correos, y
mueve el envío a un lugar donde no se puede depurar con los logs que ya miramos.

Lo que **no** cambia con ninguna: el registro. Aunque el reintento sea diario, hoy el problema
mayor es que cuando falla **no queda ni a quién había que escribirle**.

### 2. Qué plantillas caducan, y con qué

§8.3: un aviso con plazo que llega tarde miente. Propuesta a confirmar:

| Plantilla | ¿Caduca? | Con qué |
|---|---|---|
| `avisarEspecialPendiente` | **Sí** | `reservas.expira_at`. Pasado eso, el cupo ya se soltó |
| `avisarReserva` (parrilla) | **Sí** | El inicio de la clase |
| `avisarEspecialConfirmada` | **Sí** | El inicio de la clase |
| `avisarCompraAprobada` | No | Las clases quedaron acreditadas y siguen ahí |
| `avisarCompraRechazada` | No | Sigue siendo cierto |
| `avisarTransferenciaDeclarada` (a la academia) | **Sí, a las 24 h** | Es un aviso operativo; a los tres días la bandeja ya lo muestra |

### 3. Qué ve la alumna cuando el correo no sale

Hoy la pantalla dice "listo" igual. Propuesta: la reserva se confirma en pantalla y debajo, en
gris, *"No pudimos mandarte el comprobante por correo. Tu cupo está igual de tomado y lo
reintentamos."* Sin alarma: la reserva **sí** quedó.

**Checkpoint:** ✅ las tres contestadas el 22/09/2026. Se eligió **D**, y con una condición que
cambia cómo se escribe el backoff: **que pasar a cada cinco minutos sea solo ajustar
`vercel.json`**. Por eso `proximoIntento` calcula una hora real y el barrido toma lo vencido, en
vez de contar pasadas del cron.

---

## El orden no es arbitrario

Este PRD toca el camino de la plata en su parte más delicada: las funciones que ya mueven
créditos y cupos. Por eso el orden es **primero lo que no puede romper nada** —funciones puras,
tabla nueva, escenario por SQL— y recién al final se cambia `lib/correo.ts`, que es lo único que
tocan las seis plantillas que hoy funcionan.

Y hay una regla que este PRD hereda entero: **la prueba tiene que poder fallar por lo mismo que
falla en producción**. Un test que simula el fallo de Resend no prueba nada; apagar la llave sí.

---

## Fase 1 — Las funciones puras, con sus tests primero

**Archivos:** `lib/dominio/envios.ts` · `lib/dominio/envios.test.ts`

**✅ Hecha el 22/09/2026.** `npm test` 113/113, 26 de este módulo, con el test escrito antes que
el código: el corredor falló primero por módulo inexistente.

| Función | Qué resuelve |
|---|---|
| `proximoIntento(intentos, ahora)` | El backoff de la decisión 1, **en tiempo real**: envío inicial más 5 reintentos a 5 min, 30 min, 2 h, 12 h y 24 h, y `null` cuando se agotaron |
| `caduco(envio, ahora)` | Si el aviso ya no es cierto (decisión 2). Es la regla que evita mandar una promesa vencida |
| `debeReintentar(envio, ahora)` | `fallido` o `pendiente` viejo, con `proximo_intento_at` pasado y sin caducar |
| `claveDeEvento(tipo, id)` | `reserva:<uuid>`, `compra-aprobada:<uuid>`. Dos veces el mismo hecho, un solo correo |
| `aPurgar(envio, ahora)` | `enviado` con más de 30 días: se le borra el contenido, no la fila |
| `esCorreoReal(direccion)` | `.invalid` y vacío no se intentan: nacen `descartado` con motivo |

**Checkpoint:** ✅ 113/113. Los bordes que quedaron cubiertos: un envío que vence exactamente
ahora (no se manda) y otro que vence en un segundo (sí), uno caducado **y** fallido a la vez
—gana caducado y se descarta—, los reintentos agotados devolviendo `null` en vez de una fecha
lejana, un `pendiente` colgado hace una hora que se trata como fallido y otro de hace un minuto
que se deja en paz, y una fila ya purgada que no se vuelve a purgar.

---

## Fase 2 — La migración

**Archivo:** `supabase/migrations/20260922120000_envios_correo.sql` · **escrita el 22/09/2026,
sin aplicar.**

0. ✅ Staging despausado, CLI enlazada y **ref verificado** (`ybopuahlzbjkkwumkllk`) antes de
   cualquier comando.
1. Tabla `envios_correo` de §7, con su índice parcial por `proximo_intento_at`.
2. **RLS desde el primer día**: sin política para `anon` ni `authenticated`; lectura solo
   `tiene_nivel('admin')`; escritura solo `service_role`. Es la tabla que guarda correos, nombres
   y el cuerpo de avisos de menores.
3. Funciones con su `revoke ... from public, anon` y su `grant execute ... to service_role`
   **escritos**, no heredados del default: `encolar_correo`, `marcar_enviado`, `marcar_fallido`,
   `descartar_envio`, `purgar_envios_viejos`.
4. `reintentar_envio(id, actor)` para el botón de admin: valida rol adentro, como todo lo demás.

Dos decisiones que se tomaron al escribirla y conviene no perder:

- **`destinatario` es nullable**, y un check exige que solo pueda estar vacío si hay `purgado_at`.
  La purga de los 30 días tiene que poder vaciar el contenido sin borrar la fila, y un `not null`
  lo habría impedido; dejarlo nullable a secas habría permitido filas rotas por otra razón.
- **El backoff y la caducidad no se recalculan en SQL.** Las funciones reciben el
  `proximo_intento_at` y el `caduca_at` que ya decidió `lib/dominio/envios.ts`. Tener la misma
  regla en dos lenguajes es tener dos versiones de la misma decisión, y la de allá tiene tests.
  Por lo mismo `envios_por_intentar` **filtra ancho**: trae candidatos y quién se reintenta de
  verdad lo decide `debeReintentar()`.

**Checkpoint:** ✅ `db push --dry-run` contra staging muestra **solo** `20260922120000_envios_correo.sql`.
⏸ El push **espera aprobación de Felipe dicha para esta migración**. Después: `GET
/rest/v1/envios_correo` con la llave publishable tiene que responder vacío o error, nunca datos.

---

## Fase 3 — Escenario por SQL, en transacciones revertidas

**Archivo:** `scripts/escenario-envios.mjs`, con la forma que ya funcionó en PRD-0018. **Escrito
y corrido el 22/09/2026 contra staging, con la migración aplicada: 11 de 12.**

El ✗ que queda es un **defecto encontrado por el escenario**, y vale contarlo porque es la tercera
vez que pasa lo mismo en este proyecto: `20260922120000` escribió
`grant select ... to authenticated` y **se olvidó del rol del servidor**. Verificado por REST:
`compras`, `reservas` y `clases` responden 200 a `service_role`; `envios_correo`, 403.

Ya había pasado con `perfiles` y con `parametros` (PRD-0017 §16). Lo que lo hace escurridizo es
siempre lo mismo: **no se nota**, porque las funciones son `security definer` y corren como su
dueño. Lo que falla es la primera lectura directa que alguien escriba desde el servidor, meses
después, con un error de permisos que no se parece en nada a su causa.

Por eso el caso "quién puede leer la tabla" prueba **los cuatro roles de una vez**: es una línea
que convierte un descuido recurrente en algo que se cae en la corrida. Corregido en
`20260922130000_envios_correo_grant_service_role.sql`, archivo nuevo porque la anterior ya corrió
—`supabase/README.md`—, y ese archivo **espera aprobación**.

| Caso | Esperado |
|---|---|
| `encolar_correo` dos veces con la misma clave | Una sola fila |
| `marcar_fallido` | `intentos + 1`, error guardado, `proximo_intento_at` según el backoff |
| Agotar los intentos | Queda `fallido` y **no** se vuelve a tomar |
| Un envío caducado que tocaba reintentar | `descartado` con motivo, sin intentarse |
| `purgar_envios_viejos` | El `enviado` viejo conserva la fila y pierde `datos` y `destinatario` |
| Un `pendiente` de hace una hora | Se trata como fallido: el proceso murió entre el insert y el envío |
| El botón de reintentar | Admin sí, alumna 42501; un descartado no se reintenta |
| **Quién puede leer la tabla** | `anon` no · una alumna con sesión, 0 filas · admin ve · **service_role ve** |

---

## Fase 4 — `lib/correo.ts` registra antes de enviar

Las **seis** plantillas pasan por el mismo camino: `avisarTransferenciaDeclarada`,
`avisarCompraAprobada`, `avisarCompraRechazada`, `avisarReserva`, `avisarEspecialPendiente`,
`avisarEspecialConfirmada`.

- `enviar()` pasa a: encolar → intentar → marcar. Devuelve si salió, **y ahora alguien lo mira**.
- Las acciones de `lib/acciones.ts` devuelven `correoEnviado: boolean` junto con `ok`.
- ⚠️ **El correo sigue fuera de la transacción de plata.** Si encolar falla, la reserva vale
  igual. Esa regla no se toca: es la mitad que sí funcionaba.

**Checkpoint:** con `RESEND_API_KEY` inválida, reservar por la interfaz deja la reserva hecha y
una fila `fallido` con el error de Resend.

---

## Fase 5 — El reintento y la purga

Depende de la decisión 1. En el camino B: ruta nueva `/api/correos`, su entrada en `vercel.json`,
mismo patrón de secreto en cabecera que las otras dos.

- El barrido toma los que `debeReintentar`, descarta los caducados y reintenta el resto.
- La purga corre en la misma pasada.
- **Su fallo no tumba nada más**, igual que el barrido de reservas de PRD-0018.

---

## Fase 6 — Que los fallidos se vean

**Archivos:** `app/(admin)/admin/correos/page.tsx` · `components/BandejaCorreos.tsx`

Destinatario, plantilla, intentos, último error, y botón **Reintentar ahora**. Los `descartado`
por caducidad van en su propia lista: ahí no hay que reintentar, hay que hablarle a esa persona
por otro lado.

El enlace en el menú de administración muestra **cuántos hay fallidos**, porque una sección que
hay que acordarse de visitar es una sección que no se visita.

---

## Fase 7 — Verificación con el artefacto real

Lo demás de este plan se prueba con datos. Esto no:

1. Con la llave inválida, reservar **desde el navegador**: la reserva queda, la pantalla lo dice,
   y hay una fila `fallido`.
2. Restaurar la llave y disparar el barrido: el correo **llega a un buzón de verdad y se abre**.
3. ⚠️ **Hace falta un correo real.** Las cuentas del escenario son `@ejemplo.invalid` y el código
   no les escribe, así que esta fase necesita una cuenta de Felipe o de Carla en staging. Es la
   única forma de probar que llega, que es justo lo que este PRD promete.
4. Un envío con plazo vencido: se descarta y aparece en admin, sin mandarse.

Se extiende `scripts/verificar-fase6.mjs` o se escribe su hermano, con Chromium de verdad.

---

## Fase 8 — Producción

1. `npm run build` y `npm test` en verde.
2. `cat supabase/.temp/project-ref` dice producción. `db push --dry-run` muestra solo esta.
3. **`db push` con aprobación de Felipe en ese mismo mensaje.**
4. Dejar la CLI de vuelta en staging.
5. Recién ahí, **publicar la primera clase especial**: es lo que este PRD venía a desbloquear.

---

## Resumen de fases

| Fase | Estado |
|---|---|
| 0 — Tres decisiones | ✅ **Cerrada el 22/09/2026.** Reintento diario (camino D), escrito para que subir de plan sea solo `vercel.json` |
| 1 — Funciones puras y tests | ✅ **Hecha el 22/09/2026**: 6 funciones, 26 tests, `npm test` 113/113 |
| 2 — Migración | ✅ **Aplicada a staging el 22/09/2026** con aprobación. ⏸ Le falta el grant a `service_role`, en `20260922130000` |
| 3 — Escenario por SQL | ✅ **11/12 el 22/09/2026.** El ✗ es el grant a `service_role` que faltaba, corregido en una migración nueva que espera aprobación |
| 4 — `lib/correo.ts` | Depende de la 2 |
| 5 — Reintento y purga | Depende de la decisión 1 |
| 6 — Visibilidad en admin | Depende de la 4 |
| 7 — Verificación real | Depende de todo, y de un buzón de verdad |
| 8 — Producción | Desbloquea publicar la primera especial |
