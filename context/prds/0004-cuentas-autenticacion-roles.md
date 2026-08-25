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

**`POST /api/roles`** con `{ perfilId, rol, motivo }`. Dos verificaciones, no una:

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

### El libro

`cambios_rol` guarda `perfil_id`, `rol_anterior`, `rol_nuevo`, `cambiado_por`, `motivo` y
`created_at`. Es la operación más sensible del sistema: quien cambia un rol cambia quién ve la
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

⚠️ **La migración está escrita pero no aplicada.** Queda en `supabase/migrations/` para revisión.

⚠️ **Falta configuración que no está en el código.** Sin esto compila pero no entra nadie:

1. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) en Vercel, **y redeploy sin caché**:
   las `NEXT_PUBLIC_*` se incrustan durante el build.
2. Habilitar Google como proveedor en el panel de Supabase.
3. Agregar las URLs de redirect: `https://xo-dance-studio.vercel.app/auth/callback` y
   `http://localhost:3000/auth/callback`.
