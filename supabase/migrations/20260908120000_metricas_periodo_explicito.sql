-- ---------------------------------------------------------------------------
-- El período anterior se recibe, no se deduce — PRD-0010
-- ---------------------------------------------------------------------------
--
-- QUÉ PROBLEMA RESUELVE
--
-- `metricas_resumen` deducía el período anterior como "el mismo largo, pegado
-- antes": `p_desde - (p_hasta - p_desde)`. Para un rango cualquiera está bien.
-- Para un mes está mal, y el tablero compara meses.
--
-- Septiembre dura 30 días, así que restarle 30 al 1 de septiembre da el **2 de
-- agosto**: la comparación se hacía contra un agosto al que le faltaba un día.
-- En febrero el error es de tres días. Meses distintos duran distinto, y no hay
-- forma de deducir "el mes anterior" a partir del largo del mes actual.
--
-- El defecto no lo agarró el escenario de §11.4 porque usa una ventana de 30
-- días, donde las dos definiciones coinciden. Apareció al escribir la página,
-- que sí pide meses.
--
-- Ahora el período anterior llega como parámetro. Lo calcula `mesAnterior()` en
-- `lib/dominio/periodo.ts`, que tiene tests para el cambio de año y para
-- febrero. Una sola definición de "el mes anterior", en el lugar que se puede
-- probar.
--
-- La función vieja se elimina en vez de dejarse: dos versiones conviviendo son
-- una invitación a llamar la equivocada.
-- ---------------------------------------------------------------------------

drop function if exists public.metricas_resumen(timestamptz, timestamptz);

