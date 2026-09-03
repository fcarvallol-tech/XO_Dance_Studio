# PRD-0004 — Cuentas, autenticación y roles

| Campo | Valor |
|---|---|
| **Estado** | **Implementado con recorte de alcance** (25/08/2026). Migración escrita, **sin aplicar** |
| **Fecha** | 21 de agosto de 2026 · recortado el 25/08/2026 |
| **Hito** | Hito 1 |
| **Relacionados** | PRD-0005 (compras) · PRD-0007/0008/0009/0010 (portales) · ADR-0006 (acceso) |

## 1. Problema

Para comprar clases y reservar horarios hace falta saber quién es cada persona. Hoy no existe
ningún concepto de usuario: la landing solo escribe leads.

## 2. Usuario

Mujer que llega desde Instagram, en el teléfono, sin ganas de llenar un registro largo. También
las profesoras y quienes administran, que entran desde computador.

## 3. Alcance

1. ✅ Login con **Google** o con **magic link por correo**, ambos vía Supabase Auth. **Sin
   contraseñas.** El magic link no es un extra de comodidad: Google exige 13 años para tener
   cuenta propia y la academia recibe antes, así que sin él las alumnas más chicas no pueden
   entrar. Ver `decisions/0006-login-con-correo-ademas-de-google.md`.
2. ✅ Tabla `perfiles` ligada a `auth.users`, con `rol`. La crea un trigger, nunca el cliente.
3. ✅ Cuatro roles: `alumna`, `profesora`, `admin`, `owner`, con `owner` como superconjunto de
   `admin`, implementado como jerarquía aritmética.
4. ✅ Protección de rutas por grupo (`(cuenta)`, `(profesora)`, `(admin)`, `(owner)`).
5. ✅ Políticas RLS explícitas por rol en `perfiles`, `cambios_rol` y `leads`.
6. ✅ Completar perfil tras el primer login: nombre y teléfono.
7. ✅ **Cambio de rol por ruta de servidor**, con registro de quién cambió qué y cuándo. Ver §8.
8. ⏳ Vincular el lead existente con la cuenta si coincide el teléfono o el email. **No entra en
   esta pasada:** arrastra columnas nuevas en `leads` y no bloquea nada.

## 4. Fuera de alcance

- Login con **contraseña**, o con Instagram. Los dos métodos de la v1 son sin contraseña.
- Recuperación de contraseña: no existe, porque no hay contraseñas que recuperar.
- **Cuentas vinculadas o dependientes.** La cuenta es de la alumna; el apoderado son campos de
  su perfil, no otro perfil colgando. Descartado en ADR-0006 con su razón.
- Cambio de rol autoservicio: los roles los asigna admin, desde la ruta de §8.
- **Todo lo relativo a menores de edad.** Ver §9.

## 5. Casos borde

- **Menor de edad.** ⏳ Fuera de alcance en esta pasada. Ver §9.
- **Una persona que entra por los dos caminos.** ✅ **Verificado el 25/08/2026 contra la
  documentación de Supabase, no supuesto:** *"Supabase Auth automatically links identities with
  the same email address to a single user"*. Entrar con Google y después con magic link **al
  mismo correo** da un solo `auth.users` y por lo tanto un solo perfil.
  La condición es que el correo de la cuenta existente esté **verificado**; enlazar contra uno
  sin verificar habilitaría un *pre-account takeover*, y por eso Supabase no lo hace.
  Esto corrige lo que este PRD afirmaba antes y cierra el ⚠️ que ADR-0006 dejó abierto.
  **Lo que sí produce dos perfiles son dos correos distintos**, y ahí ninguna configuración
  ayuda: eso necesita fusión desde admin, que todavía no existe.
- **Una profesora que además toma clases:** su rol es `profesora`, que por jerarquía incluye
  todo lo de `alumna`. No hacen falta dos roles.
- **Primer `owner`:** se asigna a mano en base de datos. Ver §8.

## 6. Reglas de negocio

1. Nadie se autoasigna un rol distinto de `alumna`.
2. Una profesora nunca ve información financiera.
3. Los datos de menores (nombre, fecha de nacimiento, observaciones) nunca aparecen en rutas
   públicas ni en logs. Ley 19.628 / 21.719.
4. `autoriza_uso_imagen` es opt-in explícito, `false` por defecto.

## 7. Criterios de aceptación

