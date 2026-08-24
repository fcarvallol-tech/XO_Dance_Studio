-- PRD-0003 — La captación pasa de curso a profesora.
-- El formulario ya no pregunta "¿Qué curso te interesa?" sino
-- "¿Con quién quieres tomar clases?".
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`.

-- El curso deja de ser obligatorio. Sigue guardándose cuando el lead entró
-- desde una tarjeta de curso, pero ya no es la pregunta del formulario.
alter table public.leads
  alter column curso_id drop not null;

-- profesora_id NO pasa a `not null`. Los leads anteriores a este cambio lo
-- tienen en NULL y un NOT NULL retroactivo los rompería (PRD-0003 §4). La
-- obligatoriedad se impone en la aplicación: lib/lead.ts y app/api/lead/route.ts.
--
-- Lo que sí se garantiza en la base es que ningún lead quede sin los dos:
-- los históricos cumplen por curso_id, los nuevos por profesora_id.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_curso_o_profesora'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_curso_o_profesora
      check (curso_id is not null or profesora_id is not null);
  end if;
end $$;

comment on column public.leads.curso_id is
  'Opcional desde PRD-0003. Se guarda solo cuando el lead entró desde una tarjeta de curso.';

comment on column public.leads.profesora_id is
  'Eje de la captación desde PRD-0003. Obligatorio en la aplicación, no en la base: los leads históricos lo tienen en NULL.';

-- Sin cambios de seguridad: la tabla sigue con RLS activo, sin políticas,
-- con `revoke all` a anon/authenticated y solo INSERT para service_role.
