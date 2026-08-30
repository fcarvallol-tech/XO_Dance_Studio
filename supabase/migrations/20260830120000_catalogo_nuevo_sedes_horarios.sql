-- PRD-0016 — Catálogo nuevo, sedes y horarios.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`.
--
-- Cambia casi todo el catálogo: Girly Básico e Intermedio se funden en Girly,
-- aparecen Reggaeton Femme y Slow Femme, sale K-Pop y con él Maida. Además
-- entran las sedes con dirección pública y los siete horarios reales.

-- ---------------------------------------------------------------------------
-- 1. sedes
-- ---------------------------------------------------------------------------
-- La dirección se publica desde este PRD: BRAND.md §7 decía lo contrario y se
-- actualiza en el mismo cambio.

create table if not exists public.sedes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  direccion text not null,
  comuna text not null,
  -- Cómo la ubica alguien de Santiago: "sector Los Leones".
  referencia text,
  orden int not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.sedes is
  'Dónde se hacen las clases. La dirección es pública desde PRD-0016.';

drop trigger if exists sedes_updated_at on public.sedes;
create trigger sedes_updated_at
  before update on public.sedes
  for each row execute function public.tocar_updated_at();

-- Misma regla que cursos y profesoras: el slug es identidad, no un campo.
drop trigger if exists sedes_slug_inmutable on public.sedes;
create trigger sedes_slug_inmutable
  before update on public.sedes
  for each row execute function public.slug_inmutable();

insert into public.sedes (slug, nombre, direccion, comuna, referencia, orden, activa)
values
  ('seduccion-latina', 'Seducción Latina Experience', 'Av. Nueva Providencia 2260', 'Providencia', 'sector Los Leones', 1, true),
  ('diaguitas', 'Centro Comunitario Diaguitas', 'Diaguitas 911', 'Las Condes', null, 2, true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2. cursos.dificultad
-- ---------------------------------------------------------------------------
-- text con check y no un enum, por consistencia con perfiles.rol: agregar un
-- valor a un check es un alter, y a un enum es una migración incómoda.
-- Hoy los cuatro cursos son principiante, pero el negocio ya tuvo un Girly
-- Intermedio y va a volver a tener niveles.

alter table public.cursos
  add column if not exists dificultad text not null default 'principiante';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cursos_dificultad_valida'
      and conrelid = 'public.cursos'::regclass
  ) then
    alter table public.cursos
      add constraint cursos_dificultad_valida
      check (dificultad in ('principiante', 'intermedio', 'avanzado'));
  end if;
end $$;

-- La columna horario queda sin uso: un curso tiene varios y viven en horarios.
-- No se borra —es null en todas las filas y borrarla no gana nada— pero queda
-- dicho, para que nadie la vuelva a llenar.
comment on column public.cursos.horario is
  'Sin uso desde PRD-0016: los horarios viven en public.horarios, porque un curso tiene varios.';

-- ---------------------------------------------------------------------------
-- 3. El catálogo nuevo
-- ---------------------------------------------------------------------------
-- Los cursos que salen se desactivan, nunca se borran: hay llaves foráneas
-- desde leads apuntando a sus slugs.
--
-- `girly` es un slug NUEVO y no un `girly-basico` renombrado. Los slugs son
-- inmutables por trigger desde PRD-0015, justamente porque hay datos que
-- apuntan ahí. Que dos cursos se fundan en uno no cambia eso.

insert into public.cursos
  (slug, nombre, publico, estilo, descripcion, formato, horario, cupos, dificultad, orden, activo)
values
  ('reggaeton-femme', 'Reggaeton Femme', 'Desde los 15 años', 'Reggaeton Femme',
   'Reggaetón bailado desde lo femenino: fuerza, actitud y cadera. Se parte de cero y se arma la coreografía entre todas, hasta que el paso deja de pensarse y sale solo.',
   null, null, null, 'principiante', 1, true),
  ('girly', 'Girly', 'Desde los 15 años', 'Girly',
   'El curso donde se baila con todo el cuerpo y sin pedir permiso. Amplitud, equilibrio y trabajo de suelo, a un ritmo pensado para quien nunca bailó y quiere empezar bien acompañada.',
   null, null, null, 'principiante', 2, true),
  ('slow-femme', 'Slow Femme', 'Desde los 15 años', 'Slow Femme',
   'Más lento no es más fácil: es donde se nota quién controla el movimiento. Se trabaja el peso, la pausa y la intención, que es lo que hace que una coreografía se vea tuya.',
   null, null, null, 'principiante', 3, true)
on conflict (slug) do nothing;

-- Teens sigue siendo el curso de entrada, con el tramo nuevo y estilo variado.
update public.cursos
set publico = 'Niñas de 11 a 14 años',
    estilo = 'Variado',
    dificultad = 'principiante',
    orden = 4,
    activo = true
where slug = 'teens';

-- Salen del catálogo. kids ya estaba inactivo desde el 22/08.
update public.cursos
set activo = false
where slug in ('kpop', 'girly-basico', 'girly-intermedio');

-- Maida sale con K-Pop. Su perfil público pasa a 404 y desaparece del lineup,
-- pero los leads que la nombran se siguen leyendo en admin.
update public.profesoras
set activa = false
where slug = 'maida';

-- ---------------------------------------------------------------------------
-- 4. horarios
-- ---------------------------------------------------------------------------

create table if not exists public.horarios (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos (id) on delete restrict,
  profesora_id uuid not null references public.profesoras (id) on delete restrict,
  sede_id uuid not null references public.sedes (id) on delete restrict,
  -- ISO 8601: 1 = lunes … 7 = domingo. Un número y no un texto, para ordenar
  -- la semana sin un case.
  dia_semana smallint not null check (dia_semana between 1 and 7),
  hora time not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.horarios is
  'Cuándo y dónde se dicta cada curso. Reemplaza a cursos.horario y a cursos_profesoras.';

drop trigger if exists horarios_updated_at on public.horarios;
create trigger horarios_updated_at
  before update on public.horarios
  for each row execute function public.tocar_updated_at();

-- Una sala por sede: no puede haber dos clases a la misma hora en el mismo
-- lugar. Confirmado el 30/08/2026 para el Centro Comunitario Diaguitas.
--
-- ⚠️ Si alguna sede llega a tener más de una sala, esta restricción hay que
-- revisarla junto con el modelado de `salas` de PRD-0006: deja de ser "una
-- clase por sede a la vez" y pasa a ser "una clase por sala a la vez", con el
-- unique sobre (sala_id, dia_semana, hora).
--
-- Parciales para que un horario desactivado no bloquee al que lo reemplaza.
create unique index if not exists horarios_sede_unico
  on public.horarios (sede_id, dia_semana, hora)
  where activo and deleted_at is null;

create unique index if not exists horarios_profesora_unico
  on public.horarios (profesora_id, dia_semana, hora)
  where activo and deleted_at is null;

create index if not exists horarios_curso_idx
  on public.horarios (curso_id, dia_semana, hora);

-- Se escriben por slug y se resuelven a id acá, para no depender de los uuid.
insert into public.horarios (curso_id, profesora_id, sede_id, dia_semana, hora)
select c.id, p.id, s.id, h.dia, h.hora::time
from (values
  ('reggaeton-femme', 'drimy', 'seduccion-latina', 1, '17:00'),
  ('teens',           'carli', 'diaguitas',        1, '18:00'),
  ('girly',           'pau',   'diaguitas',        1, '20:00'),
  ('reggaeton-femme', 'pau',   'diaguitas',        3, '20:00'),
  ('girly',           'carli', 'seduccion-latina', 5, '20:00'),
  ('slow-femme',      'lina',  'seduccion-latina', 6, '17:00'),
  ('girly',           'carli', 'seduccion-latina', 6, '18:00')
) as h (curso_slug, profesora_slug, sede_slug, dia, hora)
join public.cursos c on c.slug = h.curso_slug
join public.profesoras p on p.slug = h.profesora_slug
join public.sedes s on s.slug = h.sede_slug
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 5. cursos_profesoras sobra
-- ---------------------------------------------------------------------------
-- horarios dice quién dicta qué, dónde y cuándo. cursos_profesoras decía quién
-- dicta qué: no hay ningún hecho en la segunda que no esté en la primera.
--
-- No es por ahorrar una tabla, es que dos fuentes para el mismo hecho se
-- desincronizan. Ya pasó una versión chica: lib/cursos.ts decía que Drimy
-- dictaba Kids y lib/profesoras.ts decía que no.
--
-- Su contenido es reconstruible desde horarios, así que se puede borrar.

drop table if exists public.cursos_profesoras;

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
-- Mismo patrón que dejó PRD-0015 para cursos y profesoras.
--
-- ⚠️ Un horario activo puede apuntar a un curso o una sede inactivos, y estas
-- políticas no lo impiden: miran horarios.activo, no lo que referencian. La
-- consulta pública hace el join y descarta esos casos; la administración los ve.

alter table public.sedes enable row level security;
alter table public.horarios enable row level security;

revoke all on public.sedes from anon, authenticated;
revoke all on public.horarios from anon, authenticated;

grant select on public.sedes to anon, authenticated;
grant select on public.horarios to anon, authenticated;

grant insert, update on public.sedes to authenticated;
grant insert, update on public.horarios to authenticated;

grant select on public.sedes to service_role;
grant select on public.horarios to service_role;

drop policy if exists sedes_lectura_publica on public.sedes;
create policy sedes_lectura_publica on public.sedes
  for select to anon, authenticated
  using (activa and deleted_at is null);

drop policy if exists sedes_admin_lee_todas on public.sedes;
create policy sedes_admin_lee_todas on public.sedes
  for select to authenticated
  using (public.tiene_nivel('admin'));

drop policy if exists sedes_admin_crea on public.sedes;
create policy sedes_admin_crea on public.sedes
  for insert to authenticated
  with check (public.tiene_nivel('admin'));

drop policy if exists sedes_admin_edita on public.sedes;
create policy sedes_admin_edita on public.sedes
  for update to authenticated
  using (public.tiene_nivel('admin'))
  with check (public.tiene_nivel('admin'));

drop policy if exists horarios_lectura_publica on public.horarios;
create policy horarios_lectura_publica on public.horarios
  for select to anon, authenticated
  using (activo and deleted_at is null);

drop policy if exists horarios_admin_lee_todos on public.horarios;
create policy horarios_admin_lee_todos on public.horarios
  for select to authenticated
  using (public.tiene_nivel('admin'));

drop policy if exists horarios_admin_crea on public.horarios;
create policy horarios_admin_crea on public.horarios
  for insert to authenticated
  with check (public.tiene_nivel('admin'));

drop policy if exists horarios_admin_edita on public.horarios;
create policy horarios_admin_edita on public.horarios
  for update to authenticated
  using (public.tiene_nivel('admin'))
  with check (public.tiene_nivel('admin'));
