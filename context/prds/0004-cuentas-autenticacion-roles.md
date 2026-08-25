# PRD-0004 — Cuentas, autenticación y roles

| Campo | Valor |
|---|---|
| **Estado** | Borrador |
| **Fecha** | 21 de agosto de 2026 |
| **Hito** | Hito 1 |
| **Relacionados** | PRD-0005 (compras) · PRD-0007/0008/0009/0010 (portales) · ADR-0006 (acceso) |

## 1. Problema

Para comprar clases y reservar horarios hace falta saber quién es cada persona. Hoy no existe
ningún concepto de usuario: la landing solo escribe leads.

## 2. Usuario

Mujer que llega desde Instagram, en el teléfono, sin ganas de llenar un registro largo. También
las profesoras y quienes administran, que entran desde computador.

## 3. Alcance

1. Login con **Google** o con **magic link por correo**, ambos vía Supabase Auth. **Sin
   contraseñas.** El magic link no es un extra de comodidad: Google exige 13 años para tener
   cuenta propia y la academia recibe desde los 11, así que sin él las alumnas de 11 y 12 no
   pueden entrar. Ver `decisions/0006-login-con-correo-ademas-de-google.md`.
2. Tabla `perfiles` ligada a `auth.users`, con `rol`.
3. Cuatro roles: `alumna`, `profesora`, `admin`, `owner`, con `owner` como superconjunto de
   `admin`.
4. Middleware de protección de rutas por grupo (`(cuenta)`, `(profesora)`, `(admin)`, `(owner)`).
5. Políticas RLS por rol en todas las tablas.
6. Completar perfil tras el primer login: teléfono, y si la alumna es menor de 18, datos del
   apoderado.
7. **Bloqueo de compra sin autorización confirmada del apoderado.** Un perfil menor de 18 puede
   entrar y mirar, pero no puede pagar hasta que se cumplan dos cosas: que registre nombre,
   teléfono y correo del apoderado, y que **el apoderado confirme** desde un enlace enviado a ese
   correo, con la misma infraestructura de magic link del punto 1. Lo que la menor declara no
   desbloquea nada por sí solo. Bloquea la compra, no el acceso.
8. Vincular el lead existente con la cuenta si coincide el teléfono o el email.

## 4. Fuera de alcance

- Login con **contraseña**, o con Instagram. Los dos métodos de la v1 son sin contraseña.
- Recuperación de contraseña: no existe, porque no hay contraseñas que recuperar.
- **Cuentas vinculadas o dependientes.** La cuenta es de la alumna; el apoderado son campos de
  su perfil, no otro perfil colgando. Descartado en ADR-0006 con su razón.
- Cambio de rol autoservicio: los roles los asigna admin.

## 5. Casos borde

- **Menor de edad. ✅ Resuelto en ADR-0006 (25/08/2026).** La academia recibe desde los 11 y
  K-Pop se vende con packs de reserva libre, así que una alumna de 11 a 15 necesita entrar y
  reservar por sí misma. Google exige 13, y de ahí el magic link por correo. **La cuenta es de
  la alumna**, con crédito y reservas suyos: no hay dependientes ni cuentas vinculadas.
  Lo que la mayoría de edad sí cambia es la compra: quien paga sigue siendo la mamá y los datos
  de una menor están bajo Ley 19.628 / 21.719, así que un perfil menor de 18 no puede comprar
  hasta registrar nombre, teléfono y correo del apoderado **y que el apoderado confirme la
  autorización desde un enlace enviado a ese correo**. Autodeclarada no sirve: la menor podría
  marcar la casilla sola y la mamá nunca se enteraría.
- Una persona con dos identidades distintas —dos cuentas de Google, o Google y magic link con
  otro correo— queda con dos perfiles. Debe poder fusionarlos un admin.
- Una profesora que además toma clases: necesita rol `profesora` y poder reservar como alumna.
- Primer `owner`: se asigna a mano en base de datos, no puede haber un flujo de autoservicio.

## 6. Reglas de negocio

1. Nadie se autoasigna un rol distinto de `alumna`.
2. Una profesora nunca ve información financiera.
3. Los datos de menores (nombre, fecha de nacimiento, observaciones) nunca aparecen en rutas
   públicas ni en logs. Ley 19.628 / 21.719.
4. `autoriza_uso_imagen` es opt-in explícito, `false` por defecto.

## 7. Criterios de aceptación

- [ ] Una persona nueva entra con Google en menos de tres toques y queda con rol `alumna`.
- [ ] Una alumna de 11 años, sin cuenta de Google, entra con magic link a su correo y queda con
      rol `alumna`.
- [ ] Un perfil menor de 18 no logra completar una compra —ni por interfaz ni por API directa—
      mientras el apoderado no haya confirmado, y se le explica qué falta.
- [ ] Declarar los datos del apoderado no desbloquea la compra por sí solo: hace falta el click
      en el enlace que llega a ese correo.
- [ ] Las rutas de cada portal rechazan a quien no tiene el rol.
- [ ] Un `owner` accede a todo lo de `admin` sin necesitar dos asignaciones.
- [ ] Ninguna consulta sin sesión devuelve datos de perfiles.
- [ ] Una alumna no puede leer el perfil de otra, ni por API directa.

## 8. Métrica de éxito

Que más del 80% de quienes empiezan el registro lo terminen. Si se cae mucha gente, el paso de
completar perfil está pidiendo demasiado.
