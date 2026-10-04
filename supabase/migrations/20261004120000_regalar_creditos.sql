-- PRD-0023: regalar créditos a una alumna sin que cuenten como venta.
--
-- Qué resuelve: el modelo ya preveía el regalo —`creditos.compra_id` nulo y el
-- tipo `regalo` en el libro— pero no había cómo hacerlo. La única vía era SQL
-- suelto contra producción, que además no puede registrar quién lo hizo: corre
-- como `postgres`, sin perfil que poner en `creado_por`. Hacen falta para las
-- alumnas de septiembre con saldo (CONTEXT.md) y para compensaciones.
--
-- Cinco piezas:
--   1. El parámetro `regalo_vigencia_dias` (60, como los packs).
--   2. `regalar_creditos()`: lote sin compra + movimiento `regalo`, en una
--      transacción, con motivo obligatorio y autor. Solo admin y owner.
--   3. `regalos_recientes()`: la lista para admin, con el motivo.
--   4. **`movimientos_credito.motivo` deja de leerse con sesión.** La alumna
--      leía sus filas con todas las columnas, y el motivo de un regalo es
--      interno (decisión c del PRD). RLS filtra filas, no columnas: se cierra
--      con permisos por columna, y admin lo lee por la función de arriba.
--   5. `metricas_resumen` separa el pasivo en vendidas y regaladas sin usar
--      (Felipe, 04/10/2026): una es plata cobrada que se debe, la otra una
--      obligación asumida sin cobrar.
--
-- Idempotente: se puede volver a correr sin daño.

-- ---------------------------------------------------------------------------
-- 1. Parámetro
-- ---------------------------------------------------------------------------

insert into public.parametros (clave, valor, descripcion) values
  ('regalo_vigencia_dias', '60',
   'Días que valen los créditos regalados desde el regalo. Los mismos 60 de los packs (PRD-0023).')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- 2. regalar_creditos()
-- ---------------------------------------------------------------------------
-- Mismo patrón que `acreditar_compra`: security definer, el actor llega por
-- parámetro desde la acción de servidor —que verificó la sesión— y se vuelve a
-- verificar acá adentro. Concedida solo a service_role.
--
-- Se bloquea la fila del perfil destino para dos cosas: que el chequeo de
-- duplicado vea el regalo anterior si llegan dos a la vez, y que dos regalos
-- simultáneos a la misma persona escriban su `saldo_resultante` en orden.

create or replace function public.regalar_creditos(
  p_perfil_id uuid,
  p_cantidad int,
  p_motivo text,
  p_actor_user_id uuid
)
returns public.creditos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_destino public.perfiles;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_dias int := public.parametro_int('regalo_vigencia_dias', 60);
  v_credito public.creditos;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;
  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 20 then
    raise exception 'Se pueden regalar de 1 a 20 clases por vez' using errcode = '22023';
  end if;

  if char_length(v_motivo) < 5 then
    raise exception 'Escribe por qué se regalan (al menos 5 caracteres)' using errcode = '22023';
  end if;

  select * into v_destino from public.perfiles
  where id = p_perfil_id and deleted_at is null
  for update;
  if v_destino is null then
    raise exception 'Esa persona no existe' using errcode = 'P0002';
  end if;

  -- Un doble clic o un reenvío del formulario no pasa por el botón: se frena
  -- acá. Idéntico es mismo destino, cantidad, motivo y autor en 2 minutos.
  if exists (
    select 1 from public.movimientos_credito
    where perfil_id = p_perfil_id
      and tipo = 'regalo'
      and cantidad = p_cantidad
      and motivo = v_motivo
      and creado_por = v_actor.id
      and created_at > now() - interval '2 minutes'
  ) then
    raise exception 'Ya regalaste esto hace un momento. Revisa la lista de regalos antes de repetirlo'
      using errcode = '23514';
  end if;

  insert into public.creditos
    (perfil_id, compra_id, cantidad_inicial, cantidad_disponible, fecha_vencimiento)
  values
    (p_perfil_id, null, p_cantidad, p_cantidad, now() + make_interval(days => v_dias))
  returning * into v_credito;

  insert into public.movimientos_credito
    (perfil_id, credito_id, tipo, cantidad, saldo_resultante, motivo, creado_por)
  values
    (p_perfil_id, v_credito.id, 'regalo', p_cantidad,
     public.saldo_creditos(p_perfil_id), v_motivo, v_actor.id);

  return v_credito;
end;
$$;

comment on function public.regalar_creditos(uuid, int, text, uuid) is
  'PRD-0023: regala créditos sin compra. Lote con compra_id nulo y movimiento regalo con motivo y autor, en una transacción. Solo admin u owner, verificado adentro. No es venta.';

revoke all on function public.regalar_creditos(uuid, int, text, uuid)
  from public, anon, authenticated;
