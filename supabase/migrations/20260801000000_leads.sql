-- Leads de la clase de prueba gratis.
-- Ejecutar en el SQL Editor de Supabase, o con `supabase db push`.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre text not null,
  -- Ocho dígitos, sin el prefijo +56 9. El formato lo garantiza el servidor.
  whatsapp text not null,
  para_quien text not null check (para_quien in ('propio', 'hija')),
  edad_alumna int check (edad_alumna between 4 and 17),
  curso_id text not null,
  profesora_id text,
  -- De qué sección salió el click. Es lo que dice qué convierte.
  origen text
);

comment on table public.leads is
  'Interesadas en la clase de prueba. Se escribe solo desde app/api/lead/route.ts con la service role key.';

-- La edad solo tiene sentido cuando la clase es para una hija.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_edad_solo_si_hija'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_edad_solo_si_hija
      check (para_quien = 'hija' or edad_alumna is null);
  end if;
end $$;

create index if not exists leads_created_at_idx
  on public.leads (created_at desc);

-- RLS activo y sin políticas: nadie llega a esta tabla con la anon key.
-- La service role key salta RLS y vive solo en el servidor.
alter table public.leads enable row level security;

-- Defensa en profundidad: sin los grants por defecto de Supabase, un error de
-- políticas a futuro tampoco expone la tabla.
revoke all on public.leads from anon, authenticated;

-- En los proyectos nuevos los privilegios por defecto ya no alcanzan a los
-- roles del Data API, así que el del servidor va explícito. Solo INSERT: la
-- landing escribe leads y nunca los lee.
grant insert on public.leads to service_role;
