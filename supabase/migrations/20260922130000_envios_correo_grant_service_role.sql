-- PRD-0019 — El grant a `service_role` que faltó en `envios_correo`.
--
-- NO ejecutar a mano: se aplica con `supabase db push`, con aprobación.
--
-- ---------------------------------------------------------------------------
-- Es la tercera vez que pasa lo mismo en este proyecto
-- ---------------------------------------------------------------------------
-- `20260922120000_envios_correo.sql` escribió `grant select on
-- public.envios_correo to authenticated` y **se olvidó del rol del servidor**.
-- Resultado, verificado por REST contra staging el 22/09/2026:
--
--   compras        service_role → 200
--   reservas       service_role → 200
--   clases         service_role → 200
--   envios_correo  service_role → 403  permission denied for table
--
-- Ya había pasado con `perfiles` y con `parametros` (PRD-0017 §16), y las dos
-- veces se anotó la lección. Se repitió igual, y el detalle que la hace
-- escurridiza es siempre el mismo: **no se nota**. Las funciones de la
-- migración son `security definer` y corren como su dueño, así que encolar,
-- marcar y purgar iban a funcionar perfecto; lo que falla es la primera lectura
-- directa que alguien escriba desde el servidor, meses después, con un error de
-- permisos que no se parece en nada a su causa.
--
-- Por eso se corrige **antes** de que exista esa lectura, y por eso el escenario
-- de la fase 3 ahora prueba los tres roles contra la tabla: es un caso de una
-- línea que convierte un descuido recurrente en algo que se cae en la corrida.
--
-- Se escribe como migración nueva y no editando la anterior, que ya corrió en
-- staging: `supabase/README.md` lo dice, y las dos veces anteriores la
-- corrección también fue un archivo nuevo.

-- Solo lectura: escribir en esta tabla pasa por las funciones —`encolar_correo`,
-- `marcar_enviado`, `marcar_fallido`, `descartar_envio`—, que es lo que mantiene
-- el registro coherente. Un `insert` suelto desde el servidor se saltaría la
-- idempotencia por clave, que es justamente lo que evita el correo duplicado.
grant select on public.envios_correo to service_role;

comment on table public.envios_correo is
  $c$Cada correo transaccional que el sistema decidió mandar, registrado ANTES de intentarlo. Sin esto, un envío que falla no deja ni a quién había que escribirle. Lectura: admin por RLS, y service_role para el servidor. Escritura: solo por las funciones. PRD-0019.$c$;