grant execute on function public.regalar_creditos(uuid, int, text, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3. regalos_recientes()
-- ---------------------------------------------------------------------------
-- security definer porque devuelve `motivo`, que desde esta migración no se lee
-- con sesión. Por eso la verificación de rol va en la primera línea.

create or replace function public.regalos_recientes(p_limite int default 30)
returns table (
  movimiento_id uuid,
  regalado_at timestamptz,
  perfil_id uuid,
  alumna text,
  correo text,
  cantidad int,
  motivo text,
  autor text,
  vence timestamptz,
  disponibles int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.tiene_nivel('admin') then
    raise exception 'Solo admin u owner ven los regalos' using errcode = '42501';
  end if;

  return query
  select m.id, m.created_at, m.perfil_id, p.nombre, p.email, m.cantidad, m.motivo,
         a.nombre, c.fecha_vencimiento, c.cantidad_disponible
  from public.movimientos_credito m
  join public.perfiles p on p.id = m.perfil_id
  left join public.perfiles a on a.id = m.creado_por
  left join public.creditos c on c.id = m.credito_id
  where m.tipo = 'regalo'
  order by m.created_at desc
  limit least(greatest(coalesce(p_limite, 30), 1), 100);
end;
$$;

comment on function public.regalos_recientes(int) is
  'PRD-0023: los últimos regalos de créditos, con motivo y autor. Solo admin u owner, verificado adentro.';

revoke all on function public.regalos_recientes(int) from public, anon;
grant execute on function public.regalos_recientes(int) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. El motivo no se lee con sesión
-- ---------------------------------------------------------------------------
-- La política `movimientos_propios` deja a la alumna leer sus filas, y con el
-- grant de tabla leía todas las columnas, motivo incluido. Se pasa a permisos
-- por columna: todas menos `motivo`. Las funciones que lo escriben o lo leen
-- son security definer y no dependen de esto; `metricas_resumen`, que corre con
-- la sesión de owner, solo usa tipo, cantidad y created_at.

revoke select on public.movimientos_credito from authenticated;
grant select (id, perfil_id, credito_id, reserva_id, tipo, cantidad,
              saldo_resultante, creado_por, created_at)
  on public.movimientos_credito to authenticated;

-- ---------------------------------------------------------------------------
-- 5. metricas_resumen: el pasivo por origen
-- ---------------------------------------------------------------------------
-- La misma función de 20260908130000_metricas_desde_siempre.sql, con dos
-- cambios y nada más: el CTE `lotes` separa por `compra_id`, y el objeto
-- `creditos` devuelve las partes. Los totales de antes siguen, porque la
-- conciliación libro ↔ lotes se hace sobre el total.

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
      ), 0)::int as por_vencer_30d,
      -- PRD-0023: el mismo lote, separado por origen. Un lote con compra es
      -- plata cobrada que se debe; uno sin compra es una obligación asumida sin
      -- cobrar. Juntos, el número no sirve para decidir nada (Felipe, 04/10).
      coalesce(sum(cantidad_disponible) filter (
        where compra_id is not null and fecha_vencimiento > now()), 0)::int
        as vigentes_vendidas,
      coalesce(sum(cantidad_disponible) filter (
        where compra_id is null and fecha_vencimiento > now()), 0)::int
        as vigentes_regaladas,
      coalesce(sum(cantidad_disponible) filter (
        where compra_id is not null and fecha_vencimiento <= now()), 0)::int
        as vencidas_vendidas,
      coalesce(sum(cantidad_disponible) filter (
        where compra_id is null and fecha_vencimiento <= now()), 0)::int
        as vencidas_regaladas,
      coalesce(sum(cantidad_disponible) filter (
        where compra_id is not null and fecha_vencimiento > now()
          and fecha_vencimiento <= now() + interval '30 days'), 0)::int
        as por_vencer_30d_vendidas,
      coalesce(sum(cantidad_disponible) filter (
        where compra_id is null and fecha_vencimiento > now()
          and fecha_vencimiento <= now() + interval '30 days'), 0)::int
        as por_vencer_30d_regaladas
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
  -- Lo mismo, sin filtro de período: es lo que permite que un cero diga si no
  -- pasó nada este mes o si no ha pasado nada nunca.
  historico as (
    select coalesce(sum(monto_clp), 0)::bigint as ingresos_clp,
           count(*)::int as compras,
           max(aprobada_at) as ultima_compra_at
    from pagadas
  ),
  ultimos as (
    select
      (select max(created_at) from public.movimientos_credito) as ultimo_movimiento_at,
      (select max(created_at) from public.reservas) as ultima_reserva_at,
      (select max(inicio) from public.clases
        where inicio < now() and estado <> 'cancelada') as ultima_clase_at
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
      'por_vencer_30d', (select por_vencer_30d from lotes),
      'vigentes_vendidas', (select vigentes_vendidas from lotes),
      'vigentes_regaladas', (select vigentes_regaladas from lotes),
      'vencidas_vendidas', (select vencidas_vendidas from lotes),
      'vencidas_regaladas', (select vencidas_regaladas from lotes),
      'por_vencer_30d_vendidas', (select por_vencer_30d_vendidas from lotes),
      'por_vencer_30d_regaladas', (select por_vencer_30d_regaladas from lotes)
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
    'desde_siempre', jsonb_build_object(
      'ingresos_clp', (select ingresos_clp from historico),
      'compras', (select compras from historico),
      'ultima_compra_at', (select ultima_compra_at from historico),
      'ultimo_movimiento_at', (select ultimo_movimiento_at from ultimos),
      'ultima_reserva_at', (select ultima_reserva_at from ultimos),
      'ultima_clase_at', (select ultima_clase_at from ultimos)
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
  'Créditos, venta, alumnas y operación de un período y del anterior, más los totales desde siempre para que un cero se pueda distinguir de un vacío. Separa vendidas de regaladas en el pasivo, las vencidas y las por vencer (PRD-0023). Agrega y agrupa; no divide. Solo owner.';

revoke all on function public.metricas_resumen(timestamptz, timestamptz, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.metricas_resumen(timestamptz, timestamptz, timestamptz, timestamptz)
  to authenticated, service_role;