- [x] Una persona nueva entra con Google en menos de tres toques y queda con rol `alumna`.
- [x] Una alumna sin cuenta de Google entra con magic link a su correo y queda con rol `alumna`.
- [x] Las rutas de cada portal rechazan a quien no tiene el rol.
- [x] Un `owner` accede a todo lo de `admin` sin necesitar dos asignaciones.
- [x] Ninguna consulta sin sesión devuelve datos de perfiles.
- [x] Una alumna no puede leer el perfil de otra, ni por API directa.
- [x] Nadie puede cambiar su propio rol, ni asignar uno superior al suyo.
- [x] Todo cambio de rol queda registrado con autor, roles y fecha.
- [x] La academia no puede quedarse sin `owner`.
- [x] Nadie queda con rol `profesora` sin estar amarrada a una profesora del catálogo, ni por la
      interfaz, ni por la API, ni por un `update` a mano en la base.
- [x] Al salir del rol `profesora`, el `profesora_id` se limpia.

## 8. Roles: cómo se cambian y cómo se asigna el primero

### Por qué hace falta una ruta de servidor

La columna `rol` **no es actualizable por `authenticated`**, y eso incluye a admin y owner:

```sql
grant update (nombre, telefono, avatar_url, autoriza_uso_imagen, fecha_nacimiento, perfil_completo_at)
  on public.perfiles to authenticated;
```

`rol` no está en esa lista, así que la regla 1 de §6 no depende de que una política RLS esté bien
escrita: el permiso **no existe** a nivel de Postgres. Quien puede tocar esa columna es la service
role key, que vive solo en el servidor.

### El camino

**`POST /api/roles`** con `{ perfilId, rol, motivo, profesoraId }`. Dos verificaciones, no una:

1. **La ruta** comprueba sesión y nivel de quien llama, para responder algo entendible y no
   exponerle la base a alguien sin sesión. A quien no es admin le responde **404, no 403**: quien
   no tiene el rol no tiene por qué enterarse de que la ruta existe.
2. **`public.cambiar_rol`** vuelve a validar todo dentro de la base. Es la única capa que resiste
   a alguien con la service role key en la mano, y hace el cambio **y su registro en la misma
   transacción**: no puede quedar un rol cambiado sin línea en el libro.

Las reglas, todas en SQL:

| Regla | Por qué |
|---|---|
| Solo `admin` o superior | Regla 1 de §6 |
| Nadie cambia su propio rol | Ni para subirse ni para dejarse fuera por error |
| Nadie asigna por encima de su nivel | Un admin no puede fabricar un owner |
| Nadie degrada a quien está más arriba | Un admin no puede sacar a la dueña |
| Nunca cero owners | Sin owner no hay cómo repartir roles salvo entrando a la base |
| `profesora` exige `profesora_id` | Ver abajo |

### El rol de profesora viaja con su identidad

Promover a alguien a `profesora` sin decir **cuál** de las del catálogo es la dejaba con
`profesora_id` en `null`: entraba al portal y no veía ninguna clase, porque el sistema no tenía
cómo saber de quién eran. El rol y la identidad viajan juntos o no viajan.

Tres capas, otra vez, cada una tapando lo que la anterior no puede:

1. **Check de tabla.** `perfiles_profesora_con_identidad`:
   `check (rol <> 'profesora' or profesora_id is not null)`. Es lo único que resiste un `update`
   escrito a mano en el SQL Editor, que es exactamente como se asigna el primer owner.
2. **`cambiar_rol`** exige `p_profesora_id` cuando el rol nuevo es `profesora`, y **lo limpia al
   salir del rol**: un slug colgando de alguien que ya no hace clases es un dato que después nadie
   sabe interpretar. El libro guarda a qué profesora quedó amarrada en cada cambio.
3. **La ruta de servidor** valida que el slug exista, contra `PROFESORAS_ACTIVAS` de
   `lib/profesoras.ts`. Esta capa está solo porque **todavía no hay llave foránea**: mientras el
   catálogo viva en `/lib` no hay tabla contra la cual comprobarlo desde la base. Se exige
   **activa**, con el mismo criterio que usa el formulario de leads — a una profesora que ya no
   hace clases no se le asigna a nadie nuevo, aunque los perfiles antiguos conserven su slug.
   Cuando el catálogo migre a base de datos, esta validación se cae sola y la reemplaza la FK.
   Ver `ARCHITECTURE.md` §10.

