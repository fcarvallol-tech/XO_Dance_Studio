-- Arreglo urgente: el login quedó roto tras la migración anterior.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`.
--
-- ---------------------------------------------------------------------------
-- Qué pasó
-- ---------------------------------------------------------------------------
-- La migración anterior escribió, para nueve funciones:
--
--     revoke execute on function public.tiene_nivel(text) from public, anon;
--
-- La intención era cerrarle la puerta a `anon`. Pero **`PUBLIC` en Postgres no
-- es "el público": es el pseudo-rol que cubre a TODOS los roles**, incluido
-- `authenticated`. Y las funciones nacen con `EXECUTE` para `PUBLIC` por
-- defecto, así que `tiene_nivel`, `mi_rol` y `nivel_rol` **nunca tuvieron un
-- grant explícito a `authenticated`**: funcionaban por ese default.
--
-- Revocar `PUBLIC` se lo quitó a todo el mundo.
--
-- El efecto fue en cascada porque `tiene_nivel` la llaman las políticas RLS de
-- casi todas las tablas. Cualquier `select` de un usuario con sesión evalúa la
-- política de admin —aunque no sea admin— y esa política llama a la función:
--
--     select perfiles              -> 42501 permission denied for function tiene_nivel
--     select clases                -> 42501
--     select compras               -> 42501
--     select solicitudes_horario   -> 42501
--
-- Y de ahí el login: `perfilActual()` no podía leer `perfiles`, devolvía null,
-- `requiereSesion` mandaba a /entrar, y /entrar veía null y volvía a mostrar la
-- puerta. Entrar y quedar afuera, con Google y con magic link por igual.
--
-- Las otras seis funciones no se rompieron porque sí tenían `grant execute ...
-- to authenticated` explícito en sus migraciones originales. Solo faltaban
-- estas tres.
--
-- ---------------------------------------------------------------------------
-- El arreglo, y por qué no devuelve nada a `anon`
-- ---------------------------------------------------------------------------
-- No hace falta devolverle ninguna función a `anon`, y no se devuelve:
--
--   · Ninguna política `for select to anon` llama funciones — todas comparan
--     columnas (`activo`, `deleted_at`). Verificado.
--   · Confirmado empíricamente: con las nueve revocadas, `anon` seguía leyendo
--     cursos, profesoras, sedes, horarios, planes y clases sin problema.
--
-- Los datos de Carla siguen cerrados. Lo que se restaura es solo el acceso de
-- **quien tiene sesión**, que nunca debió perderse.

grant execute on function public.tiene_nivel(text) to authenticated, service_role;
grant execute on function public.mi_rol() to authenticated, service_role;
grant execute on function public.nivel_rol(text) to authenticated, service_role;

-- Las otras seis ya lo tenían, pero se escriben explícitos igual. El default de
-- `PUBLIC` es justamente lo que hizo que este error pasara desapercibido: si el
-- permiso está escrito, un `revoke ... from public` futuro no vuelve a
-- llevárselo por delante.

grant execute on function public.mi_profesora_id() to authenticated, service_role;
grant execute on function public.dicta_la_clase(uuid) to authenticated, service_role;
grant execute on function public.conflictos_de_solicitud(uuid) to authenticated, service_role;
grant execute on function public.normalizar_nombre(text) to authenticated, service_role;
grant execute on function public.parametro_int(text, int) to authenticated, service_role;
grant execute on function public.parametros_como_json() to authenticated, service_role;

-- Y las de PRD-0004 y PRD-0017 que tampoco tenían grant explícito, por la misma
-- razón: hoy funcionan por el default de PUBLIC, y el próximo revoke las
-- rompería igual.

grant execute on function public.saldo_creditos(uuid) to service_role;
grant execute on function public.tocar_updated_at() to service_role;
grant execute on function public.slug_inmutable() to service_role;

comment on function public.tiene_nivel(text) is
  $c$La llaman las políticas RLS de casi todas las tablas, así que `authenticated` necesita
EXECUTE o se cae cualquier select con sesión. `anon` no la necesita: ninguna política `to anon`
invoca funciones. Ojo: revocarla de PUBLIC se la quita a todos, no solo a anon.$c$;
