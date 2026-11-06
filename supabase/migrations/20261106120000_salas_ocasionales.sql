-- PRD-0027 §7.5 — "Otra sala": una sala arrendada para una clase.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, con
-- aprobación de Felipe en ese mismo mensaje, por el nombre de este archivo.
--
-- Una sala arrendada es **una fila más en `sedes`**, no un precio colgado de la
-- clase: si el costo de una sala vive en dos lugares, el margen depende de cuál
-- lea cada pantalla, y esa es la incoherencia que obligó a borrar `lib/cursos.ts`.
--
-- No depende de ninguna migración de esta tanda: solo toca `sedes`.
--
-- Lo que hace:
--  1. `sedes.ocasional`: está en uso, pero no se presenta como sede de XO. No
--     reutiliza `activa`, que significa "retirada" (Felipe, 06/11/2026).
--  2. direccion_comparable(): calle y número, sin lo demás.
--  3. crear_sala_ocasional(): capacidad y precio obligatorios, y compara por
--     dirección antes de crear.
--
-- Idempotente.

-- ---------------------------------------------------------------------------
-- 1. La columna
-- ---------------------------------------------------------------------------

alter table public.sedes
  add column if not exists ocasional boolean not null default false;

comment on column public.sedes.ocasional is
  'Sala arrendada para una clase: en uso, pero no es sede de XO. No sale en /nosotros. Distinto de activa = false, que es retirada.';

-- `anon` necesita leerla para que la consulta pública pueda filtrar por ella: el
-- permiso de `sedes` va columna por columna desde PRD-0021. Sigue fuera
-- `costo_hora_clp`. La fila de una ocasional sí es pública, y tiene que serlo:
-- quien reserva esa clase necesita saber dónde es.
grant select (ocasional) on public.sedes to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Comparar por dirección
-- ---------------------------------------------------------------------------

/**
 * Calle y número, sin tildes ni prefijos, para saber si dos direcciones son la
 * misma sala. Lo que va después del número se ignora, porque así vienen las
 * reales: "Barros Borgoño 71, oficina 101" y "Barros Borgoño 71 of. 101" son la
 * misma; "Av. Nueva Providencia 2260, local 130, piso 3" y "Nueva Providencia
 * 2260" también. Si no hay número, se compara todo.
 */
