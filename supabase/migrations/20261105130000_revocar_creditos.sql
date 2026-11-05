-- PRD-0024 — Revocar créditos: el espejo de regalar_creditos (PRD-0023).
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, con
-- aprobación de Felipe en ese mismo mensaje, por el nombre de este archivo.
--
-- Revocar es **agregar**, nunca deshacer: un movimiento negativo de tipo propio
-- (`revocacion`) por cada lote tocado, con motivo y autor. El regalo o la
-- compra que originaron el crédito quedan intactos en el libro.
--
-- Decidido por Felipe (05/11/2026, PRD-0024 §8.6):
--   · Solo owner, verificado adentro. No admin.
--   · Del lote vigente que vence primero —el orden de `reservar()`—.
--   · Si no alcanza el saldo vigente, no se quita nada.
--   · Candado de duplicados de 2 minutos.
--   · Sin correo a la alumna, y ella no ve el motivo.
--   · El tope es su saldo.
--   · **Revocar es solo para revocar.** "Fue a clase y no reservó" no se
--     resuelve acá: la profesora no cobraría una clase que sí hizo. Es una
--     reserva que falta, no un crédito de más, y va en su propia pieza.
--   · En el tablero, `revocadas` es **una línea propia**, sin restarse de
--     `vendidas`: lo vendido no cambia porque después se quite un crédito.
--
-- Cinco piezas:
--   1. El tipo `revocacion` en movimientos_credito.
--   2. revocar_creditos().
--   3. revocaciones_recientes(), solo owner.
--   4. metricas_resumen con `revocadas` en el período, el anterior y el
--      histórico. Copia de 20261004120000 con esas líneas y nada más.
--   5. El candado para anular una compra con clases vivas. Se aplica aparte
--      de 20261105120000_pack_de_amigas.sql: no depende de esa ni esa de esta.
--
-- `reservar()` no se toca.
--
-- Idempotente.

-- ---------------------------------------------------------------------------
-- 1. El tipo nuevo
-- ---------------------------------------------------------------------------
-- El check se creó inline en 20260831120000 y Postgres le puso el nombre. Se
-- busca por definición para no depender de él, como en 20260910120000 §2.

do $$
declare
  v_nombre text;
begin
  for v_nombre in
    select conname from pg_constraint
    where conrelid = 'public.movimientos_credito'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%tipo%regalo%'
  loop
    execute format('alter table public.movimientos_credito drop constraint %I', v_nombre);
  end loop;

  alter table public.movimientos_credito add constraint movimientos_credito_tipo_valido
    check (tipo in ('compra', 'reserva', 'cancelacion', 'expiracion', 'ajuste', 'regalo',
                    'revocacion'));

  -- Una revocación siempre resta, siempre dice por qué y siempre dice quién.
  if not exists (select 1 from pg_constraint where conname = 'movimientos_revocacion_completa') then
    alter table public.movimientos_credito add constraint movimientos_revocacion_completa
      check (tipo <> 'revocacion'
             or (cantidad < 0 and motivo is not null and creado_por is not null
                 and credito_id is not null));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. revocar_creditos()
-- ---------------------------------------------------------------------------
-- Mismo patrón que `regalar_creditos`: security definer, el actor llega por
-- parámetro desde la acción de servidor —que ya verificó la sesión— y se
-- vuelve a verificar acá adentro. Concedida solo a service_role.
--
-- Orden de bloqueo: **perfil, después lotes**. El perfil serializa dos
-- revocaciones a la misma alumna (y el candado de duplicados ve la anterior);
-- los lotes, `for update` en el mismo orden que usa `reservar()`
-- —fecha_vencimiento asc—, hacen que una reserva simultánea espere o vea el
-- saldo ya descontado.

