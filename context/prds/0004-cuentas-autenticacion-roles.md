# PRD-0004 — Cuentas, autenticación y roles

| Campo | Valor |
|---|---|
| **Estado** | Borrador |
| **Fecha** | 21 de agosto de 2026 |
| **Hito** | Hito 1 |
| **Relacionados** | PRD-0005 (compras) · PRD-0007/0008/0009/0010 (portales) |

## 1. Problema

Para comprar clases y reservar horarios hace falta saber quién es cada persona. Hoy no existe
ningún concepto de usuario: la landing solo escribe leads.

## 2. Usuario

Mujer que llega desde Instagram, en el teléfono, sin ganas de llenar un registro largo. También
las profesoras y quienes administran, que entran desde computador.

## 3. Alcance

1. Login con **Google** vía Supabase Auth. Un botón, sin formulario de contraseña.
2. Tabla `perfiles` ligada a `auth.users`, con `rol`.
3. Cuatro roles: `alumna`, `profesora`, `admin`, `owner`, con `owner` como superconjunto de
   `admin`.
4. Middleware de protección de rutas por grupo (`(cuenta)`, `(profesora)`, `(admin)`, `(owner)`).
5. Políticas RLS por rol en todas las tablas.
6. Completar perfil tras el primer login: teléfono, y si la alumna es menor, datos del apoderado.
7. Vincular el lead existente con la cuenta si coincide el teléfono o el email.

## 4. Fuera de alcance

- Login con email y contraseña, o con Instagram. Solo Google en la v1.
- Recuperación de cuenta: la resuelve Google.
- Cambio de rol autoservicio: los roles los asigna admin.

## 5. Casos borde

- **Menor de edad.** Kids tiene alumnas de 7 años; no van a tener cuenta de Google. La cuenta la
  abre la mamá y debe poder gestionar reservas de una o más hijas. ⚠️ Esto implica que un perfil
  adulto tenga **dependientes**, y afecta a créditos y reservas: ¿el crédito es del apoderado o
  de la niña? **Decisión pendiente y bloqueante.**
- Una persona con dos cuentas de Google distintas: quedan dos perfiles. Debe poder fusionarlos
  un admin.
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
- [ ] Las rutas de cada portal rechazan a quien no tiene el rol.
- [ ] Un `owner` accede a todo lo de `admin` sin necesitar dos asignaciones.
- [ ] Ninguna consulta sin sesión devuelve datos de perfiles.
- [ ] Una alumna no puede leer el perfil de otra, ni por API directa.

## 8. Métrica de éxito

Que más del 80% de quienes empiezan el registro lo terminen. Si se cae mucha gente, el paso de
completar perfil está pidiendo demasiado.