⚠️ Consecuencia para el primer owner: si alguna vez se asigna un rol a mano, un
`update ... set rol = 'profesora'` **sin `profesora_id` falla**, y falla a propósito.

### El libro

`cambios_rol` guarda `perfil_id`, `rol_anterior`, `rol_nuevo`, `cambiado_por`, `motivo`,
`profesora_id` y `created_at`. Es la operación más sensible del sistema: quien cambia un rol cambia quién ve la
plata.

**Solo se agrega.** No tiene `deleted_at` —excepción deliberada a la convención de
`ARCHITECTURE.md` §5, porque un libro no se borra ni lógicamente— y la migración hace
`revoke update, delete ... from service_role`. La service role key salta RLS, pero **no salta los
grants**, así que el append-only es real y no una promesa.

### El primer owner

No hay flujo de autoservicio y no puede haberlo: el primero se asigna a mano. Después de entrar
por primera vez a la web con el correo real, en el **SQL Editor de Supabase**:

```sql
update public.perfiles
set rol = 'owner'
where email = 'correo@dominio.cl';
```

Conviene confirmar que tocó una sola fila:

```sql
select id, email, rol from public.perfiles where email = 'correo@dominio.cl';
```

Es el único cambio de rol que **no** queda en `cambios_rol`, porque todavía no existe nadie que
pueda figurar como autor. De ahí en adelante todo pasa por `POST /api/roles`.

## 9. ⏳ Pendiente: todo lo de menores de edad

**Recortado del alcance el 25/08/2026, a pedido de Felipe.** No implementado ni simulado:

- Datos del apoderado en el perfil (nombre, teléfono, correo).
- Autorización explícita del apoderado.
- Confirmación por correo al apoderado, con enlace, reutilizando la infraestructura de magic link.
- Bloqueo de compra mientras esa confirmación no exista.

**Por qué se posterga, y por qué no es solo posponer:** la academia va a incorporar **XO Mini**,
un curso para niñas pequeñas, y su rango etario está **sin definir**. ADR-0006 razonó entero sobre
un piso de 11 años —de ahí salía que el magic link bastaba, porque Google exige 13 y la brecha
eran dos años—. Con XO Mini ese supuesto se cae: una niña de 6 no va a manejar un correo propio,
y ahí la pregunta "¿la cuenta es de la alumna o de la mamá?" **se reabre**, que es justamente la
que ADR-0006 dio por cerrada al descartar los dependientes.

Lo que hay que resolver antes de construir esta parte:

1. El rango etario de XO Mini.
2. Si por debajo de cierta edad la cuenta la abre y opera la mamá, lo que reabriría la Opción C
   descartada en ADR-0006.
3. Si el corte de "menor" para efectos de compra son los 18, o si hay dos umbrales: uno para
   quién puede tener cuenta y otro para quién puede pagar.

Cuando estén esas tres respuestas, lo más probable es que corresponda un **ADR nuevo que revise
ADR-0006**, no solo un PRD. El esquema de `perfiles` ya tiene `fecha_nacimiento` como columna,
pero **no se pide ni se usa**: recolectar la fecha de nacimiento de una menor antes de necesitarla
es juntar dato personal por si acaso.

## 10. Métrica de éxito

Que más del 80% de quienes empiezan el registro lo terminen. Si se cae mucha gente, el paso de
completar perfil está pidiendo demasiado.

## 11. Cómo quedó implementado

| Pieza | Dónde |
|---|---|
| Esquema, RLS, funciones y libro | `supabase/migrations/20260825120000_perfiles_roles_y_rls.sql` |
| Jerarquía de roles (espejo del SQL) | `lib/roles.ts` |
| Sesión y guardas | `lib/sesion.ts` — `perfilActual`, `requiereSesion`, `requiereNivel` |
| Clientes de Supabase | `lib/supabase/` — `navegador`, `servidor`, `admin`, `config` |
| Refresco de token y chequeo optimista | `proxy.ts` |
| Entrada | `app/entrar/`, `components/FormularioEntrar.tsx` |
| Callback y magic link | `app/auth/callback/`, `app/auth/confirmar/`, `app/auth/salir/` |
| Portales | `app/(cuenta)/`, `app/(profesora)/`, `app/(admin)/`, `app/(owner)/` |
| Marco visual de los portales | `components/Portal.tsx` |
| Cambio de rol | `app/api/roles/route.ts`, `components/CambiarRol.tsx` |

Decisiones tomadas al implementar:

