-- PRD-0004 — Cuentas, autenticación y roles.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`.
--
-- Fuera de alcance en esta migración, a propósito: todo lo relativo a menores
-- de edad (apoderado, autorización y bloqueo de compra). XO Mini entra al
-- catálogo con rango etario sin definir, y ADR-0006 se apoyaba en que el piso
-- eran 11 años. Ese supuesto se cae, así que la parte de menores se rediseña,
-- no se adelanta. Ver PRD-0004 §9.

-- ---------------------------------------------------------------------------
-- 1. perfiles
-- ---------------------------------------------------------------------------

create table if not exists public.perfiles (
  id uuid primary key default gen_random_uuid(),
  -- La identidad la manda auth.users. Si se borra el usuario, se va el perfil.
  user_id uuid not null unique references auth.users (id) on delete cascade,
  rol text not null default 'alumna'
    check (rol in ('alumna', 'profesora', 'admin', 'owner')),
  nombre text,
  email text,
  -- Ocho dígitos, sin el prefijo +56 9. Mismo formato que leads.whatsapp.
  telefono text,
  avatar_url text,
  -- Slug de lib/profesoras.ts. Sin llave foránea porque el catálogo todavía
  -- vive en /lib. Pasa a FK real cuando migre. Ver ARCHITECTURE.md §10.
  profesora_id text,
  fecha_nacimiento date,
  -- Opt-in explícito, nunca implícito. Ley 19.628 / 21.719.
  autoriza_uso_imagen boolean not null default false,
  perfil_completo_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.perfiles is
  'Extiende auth.users con rol y datos de contacto. Una fila por usuario, creada por trigger.';

comment on column public.perfiles.rol is
  'Jerárquico: owner > admin > profesora > alumna. Nunca se edita desde el cliente; ver public.cambiar_rol.';

comment on column public.perfiles.profesora_id is
  'Slug de lib/profesoras.ts. Deuda: pasa a FK cuando el catálogo migre a base de datos.';

-- Una profesora sin saber cuál de las cinco es no puede ver ninguna clase:
-- entra al portal y le sale vacío. El rol y la identidad viajan juntos o no
-- viajan. La base lo garantiza; la aplicación no alcanza.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'perfiles_profesora_con_identidad'
      and conrelid = 'public.perfiles'::regclass
  ) then
    alter table public.perfiles
      add constraint perfiles_profesora_con_identidad
      check (rol <> 'profesora' or profesora_id is not null);
  end if;
end $$;

create index if not exists perfiles_rol_idx on public.perfiles (rol);
create index if not exists perfiles_email_idx on public.perfiles (email);

-- ---------------------------------------------------------------------------
-- 2. La jerarquía de roles, como aritmética
-- ---------------------------------------------------------------------------
-- ARCHITECTURE.md §5.1 lo pide explícito: owner es superconjunto de admin y se
-- implementa como jerarquía, no como dos listas de permisos que se van a
-- desincronizar. Una política que diga tiene_nivel('admin') incluye a owner
-- sin nombrarlo nunca.

create or replace function public.nivel_rol(rol text)
returns int
language sql
immutable
as $$
  select case rol
    when 'alumna'    then 10
    when 'profesora' then 20
    when 'admin'     then 30
    when 'owner'     then 40
    else 0
  end;
$$;

-- security definer a propósito: una política sobre perfiles que consulte
-- perfiles se llama a sí misma y entra en recursión infinita. Con definer, la
-- función lee la tabla sin pasar por RLS y corta el ciclo.
create or replace function public.mi_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol
  from public.perfiles
  where user_id = auth.uid()
    and deleted_at is null;
$$;

create or replace function public.tiene_nivel(minimo text)
returns boolean
language sql
stable
as $$
  select public.nivel_rol(public.mi_rol()) >= public.nivel_rol(minimo);
$$;

-- ---------------------------------------------------------------------------
-- 3. El perfil lo crea un trigger, nunca el cliente
-- ---------------------------------------------------------------------------
-- Así nadie llega a existir sin perfil, y sobre todo: nadie elige su rol al
-- insertarlo. El default es alumna y no hay camino para pedir otro.
--
-- Supabase vincula automáticamente identidades con el mismo correo verificado,
-- así que entrar con Google y después con magic link al mismo correo produce
-- un solo auth.users y por lo tanto un solo perfil. El on conflict cubre el
-- caso raro de que el trigger corra dos veces.

create or replace function public.crear_perfil_para_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (user_id, email, nombre, avatar_url)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists crear_perfil_al_registrarse on auth.users;
create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row execute function public.crear_perfil_para_usuario();

-- updated_at se mantiene solo.
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists perfiles_updated_at on public.perfiles;
create trigger perfiles_updated_at
  before update on public.perfiles
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Libro de cambios de rol
-- ---------------------------------------------------------------------------
-- Es la operación más sensible del sistema: quien cambia un rol cambia quién
-- ve la plata. Se registra siempre.
--
-- No lleva deleted_at, y es la excepción deliberada a la convención de
-- ARCHITECTURE.md §5: un libro no se borra ni lógicamente. Solo se agrega.

create table if not exists public.cambios_rol (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles (id),
  rol_anterior text not null,
  rol_nuevo text not null,
  -- Quién lo hizo. Nunca nulo: no hay cambios de rol anónimos.
  cambiado_por uuid not null references public.perfiles (id),
  motivo text,
  -- A qué profesora del catálogo quedó amarrada, cuando el rol nuevo lo exige.
  profesora_id text,
  created_at timestamptz not null default now()
);

comment on table public.cambios_rol is
  'Libro de cambios de rol. Solo se agrega: nunca se edita ni se borra, ni siquiera con la service role key.';

create index if not exists cambios_rol_perfil_idx
  on public.cambios_rol (perfil_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Cambiar un rol: una sola transacción, con todas las reglas en la base
-- ---------------------------------------------------------------------------
-- La ruta de servidor valida antes de llamar acá, pero la base vuelve a
-- validar: es la única capa que resiste una llamada directa con la service
-- role key. El actor viaja explícito porque quien ejecuta es service_role,
-- donde auth.uid() es nulo.

-- La firma cambió el 25/08/2026 al sumar p_profesora_id. Con defaults, dejar la
-- vieja convertiría cualquier llamada de cuatro argumentos en ambigua.
drop function if exists public.cambiar_rol(uuid, text, uuid, text);

create or replace function public.cambiar_rol(
  p_perfil_id uuid,
  p_rol_nuevo text,
  p_actor_user_id uuid,
  p_motivo text default null,
  p_profesora_id text default null
)
returns public.perfiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_objetivo public.perfiles;
  v_owners int;
  v_profesora_id text;
begin
  if public.nivel_rol(p_rol_nuevo) = 0 then
    raise exception 'Rol desconocido: %', p_rol_nuevo using errcode = '22023';
  end if;

  select * into v_actor
  from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null then
    raise exception 'Quien hace el cambio no tiene perfil' using errcode = '42501';
  end if;

  select * into v_objetivo
  from public.perfiles
  where id = p_perfil_id and deleted_at is null;

  if v_objetivo is null then
    raise exception 'El perfil no existe' using errcode = 'P0002';
  end if;

  -- Solo admin para arriba.
  if public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  -- Nadie toca su propio rol: ni para subirse ni para dejarse fuera.
  if v_actor.id = v_objetivo.id then
    raise exception 'No puedes cambiar tu propio rol' using errcode = '42501';
  end if;

  -- No se reparte lo que no se tiene: nada por encima del nivel propio.
  if public.nivel_rol(p_rol_nuevo) > public.nivel_rol(v_actor.rol) then
    raise exception 'No puedes asignar un rol superior al tuyo' using errcode = '42501';
  end if;

  -- Ni se degrada a alguien que está por encima.
  if public.nivel_rol(v_objetivo.rol) > public.nivel_rol(v_actor.rol) then
    raise exception 'No puedes cambiar el rol de alguien de nivel superior' using errcode = '42501';
  end if;

  -- Quien pasa a profesora tiene que quedar amarrada a una del catálogo. Sin
  -- esto queda con profesora_id nulo, entra al portal y no ve ninguna clase,
  -- porque el sistema no sabe cuál de las cinco es.
  --
  -- El slug se valida contra lib/profesoras.ts en la ruta de servidor: acá no
  -- hay contra qué comprobarlo mientras el catálogo no sea una tabla. Cuando lo
  -- sea, esto pasa a ser una llave foránea. Ver ARCHITECTURE.md §10.
  if p_rol_nuevo = 'profesora' then
    v_profesora_id := nullif(btrim(p_profesora_id), '');
    if v_profesora_id is null then
      raise exception 'Para dejarla como profesora hay que decir cuál es'
        using errcode = '23514';
    end if;
  else
    -- Al salir del rol se limpia: un slug colgando de alguien que ya no hace
    -- clases es un dato que después nadie sabe interpretar.
    v_profesora_id := null;
  end if;

  -- Nada que cambiar: mismo rol y misma profesora.
  if v_objetivo.rol = p_rol_nuevo
     and v_objetivo.profesora_id is not distinct from v_profesora_id then
    return v_objetivo;
  end if;

  -- La academia nunca puede quedarse sin owner: sin él no hay forma de volver
  -- a repartir roles salvo entrando a la base a mano.
  if v_objetivo.rol = 'owner' and p_rol_nuevo <> 'owner' then
    select count(*) into v_owners
    from public.perfiles
    where rol = 'owner' and deleted_at is null;

    if v_owners <= 1 then
      raise exception 'No puedes dejar la academia sin owner' using errcode = '23514';
    end if;
  end if;

  insert into public.cambios_rol
    (perfil_id, rol_anterior, rol_nuevo, cambiado_por, motivo, profesora_id)
  values
    (v_objetivo.id, v_objetivo.rol, p_rol_nuevo, v_actor.id,
     nullif(btrim(p_motivo), ''), v_profesora_id);

  update public.perfiles
  set rol = p_rol_nuevo,
      profesora_id = v_profesora_id
  where id = v_objetivo.id
  returning * into v_objetivo;

  return v_objetivo;
end;
$$;

-- La función es el único camino. Nadie la llama desde el navegador.
revoke all on function public.cambiar_rol(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.cambiar_rol(uuid, text, uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------

alter table public.perfiles enable row level security;
alter table public.cambios_rol enable row level security;

revoke all on public.perfiles from anon, authenticated;
revoke all on public.cambios_rol from anon, authenticated;

-- Cada quien lee y edita el suyo. La lista de columnas es lo que impide que
-- alguien se autoasigne un rol: `rol` no está, así que no es actualizable por
-- authenticated, y eso no depende de que una política esté bien escrita.
grant select on public.perfiles to authenticated;
grant update (nombre, telefono, avatar_url, autoriza_uso_imagen, fecha_nacimiento, perfil_completo_at)
  on public.perfiles to authenticated;

-- El libro se lee desde admin, y se escribe solo desde cambiar_rol.
grant select on public.cambios_rol to authenticated;
grant select, insert on public.cambios_rol to service_role;
-- Append-only de verdad: service_role salta RLS, pero no salta los grants.
revoke update, delete on public.cambios_rol from service_role;

drop policy if exists perfiles_lee_el_suyo on public.perfiles;
create policy perfiles_lee_el_suyo on public.perfiles
  for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

drop policy if exists perfiles_edita_el_suyo on public.perfiles;
create policy perfiles_edita_el_suyo on public.perfiles
  for update to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null)
  with check (user_id = (select auth.uid()));

-- tiene_nivel('admin') incluye a owner por aritmética. No hay política de owner
-- duplicada que mantener.
drop policy if exists perfiles_admin_lee_todos on public.perfiles;
create policy perfiles_admin_lee_todos on public.perfiles
  for select to authenticated
  using (public.tiene_nivel('admin'));

drop policy if exists perfiles_admin_edita_todos on public.perfiles;
create policy perfiles_admin_edita_todos on public.perfiles
  for update to authenticated
  using (public.tiene_nivel('admin'))
  with check (public.tiene_nivel('admin'));

-- Sin política de insert ni de delete para nadie: el alta la hace el trigger y
-- las bajas son lógicas, desde el servidor.

drop policy if exists cambios_rol_admin_lee on public.cambios_rol;
create policy cambios_rol_admin_lee on public.cambios_rol
  for select to authenticated
  using (public.tiene_nivel('admin'));

-- ---------------------------------------------------------------------------
-- 7. leads: hoy no la puede leer nadie
-- ---------------------------------------------------------------------------
-- ARCHITECTURE.md §6 lo marca como pendiente. El grant habilita y la política
-- restringe: se necesitan los dos. Los grants vuelven para `authenticated`,
-- nunca para `anon`, que es lo que ese documento advierte no relajar.

grant select, update on public.leads to authenticated;

drop policy if exists leads_admin_lee on public.leads;
create policy leads_admin_lee on public.leads
  for select to authenticated
  using (public.tiene_nivel('admin'));

drop policy if exists leads_admin_edita on public.leads;
create policy leads_admin_edita on public.leads
  for update to authenticated
  using (public.tiene_nivel('admin'))
  with check (public.tiene_nivel('admin'));

-- La landing sigue escribiendo con la service role key y nunca leyendo.

-- ---------------------------------------------------------------------------
-- 8. El primer owner
-- ---------------------------------------------------------------------------
-- No hay flujo de autoservicio y no puede haberlo. Después de entrar por
-- primera vez a la web, correr esto en el SQL Editor de Supabase, con el
-- correo real:
--
--   update public.perfiles set rol = 'owner'
--   where email = 'correo@dominio.cl';
--
-- Es el único cambio de rol que no queda en cambios_rol, porque todavía no
-- existe nadie que pueda figurar como autor. De ahí en adelante todo pasa por
-- POST /api/roles. Ver PRD-0004 §8.
