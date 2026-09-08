-- ---------------------------------------------------------------------------
-- Métricas del tablero de owner — PRD-0010 parte 1
-- ---------------------------------------------------------------------------
--
-- QUÉ PROBLEMA RESUELVE
--
-- El owner necesita saber si el negocio funciona, no si la operación del día
-- corre. En un modelo de paquetes prepagados eso no se ve en la caja: cobrar
-- por adelantado no es entregar el servicio, y la plata cobrada por clases que
-- todavía se deben es un pasivo que se ve igual que una utilidad.
--
-- Dos funciones, no doce consultas: cada consulta al portal es una llamada HTTP
-- a Supabase y se cuentan de a una. La página resuelve con tres como máximo.
--
-- DOS DECISIONES QUE VALE LA PENA LEER ANTES DE TOCAR ESTO
--
-- 1. SON `security invoker`, A PROPÓSITO.
--    La primera versión del PRD las proponía `security definer`. No hace falta:
--    las políticas `*_admin_lee` de compras, creditos, movimientos_credito,
--    reservas y perfiles ya usan `tiene_nivel('admin')`, que incluye a owner por
--    aritmética. Con invoker, RLS sigue puesto debajo como segunda capa, y el
--    filtro por rol de acá es la primera. Definer habría anulado la de abajo
--    para ganar nada. La regla del proyecto es que van las dos.
--
-- 2. AGREGAN Y AGRUPAN; NO DIVIDEN.
--    Las tasas, promedios, brechas y variaciones se calculan en
--    `lib/dominio/metricas.ts`, que tiene tests. Acá no hay una sola división:
--    lo que se rompe callado —dividir por cero, comparar contra un período
--    vacío, un porcentaje sobre cuatro personas— no puede vivir en un lugar sin
--    pruebas. La atribución a profesora se devuelve **agrupada** por los cuatro
--    atributos que definen su valor, para que el TypeScript multiplique sin que
--    la página tenga que arrastrar una fila por reserva.
--
-- Los períodos son semiabiertos: [p_desde, p_hasta). El período anterior es el
-- mismo largo, pegado antes: [p_desde − largo, p_desde).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. metricas_resumen — créditos, venta, alumnas y operación
-- ---------------------------------------------------------------------------

create or replace function public.metricas_resumen(
  p_desde timestamptz,
  p_hasta timestamptz
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_desde_ant timestamptz := p_desde - (p_hasta - p_desde);
  v_salida jsonb;
begin
  -- Primera capa. RLS es la segunda: admin llega hasta las filas, pero no
  -- hasta acá. Ver PRD-0010 §7.6.
  if not public.tiene_nivel('owner') then
    raise exception 'Solo el owner ve las metricas del negocio'
      using errcode = '42501';
  end if;

  if p_hasta <= p_desde then
    raise exception 'El periodo termina antes de empezar' using errcode = '22023';
  end if;

  with
  -- Una compra entra a la caja cuando se confirmó el pago, no cuando la alumna
  -- declaró la transferencia. Ver PRD-0010 §7.3.
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
    from pagadas where aprobada_at >= v_desde_ant and aprobada_at < p_desde
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
  -- Declarada y sin confirmar. No es ingreso; se muestra aparte para que no
  -- parezca que falta plata.
  pendientes as (
    select count(*)::int as compras,
           coalesce(sum(monto_clp), 0)::bigint as monto_clp
    from public.compras
    where deleted_at is null and estado = 'pendiente'
      and declarada_at >= p_desde and declarada_at < p_hasta
  ),

  -- El libro. `reserva` viene en negativo y `cancelacion` en positivo, así que
  -- la suma de los dos ya es el consumo neto; se le da vuelta el signo para
  -- entregarlo como una cantidad y no como una resta.
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
    where created_at >= v_desde_ant and created_at < p_desde
  ),
  mov_hist as (
    select
      coalesce(sum(cantidad) filter (where tipo in ('compra', 'regalo')), 0)::int
        as otorgadas,
      (-coalesce(sum(cantidad) filter (where tipo in ('reserva', 'cancelacion')), 0))::int
        as consumidas,
      -- Todos los tipos, para conciliar contra los lotes.
      coalesce(sum(cantidad), 0)::int as libro
    from public.movimientos_credito
  ),

  -- Los lotes. El pasivo se MIDE acá, no se deduce restándole el consumo a lo
  -- otorgado: al primer movimiento de tipo `ajuste` la resta miente.
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

  -- Alumnas. `perfiles` tiene los cuatro roles; acá solo interesan las alumnas.
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
      -- Crédito vigente y sin reservar hace más de 30 días, o nunca.
      (select count(*) from alumnas a
        where exists (select 1 from con_credito_vigente v where v.perfil_id = a.id)
          and not exists (select 1 from reservo_hace_poco r where r.perfil_id = a.id))::int
        as en_riesgo,
      (select count(*) from compras_por_alumna)::int as con_compra,
      (select count(*) from compras_por_alumna where n >= 2)::int as con_recompra,
      (select count(*) from reservo_alguna_vez)::int as con_reserva
  ),

  -- Operación. Las tres clases de cancelación son distintas y se cuentan aparte.
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
      'desde', p_desde,
      'hasta', p_hasta,
      'desde_anterior', v_desde_ant,
      'hasta_anterior', p_desde,
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

