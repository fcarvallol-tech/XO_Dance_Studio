-- PRD-0010 parte 3 — El incentivo es por horario, no por curso (Felipe, 10/11/2026).
--
-- Cuando Felipe dice "curso" se refiere al horario semanal. Las dos clases de
-- Pau —martes en Los Leones y jueves en Diaguitas— son el mismo curso en la
-- base, con dos horarios, y el promedio las mezclaba. El promedio de los martes
-- se saca solo con los martes.
--
-- La regla vive en lib/dominio/liquidacion.ts. Acá solo se entrega, por clase,
-- **a qué horario cuenta**, con su día y su hora para nombrarlo ("Girly,
-- sábados"):
--
-- - Una clase de parrilla cuenta en su horario.
-- - **Una recuperativa cuenta en el horario que recupera**, no en el día en que
--   se dicta: la del 3/11 de Pau recuperada el viernes 27/11 es una clase de
--   los martes. `crear_recuperativa` ya le pone el mismo `horario_id`, pero
--   `marcar_recuperacion` acepta cualquier clase del mismo curso, así que no se
--   confía en eso: se toma el horario de la original.
--
-- El horario entra en la huella: si cambia a qué horario cuenta una clase,
-- cambia el monto. Ninguna liquidación está cerrada todavía en ninguna base,
-- así que no hay huellas viejas que dejen de calzar.
--
-- Mismo patrón que 20261106130000: cambia el tipo de retorno, así que se
-- borran y se recrean, con sus grants.

drop function if exists public.insumos_liquidacion(date);
drop function if exists public.mis_insumos_liquidacion(date);
drop function if exists public.insumos_del_mes(date);

create function public.insumos_del_mes(p_mes date)
returns table (
  clase_id uuid,
  profesora_id uuid,
  curso_id uuid,
  curso text,
  sede text,
  inicio timestamptz,
  fin timestamptz,
  tipo text,
  estado text,
  causa text,
  profesora_se_presento boolean,
  recuperada boolean,
  recupera_clase_id uuid,
  creditos_consumidos int,
  recuperacion_inicio timestamptz,
  recupera_inicio timestamptz,
  no_se_recupera_at timestamptz,
  horario_id uuid,
  dia_semana smallint,
  hora text
)
language sql
stable
security definer
set search_path = public
as $$
  select cl.id, cl.profesora_id, cl.curso_id,
         coalesce(cl.titulo, cu.nombre), se.nombre,
         cl.inicio, cl.fin, cl.tipo, cl.estado,
         ca.causa, coalesce(ca.profesora_se_presento, false),
         rec.inicio is not null,
         cl.recupera_clase_id,
         (select count(*)::int from public.reservas r
           where r.clase_id = cl.id
             and r.credito_id is not null
             and r.credito_devuelto = false
             and r.estado not in ('pendiente_pago', 'expirada', 'liberada')),
         rec.inicio,
         ori.inicio,
         case when ca.no_se_recupera_at < b.hasta then ca.no_se_recupera_at end,
         h.id,
         h.dia_semana,
         left(h.hora::text, 5)
  from public.clases cl
  join public.cursos cu on cu.id = cl.curso_id
  join public.sedes se on se.id = cl.sede_id
  left join public.causas_de_clase ca on ca.clase_id = cl.id and ca.deleted_at is null
  left join lateral (
    select r.inicio from public.clases r
    where r.recupera_clase_id = cl.id
      and r.estado not in ('cancelada', 'no_dictada')
    order by r.inicio
    limit 1
  ) rec on true
  left join public.clases ori on ori.id = cl.recupera_clase_id
  -- El horario al que cuenta: el de la original, si es una recuperativa.
  left join public.horarios h on h.id = coalesce(ori.horario_id, cl.horario_id)
  cross join public.bordes_de_mes(p_mes) b
  where ((cl.inicio >= b.desde and cl.inicio < b.hasta)
         -- De un mes anterior, marcada "no se va a recuperar" en este: su base va acá.
         or (cl.inicio < b.desde
             and ca.no_se_recupera_at >= b.desde and ca.no_se_recupera_at < b.hasta))
    and (cl.tipo = 'parrilla' or cl.publicada_at is not null)
  order by cl.inicio, cl.id;
$$;

revoke all on function public.insumos_del_mes(date) from public, anon, authenticated, service_role;

/** La huella, ahora con el horario: a qué horario cuenta una clase mueve el incentivo. */
create or replace function public.huella_del_mes(p_profesora_id uuid, p_mes date)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select md5(
    coalesce((
      select string_agg(
        concat_ws('|', i.clase_id, i.inicio, i.fin, i.tipo, i.estado, i.causa,
                  i.profesora_se_presento, i.recuperada, i.creditos_consumidos,
                  coalesce(i.no_se_recupera_at::text, 'pendiente'),
                  i.horario_id),
        ',' order by i.clase_id)
      from public.insumos_del_mes(p_mes) i
      where i.profesora_id = p_profesora_id
    ), '')
    || '#' ||
    coalesce((
      select concat_ws('|', base_hora_clp, variable_credito_clp, umbral_variable)
      from public.costos_profesoras where profesora_id = p_profesora_id
    ), 'sin_tarifa')
  );
$$;

revoke all on function public.huella_del_mes(uuid, date) from public, anon, authenticated, service_role;

create function public.insumos_liquidacion(p_mes date)
returns table (
  clase_id uuid, profesora_id uuid, curso_id uuid, curso text, sede text,
  inicio timestamptz, fin timestamptz, tipo text, estado text, causa text,
  profesora_se_presento boolean, recuperada boolean, recupera_clase_id uuid,
  creditos_consumidos int, recuperacion_inicio timestamptz, recupera_inicio timestamptz,
  no_se_recupera_at timestamptz, horario_id uuid, dia_semana smallint, hora text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.tiene_nivel('owner') then
    raise exception 'Solo el owner ve la liquidación' using errcode = '42501';
  end if;
  if p_mes < date '2026-11-01' then
    raise exception 'La liquidación empieza en noviembre de 2026: los meses anteriores se pagaron a mano'
      using errcode = '22023';
  end if;
  return query select * from public.insumos_del_mes(p_mes);
end;
$$;

revoke all on function public.insumos_liquidacion(date) from public, anon;
grant execute on function public.insumos_liquidacion(date) to authenticated, service_role;

/**
 * La profesora: solo sus clases (ADR-0008). El horario es suyo —el día y la
 * hora ya son públicos en el calendario—, y lo necesita para ver de qué
 * horario es cada objetivo.
 */
create function public.mis_insumos_liquidacion(p_mes date)
returns table (
  clase_id uuid, curso_id uuid, curso text, sede text,
  inicio timestamptz, fin timestamptz, tipo text, estado text, causa text,
  profesora_se_presento boolean, recuperada boolean, creditos_consumidos int,
  recuperacion_inicio timestamptz, recupera_inicio timestamptz, no_se_recupera_at timestamptz,
  horario_id uuid, dia_semana smallint, hora text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profesora uuid := public.mi_profesora_id();
begin
  if v_profesora is null or p_mes < date '2026-11-01' then
    return;
  end if;
  return query
  select i.clase_id, i.curso_id, i.curso, i.sede, i.inicio, i.fin, i.tipo, i.estado,
         i.causa, i.profesora_se_presento, i.recuperada, i.creditos_consumidos,
         i.recuperacion_inicio, i.recupera_inicio, i.no_se_recupera_at,
         i.horario_id, i.dia_semana, i.hora
  from public.insumos_del_mes(p_mes) i
  where i.profesora_id = v_profesora;
end;
$$;

revoke all on function public.mis_insumos_liquidacion(date) from public, anon;
grant execute on function public.mis_insumos_liquidacion(date) to authenticated, service_role;