create or replace function public.revocar_creditos(
  p_perfil_id uuid,
  p_cantidad int,
  p_motivo text,
  p_actor_user_id uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_destino public.perfiles;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_vigente int;
  v_falta int;
  v_quitar int;
  v_lotes int := 0;
  v_lote record;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;
  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('owner') then
    raise exception 'Solo el owner puede quitar clases' using errcode = '42501';
  end if;

  if p_cantidad is null or p_cantidad < 1 then
    raise exception 'La cantidad tiene que ser al menos 1' using errcode = '22023';
  end if;

  if char_length(v_motivo) < 5 then
    raise exception 'Escribe por qué se quitan (al menos 5 caracteres)' using errcode = '22023';
  end if;

  select * into v_destino from public.perfiles
  where id = p_perfil_id and deleted_at is null
  for update;
  if v_destino is null then
    raise exception 'Esa persona no existe' using errcode = 'P0002';
  end if;

  -- Una revocación puede escribir varias filas, una por lote: el candado
  -- compara la **suma** de lo revocado con ese motivo y autor en la ventana.
  if (
    select -coalesce(sum(cantidad), 0)
    from public.movimientos_credito
    where perfil_id = p_perfil_id
      and tipo = 'revocacion'
      and motivo = v_motivo
      and creado_por = v_actor.id
      and created_at > now() - interval '2 minutes'
  ) = p_cantidad then
    raise exception 'Ya quitaste esto hace un momento. Revisa la lista antes de repetirlo'
      using errcode = '23514';
  end if;

  -- Bloquear los lotes vigentes en el orden de consumo, y sumar.
  perform 1 from public.creditos
  where perfil_id = p_perfil_id
    and cantidad_disponible > 0
    and fecha_vencimiento > now()
  order by fecha_vencimiento asc, id
  for update;

  select coalesce(sum(cantidad_disponible), 0) into v_vigente
  from public.creditos
  where perfil_id = p_perfil_id
    and cantidad_disponible > 0
    and fecha_vencimiento > now();

  -- Todo o nada: antes de escribir una sola fila.
  if v_vigente < p_cantidad then
    raise exception 'Tiene % % vigentes: no se pueden quitar %. No se quitó nada',
      v_vigente, case when v_vigente = 1 then 'clase' else 'clases' end, p_cantidad
      using errcode = '23514';
  end if;

  v_falta := p_cantidad;
  for v_lote in
    select id, cantidad_disponible from public.creditos
    where perfil_id = p_perfil_id
      and cantidad_disponible > 0
      and fecha_vencimiento > now()
    order by fecha_vencimiento asc, id
  loop
    exit when v_falta = 0;
    v_quitar := least(v_lote.cantidad_disponible, v_falta);

    update public.creditos
    set cantidad_disponible = cantidad_disponible - v_quitar
    where id = v_lote.id;

    insert into public.movimientos_credito
      (perfil_id, credito_id, tipo, cantidad, saldo_resultante, motivo, creado_por)
    values
      (p_perfil_id, v_lote.id, 'revocacion', -v_quitar,
       public.saldo_creditos(p_perfil_id), v_motivo, v_actor.id);

    v_falta := v_falta - v_quitar;
    v_lotes := v_lotes + 1;
  end loop;

  return v_lotes;
end;
$$;

comment on function public.revocar_creditos(uuid, int, text, uuid) is
  'PRD-0024: quita créditos vigentes del lote que vence primero. Un movimiento revocacion negativo por lote, con motivo y autor, en una transacción. Todo o nada: si el saldo no alcanza, no quita nada. Solo owner, verificado adentro. Devuelve cuántos lotes tocó.';

revoke all on function public.revocar_creditos(uuid, int, text, uuid)
  from public, anon, authenticated;
grant execute on function public.revocar_creditos(uuid, int, text, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3. revocaciones_recientes()
-- ---------------------------------------------------------------------------
-- Como `regalos_recientes`: security definer porque devuelve `motivo`, que no
-- se lee con sesión desde PRD-0023, así que el rol se verifica en la primera
-- línea. **Solo owner**, porque solo owner revoca. Una fila por revocación,
-- no por lote: se agrupan las filas del mismo instante, perfil, motivo y autor.

create or replace function public.revocaciones_recientes(p_limite int default 30)
returns table (
  revocado_at timestamptz,
  perfil_id uuid,
  alumna text,
  correo text,
  cantidad int,
  lotes int,
  motivo text,
  autor text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.tiene_nivel('owner') then
    raise exception 'Solo el owner ve las clases quitadas' using errcode = '42501';
  end if;

  -- Las filas de una misma revocación comparten `created_at`: es `now()`, el
  -- instante de la transacción.
  return query
  select m.created_at, m.perfil_id, p.nombre, p.email,
         (-sum(m.cantidad))::int, count(*)::int, m.motivo, a.nombre
  from public.movimientos_credito m
  join public.perfiles p on p.id = m.perfil_id
  left join public.perfiles a on a.id = m.creado_por
  where m.tipo = 'revocacion'
  group by m.created_at, m.perfil_id, p.nombre, p.email, m.motivo, a.nombre
  order by m.created_at desc
  limit least(greatest(coalesce(p_limite, 30), 1), 100);
end;
$$;

comment on function public.revocaciones_recientes(int) is
  'PRD-0024: las últimas revocaciones de créditos, una fila por revocación (no por lote), con motivo y autor. Solo owner, verificado adentro.';

revoke all on function public.revocaciones_recientes(int) from public, anon;
grant execute on function public.revocaciones_recientes(int) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. metricas_resumen: `revocadas`, línea propia
-- ---------------------------------------------------------------------------
-- Copia de 20261004120000 §5. Cambia solo esto:
--   · `mov_act`, `mov_ant` y `mov_hist` suman `revocadas` (en positivo).
--   · `creditos` devuelve `revocadas` y `revocadas_historico`, y
--     `creditos_anterior` devuelve `revocadas`.
-- `vendidas`, `regaladas` y `consumidas` siguen filtrando sus tipos: una
-- revocación no los toca. El pasivo (lotes) sí baja, porque es una obligación
-- que dejó de existir, y la conciliación libro ↔ lotes sigue cuadrando: la
-- revocación baja el lote y escribe el negativo en la misma transacción.

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
        as consumidas,
      -- PRD-0024: línea propia, en positivo. **No se resta de vendidas ni de
      -- regaladas**: lo vendido no cambia porque después se quite un crédito
      -- (Felipe, 05/11/2026).
      (-coalesce(sum(cantidad) filter (where tipo = 'revocacion'), 0))::int as revocadas
    from public.movimientos_credito
    where created_at >= p_desde and created_at < p_hasta
  ),
  mov_ant as (
    select
      coalesce(sum(cantidad) filter (where tipo = 'compra'), 0)::int as vendidas,
      coalesce(sum(cantidad) filter (where tipo = 'regalo'), 0)::int as regaladas,
      (-coalesce(sum(cantidad) filter (where tipo in ('reserva', 'cancelacion')), 0))::int
        as consumidas,
      -- PRD-0024: línea propia, en positivo. **No se resta de vendidas ni de
      -- regaladas**: lo vendido no cambia porque después se quite un crédito
      -- (Felipe, 05/11/2026).
      (-coalesce(sum(cantidad) filter (where tipo = 'revocacion'), 0))::int as revocadas
    from public.movimientos_credito
    where created_at >= p_desde_ant and created_at < p_hasta_ant
  ),
  mov_hist as (
    select
      coalesce(sum(cantidad) filter (where tipo in ('compra', 'regalo')), 0)::int
        as otorgadas,
      (-coalesce(sum(cantidad) filter (where tipo in ('reserva', 'cancelacion')), 0))::int
        as consumidas,
      (-coalesce(sum(cantidad) filter (where tipo = 'revocacion'), 0))::int as revocadas,
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
      'revocadas', (select revocadas from mov_act),
      'otorgadas_historico', (select otorgadas from mov_hist),
      'consumidas_historico', (select consumidas from mov_hist),
      'revocadas_historico', (select revocadas from mov_hist),
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
      'consumidas', (select consumidas from mov_ant),
      'revocadas', (select revocadas from mov_ant)
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
  'Créditos, venta, alumnas y operación de un período y del anterior, más los totales desde siempre para que un cero se pueda distinguir de un vacío. Separa vendidas de regaladas en el pasivo, las vencidas y las por vencer (PRD-0023). Las revocadas van en su propia línea, sin restarse de vendidas ni regaladas (PRD-0024). Agrega y agrupa; no divide. Solo owner.';

revoke all on function public.metricas_resumen(timestamptz, timestamptz, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.metricas_resumen(timestamptz, timestamptz, timestamptz, timestamptz)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Anular una compra: primero se quitan sus clases
-- ---------------------------------------------------------------------------
-- Hoy nada en el sitio anula una compra: `deleted_at` solo se escribe a mano
-- en el Table Editor, y **no toca los lotes**. Una compra anulada así deja sus
-- clases vivas y reservables.
--
-- Lo que no puede pasar es una anulación a medias: que alguien crea que anuló y
-- las clases sigan ahí. Así que se rechaza anular **cualquier** compra que
-- todavía tenga clases vigentes sin usar, en cualquiera de sus lotes. Para
-- anularla, primero se quitan esas clases con `revocar_creditos`, con motivo, y
-- recién ahí se marca.
--
-- Vive acá y no en la migración del pack de amigas, donde nació (Felipe,
-- 05/11/2026): es un candado sobre todas las compras y su remedio es esta
-- misma migración. Sin ella, el candado dejaría sin forma de anular.
-- Solo lee `creditos.compra_id`, así que no depende del pack de amigas.

create or replace function public.compras_anular_sin_clases_vivas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vivas int;
begin
  if old.deleted_at is null and new.deleted_at is not null then
    select coalesce(sum(cantidad_disponible), 0) into v_vivas
    from public.creditos
    where compra_id = new.id
      and cantidad_disponible > 0
      and fecha_vencimiento > now();

    if v_vivas > 0 then
      raise exception 'Esta compra todavía tiene % clases sin usar en sus lotes. Quítalas primero (PRD-0024) y después anúlala', v_vivas
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists compras_anular_sin_clases_vivas on public.compras;
create trigger compras_anular_sin_clases_vivas
  before update of deleted_at on public.compras
  for each row execute function public.compras_anular_sin_clases_vivas();

-- ---------------------------------------------------------------------------
-- 6. Comprobaciones
-- ---------------------------------------------------------------------------

do $$
begin
  if has_function_privilege('authenticated', 'public.revocar_creditos(uuid, int, text, uuid)', 'execute')
     or has_function_privilege('anon', 'public.revocar_creditos(uuid, int, text, uuid)', 'execute') then
    raise exception 'revocar_creditos quedó abierta a una sesión.';
  end if;

  if has_function_privilege('anon', 'public.revocaciones_recientes(int)', 'execute') then
    raise exception 'revocaciones_recientes quedó abierta a anon.';
  end if;

  if has_column_privilege('authenticated', 'public.movimientos_credito', 'motivo', 'select') then
    raise exception 'El motivo de los movimientos se volvió a leer con sesión.';
  end if;
end $$;