comment on function public.metricas_resumen(timestamptz, timestamptz) is
  'Créditos, venta, alumnas y operación de un período y del anterior. Agrega y agrupa; no divide: las tasas se calculan en lib/dominio/metricas.ts, con tests. Solo owner.';

-- ---------------------------------------------------------------------------
-- 2. metricas_demanda — ocupación, horarios y ranking de profesoras
-- ---------------------------------------------------------------------------

create or replace function public.metricas_demanda(
  p_desde timestamptz,
  p_hasta timestamptz
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

  if p_hasta <= p_desde then
    raise exception 'El periodo termina antes de empezar' using errcode = '22023';
  end if;

  with
  clases_periodo as (
    select cl.id, cl.horario_id, cl.fecha, cl.inicio, cl.estado, cl.cupo_maximo,
           cl.profesora_id, cl.curso_id, cl.sede_id
    from public.clases cl
    where cl.inicio >= p_desde and cl.inicio < p_hasta
  ),
  ocupadas as (
    select r.clase_id, count(*)::int as reservas
    from public.reservas r
    where r.estado in ('confirmada', 'asistio')
    group by r.clase_id
  ),
  detalle as (
    select cp.id, cp.horario_id, cp.fecha, cp.inicio, cp.estado, cp.cupo_maximo,
           cp.profesora_id,
           cu.nombre as curso, pr.nombre as profesora, se.nombre as sede,
           coalesce(oc.reservas, 0) as reservas,
           -- Una clase cancelada no es un horario muerto: es una clase que no
           -- ocurrió. Sale del promedio de ocupación. Ver PRD-0010 §7.5.
           (cp.estado <> 'cancelada' and cp.inicio < now()) as dictada
    from clases_periodo cp
    join public.cursos cu on cu.id = cp.curso_id
    join public.profesoras pr on pr.id = cp.profesora_id
    join public.sedes se on se.id = cp.sede_id
    left join ocupadas oc on oc.clase_id = cp.id
  ),
  por_horario as (
    select d.horario_id, h.dia_semana, h.hora,
           min(d.curso) as curso, min(d.profesora) as profesora, min(d.sede) as sede,
           (count(*) filter (where d.dictada))::int as clases_dictadas,
           coalesce(sum(d.reservas) filter (where d.dictada), 0)::int as reservas,
           coalesce(sum(d.cupo_maximo) filter (where d.dictada), 0)::int as cupos
    from detalle d
    join public.horarios h on h.id = d.horario_id
    group by d.horario_id, h.dia_semana, h.hora
  ),
  -- OJO: `reservas` y `atribucion` cuentan poblaciones distintas, y es a
  -- propósito. `reservas` son las de las CLASES del período —cuánta demanda
  -- tuvo lo que se dictó— y `atribucion` son las RESERVAS hechas en el período,
  -- que es lo que manda la regla 7.1.4 y que puede apuntar a clases de más
  -- adelante. Por eso lo comprometido puede no tener clase en esta ventana.
  reservas_por_profesora as (
    select d.profesora_id, coalesce(sum(d.reservas), 0)::int as reservas
    from detalle d
    group by d.profesora_id
  ),
  -- La atribución se agrupa por los cuatro atributos que definen su valor. El
  -- período es el de la RESERVA, no el de la clase: la compra no elige
  -- profesora, la reserva sí. Ver PRD-0010 §7.1.
  --
  -- `left join compras`: un lote de regalo no tiene compra, así que el monto
  -- viene en null y el TypeScript lo atribuye en cero.
  atribucion as (
    select cl.profesora_id,
           co.monto_clp as monto_compra_clp,
           co.cantidad_clases as clases_compra,
           r.credito_devuelto as recupero_credito,
           (cl.inicio < now()) as clase_ya_ocurrio,
           count(*)::int as n
    from public.reservas r
    join public.clases cl on cl.id = r.clase_id
    join public.creditos cr on cr.id = r.credito_id
    left join public.compras co on co.id = cr.compra_id and co.deleted_at is null
    where r.created_at >= p_desde and r.created_at < p_hasta
    group by cl.profesora_id, co.monto_clp, co.cantidad_clases,
             r.credito_devuelto, (cl.inicio < now())
  )

  select jsonb_build_object(
    'meta', jsonb_build_object('desde', p_desde, 'hasta', p_hasta, 'generado_at', now()),
    'por_clase', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'clase_id', id, 'fecha', fecha, 'inicio', inicio, 'estado', estado,
         'curso', curso, 'profesora', profesora, 'sede', sede,
         'cupo', cupo_maximo, 'reservas', reservas, 'dictada', dictada
       ) order by inicio) from detalle),
      '[]'::jsonb),
    'por_horario', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'horario_id', horario_id, 'dia_semana', dia_semana, 'hora', hora,
         'curso', curso, 'profesora', profesora, 'sede', sede,
         'clases_dictadas', clases_dictadas, 'reservas', reservas, 'cupos', cupos
       ) order by dia_semana, hora) from por_horario),
      '[]'::jsonb),
    'por_profesora', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'profesora_id', pr.id, 'slug', pr.slug, 'nombre', pr.nombre,
         'reservas', coalesce(rp.reservas, 0),
         'atribucion', coalesce(
           (select jsonb_agg(jsonb_build_object(
              'monto_compra_clp', a.monto_compra_clp,
              'clases_compra', a.clases_compra,
              'recupero_credito', a.recupero_credito,
              'clase_ya_ocurrio', a.clase_ya_ocurrio,
              'n', a.n
            )) from atribucion a where a.profesora_id = pr.id),
           '[]'::jsonb)
       ) order by pr.orden, pr.nombre)
       from public.profesoras pr
       left join reservas_por_profesora rp on rp.profesora_id = pr.id
       where pr.activa or rp.reservas is not null),
      '[]'::jsonb)
  )
  into v_salida;

  return v_salida;
