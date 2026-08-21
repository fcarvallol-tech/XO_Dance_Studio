# ADR-0004 — Supabase Auth con Google como único método de acceso

| Campo | Valor |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 21 de agosto de 2026 |
| **Decide** | Felipe Carvalho |

## Contexto

El producto necesita cuentas. El requisito explícito fue que entrar sea "súper sencillo", con un
botón de iniciar sesión con Google. La base de datos ya es Supabase.

## Opciones

**A — Supabase Auth con Google.** Ya viene incluido, se integra con RLS de forma nativa (las
políticas leen `auth.uid()` directamente), sin costo adicional, y el registro es de un toque.
En contra: dependencia de que la persona tenga cuenta de Google.

**B — Supabase Auth con email y contraseña.** Funciona para todos, pero agrega fricción, exige
flujos de recuperación y verificación, y es más superficie de soporte.

**C — Proveedor externo (Clerk, Auth0).** Mejor experiencia lista, pero costo mensual y una
integración más con RLS que no aporta nada que Supabase no dé.

## Decisión

Supabase Auth con Google como único método en la v1.

## Razón

En Chile prácticamente todo teléfono Android trae cuenta de Google, y el público objetivo llega
desde Instagram en el teléfono. Un botón contra un formulario es la diferencia entre convertir y
no convertir. Además la integración nativa con RLS elimina toda una clase de bugs de permisos.

## Consecuencias

**Más fácil:** registro de un toque, cero gestión de contraseñas, políticas RLS directas.

**Más difícil:** quien no tenga cuenta de Google queda fuera. Es un riesgo asumible en la v1 y
mitigable después agregando email y contraseña, que Supabase soporta sin migrar nada.

**Consecuencia no obvia:** las alumnas de Kids tienen 7 años y no tienen cuenta de Google. La
cuenta la abre la mamá, lo que obliga a modelar **perfiles con dependientes**. Eso no es un
detalle de auth: cambia a quién pertenecen los créditos y las reservas. Ver PRD-0004 §5.

## Cuándo revisar

Si aparecen personas que no pueden entrar por no tener Google, se agrega email y contraseña como
segundo método.