- **Tres capas de protección, no una.** La documentación de Next 16 es explícita en que el proxy
  *"should not be used as a full session management or authorization solution"*: corre en cada
  ruta, incluidas las prefetcheadas. Así que el proxy solo refresca el token y hace un chequeo
  optimista leyendo la cookie; la autorización real vive en el `layout.tsx` de cada grupo, con
  `getClaims()` —nunca `getSession()`, que Supabase advierte no usar en el servidor—; y RLS es la
  última línea, la única que resiste una llamada directa a la API.
- **En Next 16 el archivo es `proxy.ts`, no `middleware.ts`.** El convenio se renombró.
- **`mi_rol()` es `security definer`** a propósito: una política sobre `perfiles` que consulte
  `perfiles` entra en recursión infinita. Es el footgun clásico de RLS en Supabase.
- **Los portales van en claro y la pantalla de entrar en negro.** `BRAND.md` §8 pide modo claro
  para el ERP; `/entrar` es la puerta desde la landing, así que se queda en negro. Ojo con el rosa
  en los portales: sobre fondo claro da 1.7:1 y solo sirve como fondo de botón o borde.
- **Las rutas con sesión son `force-dynamic` declarado**, no deducido del uso de `cookies()`. Sin
  eso el build intenta prerenderizar una página que depende de quién la pide, y se cae.
- **La lectura de `perfiles` y `leads` en las páginas de admin va con la sesión de quien mira**,
  no con la service role key. Si una política estuviera mal, la tabla sale vacía en vez de filtrar
  datos.
- **La landing no se movió a `(publico)`** aunque la estructura objetivo de `ARCHITECTURE.md` §3
  lo contemple: es un refactor de rutas que ya funcionan y no tiene por qué viajar en el mismo
  diff que la autenticación.

⚠️ **La migración ya está aplicada en Supabase** (verificado el 25/08/2026). El `grant select` para
`service_role` que se agregó ese día **no toma efecto hasta volver a aplicarla**. Ver §12.

⚠️ **Falta configuración que no está en el código.** Sin esto compila pero no entra nadie:

1. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) en Vercel, **y redeploy sin caché**:
   las `NEXT_PUBLIC_*` se incrustan durante el build.
2. Habilitar Google como proveedor en el panel de Supabase.
3. Agregar las URLs de redirect: `https://xo-dance-studio.vercel.app/auth/callback` y
   `http://localhost:3000/auth/callback`.

## 12. Nota de implementación — el bucle de redirección del 25/08/2026

**Síntoma:** `ERR_TOO_MANY_REDIRECTS` justo después de aceptar en la pantalla de Google. Pasaba
también en incógnito, así que no era estado sucio de cookies.

**Lo que NO era:** el proxy. `proxy.ts` nunca cubrió `/entrar` ni `/auth/*`, y sin sesión la
cadena era correcta (`/entrar` → 200, las privadas → `/entrar?volver=…`). El bucle tampoco tenía
que ver con Google: se disparaba con cualquier método de entrada.

**La causa.** `app/(cuenta)/layout.tsx` llamaba a `requiereSesion()` **sin argumento**, y la
guarda contra el bucle era esta:

```ts
if (!perfil.perfilCompleto && rutaActual !== "/completar-perfil") {
  redirect("/completar-perfil");
}
```

La guarda existía y era correcta, pero **dependía de un parámetro que el layout no pasaba**. Con
`rutaActual` en `undefined` la comparación siempre daba verdadero. Y como `/completar-perfil`
vivía dentro del grupo `(cuenta)`, redirigir ahí volvía a ejecutar ese mismo layout:

```
/mi-perfil        307 -> /completar-perfil
/completar-perfil 307 -> /completar-perfil
/completar-perfil 307 -> /completar-perfil   … hasta que el navegador corta
```

La página sí pasaba la ruta (`requiereSesion("/completar-perfil")`), pero daba igual: el layout
corre antes y su `redirect()` corta el render.

Se disparaba justo después de Google porque una cuenta recién creada tiene `perfil_completo_at`
en `null`. Por eso pasaba también en incógnito: no era estado sucio, era **un usuario nuevo**.

### Por qué se movió la ruta en vez de pasar el pathname

La opción obvia era hacer que el layout pasara su ruta. En App Router un layout **no tiene acceso
al pathname**, así que habría que leerlo en el proxy y reenviarlo como header, y que cada layout
se acordara de pasarlo. Eso deja el sistema en el mismo lugar donde estaba: **correcto solo
mientras nadie olvide un argumento**, que es exactamente cómo se produjo este bug.