end;
$$;

comment on function public.metricas_demanda(timestamptz, timestamptz) is
  'Ocupación por clase y por horario, y ranking de profesoras. La atribución va agrupada por los atributos que definen su valor: el precio unitario lo calcula lib/dominio/metricas.ts. Solo owner.';

-- ---------------------------------------------------------------------------
-- 3. Permisos, escritos y no heredados del default
-- ---------------------------------------------------------------------------
-- `revoke ... from public` NO es `revoke ... from anon`: PUBLIC es el pseudo-rol
-- que cubre a todos los roles, `authenticated` incluido, y las funciones nacen
-- con EXECUTE para PUBLIC. Revocar PUBLIC y no devolverle nada a authenticated
-- ya rompió el login una vez (PRD-0008 §15). Por eso van los dos.
--
-- No hay grant a un rol "owner": ese rol vive en `perfiles`, no en Postgres. El
-- filtro está adentro de cada función.

revoke all on function public.metricas_resumen(timestamptz, timestamptz) from public, anon;
revoke all on function public.metricas_demanda(timestamptz, timestamptz) from public, anon;

grant execute on function public.metricas_resumen(timestamptz, timestamptz)
  to authenticated, service_role;
grant execute on function public.metricas_demanda(timestamptz, timestamptz)
  to authenticated, service_role;
