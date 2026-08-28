-- PRD-0015 — El catálogo sale del código y pasa a la base.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`.
--
-- Hasta hoy los cinco cursos y las cinco profesoras vivían en lib/cursos.ts y
-- lib/profesoras.ts. Cambiar una bio era un commit y un deploy, y el único que
-- podía hacerlo era Felipe. Desde acá se edita desde el Table Editor.

-- ---------------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.profesoras (
  id uuid primary key default gen_random_uuid(),
  -- Identidad pública y estable: la guardan leads.profesora_id,
  -- perfiles.profesora_id y la URL /profesoras/<slug>. No se edita: §3.
  slug text not null unique,
  nombre text not null,
  -- Eyebrow del lineup: el estilo que enseña, corto y en minúsculas.
  estilo text not null,
  bio text,
  instagram text,
  -- Rutas dentro de /public, o null mientras el material no exista.
  foto_url text,
  video_url text,
  -- El lineup tiene un orden pensado, no alfabético.
  orden int not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.cursos (
  id uuid primary key default gen_random_uuid(),
  -- Lo que guardan los leads. 'kids' vive acá para siempre, desactivado.
  slug text not null unique,
  nombre text not null,
  -- Eyebrow: a quién está dirigido, en una línea.
  publico text not null,
  estilo text not null,
  descripcion text not null,
  -- Solo Girly: el formato intensivo mensual por artista.
  formato text,
  -- Pendientes de Carla. null se muestra como "Por confirmar".
  horario text,
  cupos int,
  orden int not null default 0,
  -- En masculino, a diferencia del `activa` que arrastraba lib/cursos.ts.
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Muchos a muchos. Sin columnas propias todavía: si más adelante hace falta
-- distinguir titular de reemplazo, se agregan acá.
create table if not exists public.cursos_profesoras (
  curso_id uuid not null references public.cursos (id) on delete cascade,
  profesora_id uuid not null references public.profesoras (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (curso_id, profesora_id)
);

comment on table public.cursos is
  'Catálogo de cursos. Un curso que sale de la oferta se desactiva, nunca se borra: hay leads que apuntan a su slug.';
comment on table public.profesoras is
  'Catálogo de profesoras. Misma regla que cursos: se desactivan, no se borran.';
comment on column public.cursos.slug is
  'Identidad estable. Inmutable por trigger: leads y URLs públicas apuntan acá.';

create index if not exists cursos_activo_idx on public.cursos (activo, orden);
create index if not exists profesoras_activa_idx on public.profesoras (activa, orden);
create index if not exists cursos_profesoras_profesora_idx
  on public.cursos_profesoras (profesora_id);

-- ---------------------------------------------------------------------------
-- 2. updated_at
-- ---------------------------------------------------------------------------
-- public.tocar_updated_at() ya existe desde la migración de perfiles.

drop trigger if exists cursos_updated_at on public.cursos;
create trigger cursos_updated_at
  before update on public.cursos
  for each row execute function public.tocar_updated_at();

drop trigger if exists profesoras_updated_at on public.profesoras;
create trigger profesoras_updated_at
  before update on public.profesoras
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Los slugs no se editan
-- ---------------------------------------------------------------------------
-- Riesgo nuevo que no existía con el catálogo en código: renombrar un slug
-- desde el Table Editor deja huérfanos los leads que lo referencian y rompe la
-- URL pública, que puede estar compartida por Instagram. Las llaves foráneas
-- de §5 tienen `on update cascade`, así que los datos sobrevivirían, pero la
-- URL no. Mejor prohibirlo con un mensaje claro que descubrirlo en tres meses.

create or replace function public.slug_inmutable()
returns trigger
language plpgsql
as $$
begin
  if new.slug is distinct from old.slug then
    raise exception
      'El slug no se edita: hay leads y URLs públicas que apuntan a "%". Si de verdad hay que renombrarlo, va con una migración que arregle también lo que apunta ahí.',
      old.slug
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists cursos_slug_inmutable on public.cursos;
create trigger cursos_slug_inmutable
  before update on public.cursos
  for each row execute function public.slug_inmutable();

drop trigger if exists profesoras_slug_inmutable on public.profesoras;
create trigger profesoras_slug_inmutable
  before update on public.profesoras
  for each row execute function public.slug_inmutable();

-- ---------------------------------------------------------------------------
-- 4. Carga inicial
-- ---------------------------------------------------------------------------
-- Extraída de lib/cursos.ts y lib/profesoras.ts tal cual estaban, incluidas las
-- bios reales con sus emojis. Es carga inicial editable, no valores fijos.

insert into public.profesoras
  (slug, nombre, estilo, bio, instagram, foto_url, video_url, orden, activa)
values
  ('carli', 'Carli', 'reggaetón femenino · urbano', 'Acá la bio de "Carli"', 'https://www.instagram.com/carlataty.20/', null, null, 1, true),
  ('pau', 'Pau', 'reggaetón femenino', 'Soy la Pau💗 mi estilo de baile es muy femenino, esta es la base de mis clases de girly y reggaeton. En ambos cursos podrás aprender a ocupar todo tu cuerpo (amplitud), mantener el centro (equilibrio), y trabajo de suelo. El nivel coreográfico será básico, y el nivel explicativo, principiante. Esta es TU clase, estaré muy preocupada de ir a tu ritmo😉 Tengo muchas ganas de conocerte!! Nos vemos en xo💋', 'https://www.instagram.com/pau_balbontinc/', null, null, 2, true),
  ('drimy', 'Drimy', 'urbano teens', 'Holaa✨️ Soy la Drimy, bailo hace 8 años y me dedico principalmente a los estilos urbanos y al jazz. La danza ha sido una parte fundamental de mi crecimiento personal: me ayudó a conocerme, a confiar en mí misma y a descubrir una seguridad que no sabía que necesitaba. Por eso decidí enseñar; porque quiero que otras personas también puedan encontrar en la danza un espacio para potenciarse, ganar confianza y crecer. Me apasiona acompañar ese proceso y ver cómo cada persona descubre todo lo que es capaz de hacer a través del movimiento.', 'https://www.instagram.com/ladrimy/', null, null, 3, true),
  ('lina', 'Lina', 'urbano teens', 'Soy Lina, bailarina, intérprete y profesora. A lo largo de los años he aprendido y explorado distintos estilos como jazz y urbano, además de técnicas como ballet, lo que me ha permitido ir formando mi propia manera de bailar y de enseñar. Desde 2024 hago clases a niños y niñas desde los 2 hasta los 13 años, y me encanta poder compartir con ellos todo lo que he aprendido. En mis clases busco que cada niño pueda aprender a su ritmo, divertirse, expresarse y, sobre todo, disfrutar del baile. Nos vemos en clase!', 'https://www.instagram.com/linaapop/', null, null, 4, true),
  ('maida', 'Maida', 'k-pop', 'Acá la bio de "Maida"', 'https://www.instagram.com/maidaquirozc/', null, null, 5, true)
on conflict (slug) do nothing;

insert into public.cursos
  (slug, nombre, publico, estilo, descripcion, formato, horario, cupos, orden, activo)
values
  ('kids', 'XO Kids', 'Niñas de 7 a 10 años', 'Urbano', 'Tu hija va a esperar el día de la clase toda la semana. Grupos chicos, profes que se aprenden su nombre la primera clase, y un espacio donde hace amigas mientras aprende a moverse con confianza.', null, null, null, 1, false),
  ('teens', 'XO Teens', 'Niñas de 11 a 15 años', 'Urbano', 'A los 11 ya no quieren una clase de niñas: quieren bailar en serio y sentirse parte de algo. Grupos chicos, profes que se aprenden su nombre la primera clase, y una hija que espera el día de la clase toda la semana.', null, null, null, 2, true),
  ('girly-basico', 'XO Girly Básico', 'Mujeres desde 16 años · sin experiencia', 'Reggaetón femenino', 'Nunca bailaste reggaetón y te da lata partir. Se empieza de cero, y en cuatro semanas te sabes una coreografía completa del artista del mes.', 'Intensivo mensual por artista. Un artista al mes —Omar Cruz, De la Rose, Standly—, cuatro clases y una coreografía nueva por semana.', null, null, 3, true),
  ('girly-intermedio', 'XO Girly Intermedio', 'Mujeres con experiencia previa', 'Reggaetón femenino', 'Ya bailas y quieres exigirte. Mismo formato mensual, más técnica, más trucos y más velocidad para armarte un estilo propio.', 'Intensivo mensual por artista. Un artista al mes, cuatro clases y una coreografía nueva por semana.', null, null, 4, true),
  ('kpop', 'K-Pop', 'Desde los 11 años', 'K-Pop', 'Las coreografías que te aprendiste sola en tu pieza, ahora con el grupo completo y frente al espejo. Se baila y se conversa de lo mismo.', null, null, null, 5, true)
on conflict (slug) do nothing;

-- Los pares se escriben por slug y se resuelven a id acá, para no tener que
-- conocer los uuid generados.
--
-- Ojo con kids ↔ drimy/lina: lib/cursos.ts las seguía listando en Kids aunque
-- lib/profesoras.ts ya no. Se conserva porque es cierto —dictaron ese curso— y
-- no se ve en ninguna parte: kids está inactivo.
insert into public.cursos_profesoras (curso_id, profesora_id)
select c.id, p.id
from (values
  ('girly-basico', 'carli'),
  ('girly-basico', 'pau'),
  ('girly-intermedio', 'pau'),
  ('kids', 'drimy'),
  ('kids', 'lina'),
  ('kpop', 'maida'),
  ('teens', 'carli'),
  ('teens', 'drimy'),
  ('teens', 'lina')
) as par (curso_slug, profesora_slug)
join public.cursos c on c.slug = par.curso_slug
join public.profesoras p on p.slug = par.profesora_slug
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 5. Llaves foráneas: se salda la deuda de ARCHITECTURE.md §10
-- ---------------------------------------------------------------------------
-- Apuntan al slug y no al id a propósito: perfiles.profesora_id y
-- leads.profesora_id ya guardan slugs, y /profesoras/<slug> es una URL pública
-- que puede estar compartida. Pasarlo todo a uuid obligaría a reescribir filas
-- y a cambiar URLs para no ganar nada.
--
-- Las de `leads` entran porque se verificó el 28/08/2026 que la tabla está
-- vacía: no hay valores históricos que puedan hacer fallar la migración.

alter table public.perfiles
  drop constraint if exists perfiles_profesora_fk;
alter table public.perfiles
  add constraint perfiles_profesora_fk
  foreign key (profesora_id) references public.profesoras (slug)
  on update cascade on delete restrict;

alter table public.leads
  drop constraint if exists leads_curso_fk;
alter table public.leads
  add constraint leads_curso_fk
  foreign key (curso_id) references public.cursos (slug)
  on update cascade on delete restrict;

alter table public.leads
  drop constraint if exists leads_profesora_fk;
alter table public.leads
  add constraint leads_profesora_fk
  foreign key (profesora_id) references public.profesoras (slug)
  on update cascade on delete restrict;

-- ---------------------------------------------------------------------------
-- 6. Un lead se valida donde solo la base puede validarlo
-- ---------------------------------------------------------------------------
-- La forma —nombre con dos letras, ocho dígitos de teléfono, edad en rango— se
-- sigue validando en lib/lead.ts, en cliente y servidor: el cliente avisa antes
-- de enviar y el servidor manda. Lo que sube acá es solo lo que la base es la
-- única que sabe: que el curso y la profesora existan y estén activos.
--
-- Va dentro del mismo insert para no agregar un viaje a Supabase en el momento
-- más sensible del sitio. La llave foránea cubre la existencia; esta función
-- cubre además que estén activos, que una FK no puede expresar.

create or replace function public.crear_lead(
  p_nombre text,
  p_whatsapp text,
  p_para_quien text,
  p_edad_alumna int,
  p_curso_id text,
  p_profesora_id text,
  p_origen text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.profesoras
    where slug = p_profesora_id and activa and deleted_at is null
  ) then
    raise exception 'La profesora no existe o ya no hace clases' using errcode = '23503';
  end if;

  -- El curso es opcional desde PRD-0003: solo viene cuando el lead entró desde
  -- una tarjeta de curso. Si viene, tiene que ser uno vigente.
  if p_curso_id is not null and not exists (
    select 1 from public.cursos
    where slug = p_curso_id and activo and deleted_at is null
  ) then
    raise exception 'El curso no existe o salió del catálogo' using errcode = '23503';
  end if;

  insert into public.leads
    (nombre, whatsapp, para_quien, edad_alumna, curso_id, profesora_id, origen)
  values
    (p_nombre, p_whatsapp, p_para_quien, p_edad_alumna, p_curso_id, p_profesora_id, p_origen)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.crear_lead(text, text, text, int, text, text, text)
  from public, anon, authenticated;
grant execute on function public.crear_lead(text, text, text, int, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 7. cambiar_rol: la profesora tiene que estar activa
-- ---------------------------------------------------------------------------
-- Con la llave foránea de §5, que el slug exista ya lo garantiza Postgres, así
-- que la validación que vivía en app/api/roles/route.ts se borra. Lo que la FK
-- no puede expresar es que esté **activa**, y esa regla se muda acá, junto a
-- las demás reglas de cambio de rol.

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

  if public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  if v_actor.id = v_objetivo.id then
    raise exception 'No puedes cambiar tu propio rol' using errcode = '42501';
  end if;

  if public.nivel_rol(p_rol_nuevo) > public.nivel_rol(v_actor.rol) then
    raise exception 'No puedes asignar un rol superior al tuyo' using errcode = '42501';
  end if;

  if public.nivel_rol(v_objetivo.rol) > public.nivel_rol(v_actor.rol) then
    raise exception 'No puedes cambiar el rol de alguien de nivel superior' using errcode = '42501';
  end if;

  if p_rol_nuevo = 'profesora' then
    v_profesora_id := nullif(btrim(p_profesora_id), '');

    if v_profesora_id is null then
      raise exception 'Para dejarla como profesora hay que decir cuál es'
        using errcode = '23514';
    end if;

    -- Que exista lo garantiza la llave foránea de §5. Que esté vigente, no.
    if not exists (
      select 1 from public.profesoras
      where slug = v_profesora_id and activa and deleted_at is null
    ) then
      raise exception 'Esa profesora no existe o ya no está activa'
        using errcode = '23503';
    end if;
  else
    v_profesora_id := null;
  end if;

  if v_objetivo.rol = p_rol_nuevo
     and v_objetivo.profesora_id is not distinct from v_profesora_id then
    return v_objetivo;
  end if;

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

revoke all on function public.cambiar_rol(uuid, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.cambiar_rol(uuid, text, uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------------
-- Estas son las primeras tablas del proyecto que `anon` puede leer. Por eso la
-- política dice `activo` de forma literal: la landing filtra igual, pero la
-- garantía no puede depender de que la aplicación se acuerde.

alter table public.cursos enable row level security;
alter table public.profesoras enable row level security;
alter table public.cursos_profesoras enable row level security;

revoke all on public.cursos from anon, authenticated;
revoke all on public.profesoras from anon, authenticated;
revoke all on public.cursos_profesoras from anon, authenticated;

grant select on public.cursos to anon, authenticated;
grant select on public.profesoras to anon, authenticated;
grant select on public.cursos_profesoras to anon, authenticated;

-- Escritura solo para quien administra. Sin delete: la baja es activo = false.
grant insert, update on public.cursos to authenticated;
grant insert, update on public.profesoras to authenticated;
grant insert, delete on public.cursos_profesoras to authenticated;

-- El build del sitio lee con la llave publishable (rol anon), pero el servidor
-- también necesita leer el catálogo completo en algún momento.
grant select on public.cursos to service_role;
grant select on public.profesoras to service_role;
grant select on public.cursos_profesoras to service_role;

drop policy if exists cursos_lectura_publica on public.cursos;
create policy cursos_lectura_publica on public.cursos
  for select to anon, authenticated
  using (activo and deleted_at is null);

-- tiene_nivel('admin') incluye a owner por aritmética.
drop policy if exists cursos_admin_lee_todos on public.cursos;
create policy cursos_admin_lee_todos on public.cursos
  for select to authenticated
  using (public.tiene_nivel('admin'));

drop policy if exists cursos_admin_crea on public.cursos;
create policy cursos_admin_crea on public.cursos
  for insert to authenticated
  with check (public.tiene_nivel('admin'));

drop policy if exists cursos_admin_edita on public.cursos;
create policy cursos_admin_edita on public.cursos
  for update to authenticated
  using (public.tiene_nivel('admin'))
  with check (public.tiene_nivel('admin'));

drop policy if exists profesoras_lectura_publica on public.profesoras;
create policy profesoras_lectura_publica on public.profesoras
  for select to anon, authenticated
  using (activa and deleted_at is null);

drop policy if exists profesoras_admin_lee_todas on public.profesoras;
create policy profesoras_admin_lee_todas on public.profesoras
  for select to authenticated
  using (public.tiene_nivel('admin'));

drop policy if exists profesoras_admin_crea on public.profesoras;
create policy profesoras_admin_crea on public.profesoras
  for insert to authenticated
  with check (public.tiene_nivel('admin'));

drop policy if exists profesoras_admin_edita on public.profesoras;
create policy profesoras_admin_edita on public.profesoras
  for update to authenticated
  using (public.tiene_nivel('admin'))
  with check (public.tiene_nivel('admin'));

-- La tabla de unión no guarda nada sensible, y un par que apunta a una fila
-- oculta no revela nada: el join contra cursos o profesoras no la devuelve.
drop policy if exists cursos_profesoras_lectura_publica on public.cursos_profesoras;
create policy cursos_profesoras_lectura_publica on public.cursos_profesoras
  for select to anon, authenticated
  using (true);

drop policy if exists cursos_profesoras_admin_crea on public.cursos_profesoras;
create policy cursos_profesoras_admin_crea on public.cursos_profesoras
  for insert to authenticated
  with check (public.tiene_nivel('admin'));

drop policy if exists cursos_profesoras_admin_borra on public.cursos_profesoras;
create policy cursos_profesoras_admin_borra on public.cursos_profesoras
  for delete to authenticated
  using (public.tiene_nivel('admin'));
