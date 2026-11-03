-- Una etiqueta corta por sede, para la celda del calendario: el sector.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, con
-- aprobación de Felipe en ese mismo mensaje.
--
-- El calendario público no decía dónde era ninguna clase: la celda solo
-- mostraba el lugar en clases de más de una hora, y todas duran una (Felipe,
-- 03/11/2026). La dirección completa no cabe en una celda de una hora, así que
-- la celda lleva una etiqueta corta y las direcciones van una sola vez debajo
-- del calendario.
--
-- **Por qué el sector y no la comuna ni el nombre de la sala:**
--   · La comuna no distingue: Los Leones y Studio 98 son las dos de Providencia.
--   · El nombre de la sala es justo lo que Felipe sacó del sitio el 02/11
--     ("Seducción Latina Experience" no le dice a nadie adónde ir), y además no
--     cabe.
--   · El sector —Los Leones, Manuel Montt, Los Dominicos— es corto, distingue
--     las tres, dice dónde queda en Santiago (son estaciones de metro) y es
--     como Felipe ya las nombra (CONTEXT.md: "Manuel Montt es Studio 98, Los
--     Dominicos es Diaguitas").
--
-- `null` en EB Dance Studio, que hoy no tiene horarios: el sitio cae a la
-- comuna. No se inventa un sector para una sala sin clases.
--
-- ⚠️ `sedes` tiene permisos por columna (20260926120000): una columna nueva no
-- la ve `anon` hasta que se le da. Se le da acá, y `escenario-capacidad.mjs`
-- la agrega a la lista esperada.
--
-- Idempotente.

alter table public.sedes add column if not exists sector text;

comment on column public.sedes.sector is
  'Etiqueta corta para la celda del calendario: el sector de Santiago, no el nombre de la sala (20261103120000). null = se muestra la comuna.';

update public.sedes set sector = 'Los Leones'    where slug = 'seduccion-latina' and sector is distinct from 'Los Leones';
update public.sedes set sector = 'Manuel Montt'  where slug = 'studio-98'        and sector is distinct from 'Manuel Montt';
update public.sedes set sector = 'Los Dominicos' where slug = 'diaguitas'        and sector is distinct from 'Los Dominicos';

grant select (sector) on public.sedes to anon, authenticated;

do $$
begin
  if exists (
    select 1 from public.sedes s
    where s.activa and s.deleted_at is null and s.sector is null
      and exists (select 1 from public.horarios h where h.sede_id = s.id and h.activo and h.deleted_at is null)
  ) then
    raise exception 'Hay una sede con horarios activos y sin sector.';
  end if;
end $$;