Se eligió cambiar la topología: **`/completar-perfil` salió de `(cuenta)` y vive en la raíz**.
Ahora ningún layout de grupo corre sobre ella, así que redirigir hacia ahí no puede reejecutar al
que redirigió. El bucle no está mitigado, es **inalcanzable**.

Como la página ya no hereda el layout del grupo, renderiza `<Portal>` ella misma y usa
`requiereSesionSinCompletar()`, que exige sesión pero no perfil completo — es la única página que
por definición se ve con el perfil a medias.

### La red, para que no vuelva a pasar en otro grupo

Los otros tres layouts tenían el mismo defecto latente. `lib/rutas.ts` declara ahora qué rutas
cubre cada grupo, los cuatro layouts pasan el suyo, y antes de redirigir el guard comprueba que el
destino no caiga bajo el layout que lo está ejecutando. Si cae, manda a la landing y deja un
`console.error` explicando qué mover. Hoy ninguna combinación llega ahí; es para el día en que
alguien mueva una ruta de vuelta adentro.

De paso, `proxy.ts` dejó de tener su propia copia de la lista de rutas privadas: la importa de
`lib/rutas.ts`, para que no pueda desincronizarse de los guards.

### Un segundo defecto, encontrado de paso

`service_role` no tenía **ningún grant sobre `perfiles`**. Postgres lo decía textual:
`42501 permission denied for table perfiles`. La migración hacía `revoke all … from anon,
authenticated` y otorgaba a `authenticated`, pero nunca a `service_role` — en los proyectos nuevos
de Supabase los privilegios por defecto ya no alcanzan a los roles del Data API, algo que la
migración de `leads` sí había tenido en cuenta.

No causaba el bucle y arreglarlo no lo resolvía: `cambiar_rol` y el trigger de alta son
`security definer`, así que corrían igual. Pero cualquier lectura futura de `perfiles` con el
cliente admin habría fallado con un 403 poco obvio. Se agregó `grant select` —solo lectura: las
escrituras siguen pasando por funciones `security definer`.

### Verificación

Reproducido y vuelto a verificar contra el servidor de desarrollo, con un usuario desechable
creado por la admin API y un enlace generado con `generateLink`, que **no envía correo**. El
usuario se borró al terminar.

| Paso | Antes | Después |
|---|---|---|
| `/auth/confirmar` | 307 → `/mi-perfil` | 307 → `/mi-perfil` |
| `/mi-perfil` (perfil incompleto) | 307 → `/completar-perfil` | 307 → `/completar-perfil` |
| `/completar-perfil` | **307 → `/completar-perfil`, sin fin** | **200** |
| `/mi-perfil` (perfil completo) | — | 200 |
| `/admin`, `/profesora/…`, `/owner/…` como alumna | — | 307 → `/mi-perfil`, que responde 200 |

También se comprobó, con la llave publishable y la sesión de la propia alumna, que el `update` que
hace el server action de `/completar-perfil` funciona, y que un intento de autoascenso a `owner`
en la misma tabla se rechaza con `42501`. Los grants por columna hacen su trabajo.

⚠️ **La migración ya está aplicada en Supabase**, contra lo que decía §11: se verificó que
`cambios_rol.profesora_id` y la firma de cinco argumentos de `cambiar_rol` están en la base. El
`grant select` nuevo **no toma efecto hasta volver a aplicarla**.

## 13. El magic link roto desde el principio (03/09/2026)

**Estuvo roto desde que se implementó este PRD y nadie lo notó hasta hoy**, porque el correo antes
ni siquiera llegaba: el SMTP de Supabase respondía `429 over_email_send_rate_limit`. Al configurar
Resend el correo empezó a salir, y recién ahí se vio que el enlace llevaba a
*"ese enlace ya no sirve"*.

### La causa: el enlace nunca traía lo que la ruta espera

El template del correo usa `{{ .ConfirmationURL }}`, el valor por defecto, que apunta al
verificador de Supabase y no al sitio:

```
https://<proyecto>.supabase.co/auth/v1/verify
  ?token=…&type=magiclink&redirect_to=https://xodancestudio.cl/auth/confirmar
```

Al abrirlo, Supabase **consume el token** y redirige:

```
303 → https://xodancestudio.cl/auth/confirmar?volver=…#access_token=eyJ…
```