create or replace function public.metricas_resumen(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_desde_ant timestamptz,
  p_hasta_ant timestamptz
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_salida jsonb;
begin
  if not public.tiene_nivel('owner') then
    raise exception 'Solo el owner ve las metricas del negocio'
      using errcode = '42501';
  end if;

  if p_hasta <= p_desde or p_hasta_ant <= p_desde_ant then
    raise exception 'El periodo termina antes de empezar' using errcode = '22023';
  end if;

  with
  pagadas as (
    select c.id, c.perfil_id, c.plan_id, c.monto_clp, c.aprobada_at
    from public.compras c
    where c.deleted_at is null
      and c.estado = 'pagada'
      and c.aprobada_at is not null
  ),
  venta_act as (
    select coalesce(sum(monto_clp), 0)::bigint as ingresos_clp,
           count(*)::int as compras
    from pagadas where aprobada_at >= p_desde and aprobada_at < p_hasta
  ),
  venta_ant as (
    select coalesce(sum(monto_clp), 0)::bigint as ingresos_clp,
           count(*)::int as compras
    from pagadas where aprobada_at >= p_desde_ant and aprobada_at < p_hasta_ant
  ),
  por_plan as (
    select pl.slug, pl.nombre,
           count(*)::int as compras,
           coalesce(sum(pg.monto_clp), 0)::bigint as monto_clp
    from pagadas pg
    join public.planes pl on pl.id = pg.plan_id
    where pg.aprobada_at >= p_desde and pg.aprobada_at < p_hasta
    group by pl.slug, pl.nombre
  ),
  pendientes as (
    select count(*)::int as compras,
           coalesce(sum(monto_clp), 0)::bigint as monto_clp
    from public.compras
    where deleted_at is null and estado = 'pendiente'
      and declarada_at >= p_desde and declarada_at < p_hasta
  ),
  mov_act as (
    select
      coalesce(sum(cantidad) filter (where tipo = 'compra'), 0)::int as vendidas,
      coalesce(sum(cantidad) filter (where tipo = 'regalo'), 0)::int as regaladas,
      (-coalesce(sum(cantidad) filter (where tipo in ('reserva', 'cancelacion')), 0))::int
        as consumidas
    from public.movimientos_credito
    where created_at >= p_desde and created_at < p_hasta
  ),
  mov_ant as (
    select
      coalesce(sum(cantidad) filter (where tipo = 'compra'), 0)::int as vendidas,
      coalesce(sum(cantidad) filter (where tipo = 'regalo'), 0)::int as regaladas,
      (-coalesce(sum(cantidad) filter (where tipo in ('reserva', 'cancelacion')), 0))::int
        as consumidas
    from public.movimientos_credito
    where created_at >= p_desde_ant and created_at < p_hasta_ant
  ),
  mov_hist as (
    select
      coalesce(sum(cantidad) filter (where tipo in ('compra', 'regalo')), 0)::int
        as otorgadas,
      (-coalesce(sum(cantidad) filter (where tipo in ('reserva', 'cancelacion')), 0))::int
        as consumidas,
      coalesce(sum(cantidad), 0)::int as libro
    from public.movimientos_credito
  ),
  lotes as (
    select
      coalesce(sum(cantidad_disponible), 0)::int as disponibles,
      coalesce(sum(cantidad_disponible)
        filter (where fecha_vencimiento <= now()), 0)::int as vencidas,
      coalesce(sum(cantidad_disponible) filter (
        where fecha_vencimiento > now()
          and fecha_vencimiento <= now() + interval '30 days'
      ), 0)::int as por_vencer_30d
    from public.creditos
  ),
  alumnas as (
    select id from public.perfiles where rol = 'alumna' and deleted_at is null
  ),
  compras_por_alumna as (
    select perfil_id, count(*)::int as n from pagadas group by perfil_id
  ),
  con_credito_vigente as (
    select distinct perfil_id from public.creditos
    where cantidad_disponible > 0 and fecha_vencimiento > now()
  ),
  reservo_hace_poco as (
    select distinct perfil_id from public.reservas
    where created_at >= now() - interval '30 days'
  ),
  reservo_alguna_vez as (
    select distinct perfil_id from public.reservas
  ),
  gente as (
    select
      (select count(*) from alumnas)::int as cuentas,
      (select count(*) from alumnas a
        where exists (select 1 from con_credito_vigente v where v.perfil_id = a.id)
           or exists (select 1 from reservo_hace_poco r where r.perfil_id = a.id))::int
        as activas,
      (select count(*) from alumnas a
        where exists (select 1 from con_credito_vigente v where v.perfil_id = a.id)
          and not exists (select 1 from reservo_hace_poco r where r.perfil_id = a.id))::int
        as en_riesgo,
      (select count(*) from compras_por_alumna)::int as con_compra,
      (select count(*) from compras_por_alumna where n >= 2)::int as con_recompra,
      (select count(*) from reservo_alguna_vez)::int as con_reserva
  ),
  cancelaciones as (
    select
      count(*)::int as total,
      (count(*) filter (where r.credito_devuelto))::int as con_devolucion,
      (count(*) filter (where not r.credito_devuelto))::int as sin_devolucion,
      (count(*) filter (where cl.estado = 'cancelada'))::int as por_clase_cancelada
    from public.reservas r
    join public.clases cl on cl.id = r.clase_id
    where r.estado = 'cancelada'
      and r.cancelada_at >= p_desde and r.cancelada_at < p_hasta
  )

  select jsonb_build_object(
    'meta', jsonb_build_object(
      'desde', p_desde, 'hasta', p_hasta,
      'desde_anterior', p_desde_ant, 'hasta_anterior', p_hasta_ant,
      'generado_at', now()
    ),
    'venta', jsonb_build_object(
      'ingresos_clp', (select ingresos_clp from venta_act),
      'compras', (select compras from venta_act),
      'por_plan', coalesce(
        (select jsonb_agg(jsonb_build_object(
           'slug', slug, 'nombre', nombre,
           'compras', compras, 'monto_clp', monto_clp
         ) order by compras desc, slug) from por_plan),
        '[]'::jsonb),
      'pendientes', jsonb_build_object(
        'compras', (select compras from pendientes),
        'monto_clp', (select monto_clp from pendientes)
      )
    ),
    'venta_anterior', jsonb_build_object(
      'ingresos_clp', (select ingresos_clp from venta_ant),
      'compras', (select compras from venta_ant)
    ),
    'creditos', jsonb_build_object(
      'vendidas', (select vendidas from mov_act),
      'regaladas', (select regaladas from mov_act),
      'consumidas', (select consumidas from mov_act),
      'otorgadas_historico', (select otorgadas from mov_hist),
      'consumidas_historico', (select consumidas from mov_hist),
      'disponibles', (select disponibles from lotes),
      'vencidas_sin_usar', (select vencidas from lotes),
      'por_vencer_30d', (select por_vencer_30d from lotes)
    ),
    'creditos_anterior', jsonb_build_object(
      'vendidas', (select vendidas from mov_ant),
      'regaladas', (select regaladas from mov_ant),
      'consumidas', (select consumidas from mov_ant)
    ),
    'conciliacion', jsonb_build_object(
      'libro', (select libro from mov_hist),
      'lotes', (select disponibles from lotes)
    ),
    'alumnas', jsonb_build_object(
      'cuentas', (select cuentas from gente),
      'activas', (select activas from gente),
      'en_riesgo', (select en_riesgo from gente),
      'con_compra', (select con_compra from gente),
      'con_recompra', (select con_recompra from gente),
      'con_reserva', (select con_reserva from gente)
    ),
    'operacion', jsonb_build_object(
      'cancelaciones', (select total from cancelaciones),
      'con_devolucion', (select con_devolucion from cancelaciones),
      'sin_devolucion', (select sin_devolucion from cancelaciones),
      'por_clase_cancelada', (select por_clase_cancelada from cancelaciones)
    )
  )
  into v_salida;

  return v_salida;
end;
$$;

comment on function public.metricas_resumen(timestamptz, timestamptz, timestamptz, timestamptz) is
  'Créditos, venta, alumnas y operación de un período y del anterior, que se recibe explícito porque no se puede deducir del largo del actual. Agrega y agrupa; no divide. Solo owner.';

revoke all on function public.metricas_resumen(timestamptz, timestamptz, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.metricas_resumen(timestamptz, timestamptz, timestamptz, timestamptz)
  to authenticated, service_role;