create or replace function public.direccion_comparable(p_direccion text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := lower(translate(coalesce(p_direccion, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'));
begin
  v := regexp_replace(v, '[#°º]|\m(numero|nro|num)\M\.?', ' ', 'g');
  v := regexp_replace(v, '[^a-z0-9]+', ' ', 'g');
  v := btrim(regexp_replace(v, '\s+', ' ', 'g'));
  v := regexp_replace(v, '^(avenida|avda|av|calle|pasaje|psje) ', '');
  -- `n 71` es lo que queda de "N° 71".
  v := regexp_replace(v, ' n ([0-9])', ' \1', 'g');
  return coalesce(substring(v from '^[^0-9]*[a-z][^0-9]*[0-9]+'), v);
end;
$$;

revoke all on function public.direccion_comparable(text) from public, anon, authenticated;
grant execute on function public.direccion_comparable(text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. crear_sala_ocasional()
-- ---------------------------------------------------------------------------

/**
 * Crea una sala arrendada. Admin u owner.
 *
 * - **La capacidad y el precio son obligatorios.** `sedes.capacidad` tiene
 *   default 22 y de ahí sale el cupo: sin este control, una sala de 12 abre con
 *   22 cupos y se descubre cuando llegan.
 * - **Compara por dirección, no por nombre**: Manuel Montt y Studio 98 son la
 *   misma sala, y Los Dominicos es Diaguitas. Si coincide, **no crea**: devuelve
 *   esa, con `creada = false`, para que la pantalla la ofrezca. Con
 *   `p_es_otra = true` crea igual: dos salas pueden compartir edificio.
 * - Una coincidencia retirada no se ofrece ni se duplica: volver a activarla es
 *   una decisión, no un efecto de esta pantalla.
 * - **Nunca devuelve el costo**, ni el de la sala que coincide.
 *
 * Los mensajes están escritos para mostrarse en la pantalla (22023).
 */
create or replace function public.crear_sala_ocasional(
  p_actor_user_id uuid,
  p_nombre text,
  p_direccion text,
  p_comuna text,
  p_capacidad int,
  p_costo_hora_clp int,
  p_es_otra boolean default false
)
returns table (
  creada boolean,
  id uuid,
  nombre text,
  direccion text,
  comuna text,
  capacidad int,
  ocasional boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_igual public.sedes;
  v_nueva public.sedes;
  v_base text;
  v_slug text;
  v_n int := 1;
begin
  select * into v_actor from public.perfiles p
  where p.user_id = p_actor_user_id and p.deleted_at is null;
  if v_actor.id is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  if coalesce(btrim(p_nombre), '') = '' or coalesce(btrim(p_direccion), '') = ''
     or coalesce(btrim(p_comuna), '') = '' then
    raise exception 'Falta el nombre, la dirección o la comuna de la sala' using errcode = '22023';
  end if;
  if p_capacidad is null or p_capacidad < 1 or p_capacidad > 500 then
    raise exception 'Falta la capacidad de la sala: de ahí sale el cupo de la clase' using errcode = '22023';
  end if;
  if p_costo_hora_clp is null or p_costo_hora_clp < 0 then
    raise exception 'Falta el precio por hora de la sala' using errcode = '22023';
  end if;

  if not coalesce(p_es_otra, false) then
    select * into v_igual from public.sedes s
    where s.deleted_at is null
      and public.direccion_comparable(s.direccion) = public.direccion_comparable(p_direccion)
    order by s.activa desc, s.ocasional, s.orden
    limit 1;

    if v_igual.id is not null then
      if not v_igual.activa then
        raise exception 'Esa dirección es de %, que está retirada. Hay que volver a activarla, no crearla de nuevo', v_igual.nombre
          using errcode = '22023';
      end if;
      return query select false, v_igual.id, v_igual.nombre, v_igual.direccion,
                          v_igual.comuna, v_igual.capacidad::int, v_igual.ocasional;
      return;
    end if;
  end if;

  v_base := btrim(regexp_replace(
    lower(translate(btrim(p_nombre), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')),
    '[^a-z0-9]+', '-', 'g'), '-');
  if v_base = '' then
    v_base := 'sala';
  end if;
  v_slug := v_base;
  while exists (select 1 from public.sedes s where s.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.sedes
    (slug, nombre, direccion, comuna, capacidad, costo_hora_clp, orden, activa, ocasional)
  values
    (v_slug, btrim(p_nombre), btrim(p_direccion), btrim(p_comuna), p_capacidad, p_costo_hora_clp,
     (select coalesce(max(s.orden), 0) + 1 from public.sedes s), true, true)
  returning * into v_nueva;

  return query select true, v_nueva.id, v_nueva.nombre, v_nueva.direccion,
                      v_nueva.comuna, v_nueva.capacidad::int, v_nueva.ocasional;
end;
$$;

revoke all on function public.crear_sala_ocasional(uuid, text, text, text, int, int, boolean)
  from public, anon, authenticated;
grant execute on function public.crear_sala_ocasional(uuid, text, text, text, int, int, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. Comprobaciones
-- ---------------------------------------------------------------------------

do $$
begin
  if has_column_privilege('anon', 'public.sedes', 'costo_hora_clp', 'select')
     or has_column_privilege('authenticated', 'public.sedes', 'costo_hora_clp', 'select') then
    raise exception 'costo_hora_clp quedó legible para una sesión.';
  end if;

  if has_function_privilege('authenticated', 'public.crear_sala_ocasional(uuid, text, text, text, int, int, boolean)', 'execute')
     or has_function_privilege('anon', 'public.crear_sala_ocasional(uuid, text, text, text, int, int, boolean)', 'execute') then
    raise exception 'crear_sala_ocasional quedó abierta a una sesión.';
  end if;
end $$;