`/auth/confirmar` leía `token_hash` de la query. No venía, así que redirigía a
`/entrar?error=enlace`, cuyo texto era *"Ese enlace ya no sirve: vencen y se usan una sola vez"*.
**Ese mensaje era nuestro, no de Supabase.** El enlace no había expirado: nunca se llegó a leer.

Y hay un segundo muro: la sesión volvía en el **fragmento** (`#access_token=…`), que el navegador
**nunca envía al servidor**. Una Route Handler no puede verlo aunque quiera.

### Lo que NO era

- **No era que algo pre-abriera el enlace.** Lo consumía el propio recorrido, en
  `/auth/v1/verify`. Verificado: el mismo token después responde
  *"Email link is invalid or has expired"*, y uno nuevo sin abrir funciona.
- **No era el proxy.** `/auth/confirmar` no está en `RUTAS_CON_SESION`, así que no lo toca.
- **No fue el cambio de SMTP.** El formato lo define el *template*, no el proveedor. Cambiar a
  Resend solo hizo visible un bug que ya estaba.

### El arreglo, en dos partes

**A · El template del correo** pasa a apuntar directo a la ruta con el token. Es **configuración
del panel**, no código, y es la única forma que funciona **entre dispositivos**.

**B · `/auth/confirmar` acepta las dos formas de llegar**: `?token_hash=…&type=…` (camino A) y
`?code=…` (PKCE, que es el flujo por defecto de `createBrowserClient` y solo sirve en el mismo
navegador que pidió el enlace).

Y cuando no llega ninguna, **deja de mentir**: antes decía que el enlace había expirado; ahora
distingue tres casos con mensajes distintos —enlace usado, abierto en otro navegador, y problema
de configuración nuestro—, y este último no manda a pedir otro enlace, porque chocaría con lo
mismo.

### Qué cambiar en el panel de Supabase (parte A)

1. **Authentication → Emails → Templates → Magic Link.**
2. Reemplazar el cuerpo por un enlace que apunte al sitio con el token:

   ```html
   <h2>Entra a XO Dance Studio</h2>
   <p>Toca el botón y quedas dentro. Sirve una sola vez.</p>
   <p>
     <a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=magiclink">
       Entrar a XO
     </a>
   </p>
   ```

   La clave es usar **`{{ .TokenHash }}`** y no `{{ .ConfirmationURL }}`.
3. **Authentication → URL Configuration:** que **Site URL** sea `https://xodancestudio.cl`, porque
   `{{ .SiteURL }}` sale de ahí. Y que `https://xodancestudio.cl/**` esté en **Redirect URLs**.
4. Conviene hacer lo mismo en el template de **Confirm signup**, que tiene el mismo problema.

Mientras el template no se cambie, quien abra el correo **en otro dispositivo** va a seguir sin
poder entrar, aunque el resto ya esté arreglado.

### Criterio de aceptación nuevo

- [ ] **Pedir el enlace en un dispositivo y abrirlo en otro funciona.** Pedirlo en el computador y
      abrirlo en el teléfono es lo que van a hacer las alumnas, no un caso borde. Es lo único que
      distingue el camino A del B, y la razón por la que A no es opcional.
- [x] El enlace real del correo abre sesión y deja entrar, verificado de punta a punta contra un
      servidor corriendo — no llamando `verifyOtp()` por el SDK.
- [x] El mismo enlace usado dos veces falla, y dice que es de un solo uso.
- [x] Un enlace sin token no dice "expiró": dice que hay un problema de configuración.

### Verificación de punta a punta

Contra un servidor real, abriendo la URL exacta que produce el template nuevo. El cliente que
abrió el enlace **no compartía ningún estado** con quien lo pidió, que es justamente la prueba
entre dispositivos:

```
CAMINO A
  GET /auth/confirmar?token_hash=f584be2bc31e…&type=magiclink
  HTTP 307 -> /mis-clases          · Set-Cookie de sesion: SI
  GET /mis-clases con esa cookie   · HTTP 307 -> /completar-perfil  (entró; le falta el perfil)

EL MISMO ENLACE, SEGUNDA VEZ
  HTTP 307 -> /entrar?error=enlace

SIN TOKEN NI CODE  (el caso que antes mentía)
  HTTP 307 -> /entrar?error=configuracion

CON UN CODE INVÁLIDO  (PKCE abierto en otro navegador)
  HTTP 307 -> /entrar?error=otro-navegador
```
