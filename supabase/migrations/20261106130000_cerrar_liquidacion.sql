-- PRD-0010 parte 3, paso E — Cerrar y pagar son dos pasos (Felipe, 06/11/2026).
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, con
-- aprobación de Felipe en ese mismo mensaje, por el nombre de este archivo.
--
-- 🔴 DEPENDE DE 20261105140000_liquidacion_profesoras.sql.
--
-- Hasta acá no había fila hasta pagar. Felipe pidió poder cerrar el mes primero
-- y marcarlo pagado cuando transfirió, así que:
--
--  1. liquidaciones_profesoras nace al cerrar, con el monto y el detalle
--     congelados. El comprobante, el egreso y `pagada_*` llegan al pagar.
--  2. El libro no se edita: un disparador impide cambiar lo congelado y borrar
--     filas. Si algo sale mal se anula y se cierra de nuevo: se agrega, no se
--     corrige encima.
--  3. Los insumos dicen cuándo cae la recuperación: puede ser en otro mes, y
--     ahí se paga en ese otro.
--  4. cerrar_liquidacion(); pagar_liquidacion() pasa a recibir la liquidación.
--  5. mis_liquidaciones() devuelve también las cerradas sin pagar.
--  6. El bucket del comprobante, que faltaba.
--
-- Idempotente.

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'liquidaciones_profesoras'
  ) then
    raise exception 'Falta 20261105140000_liquidacion_profesoras.sql: esta migración depende de ella.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. La fila nace al cerrar
-- ---------------------------------------------------------------------------

alter table public.liquidaciones_profesoras
  add column if not exists cerrada_at timestamptz not null default now(),
  add column if not exists cerrada_por uuid references public.perfiles (id);

alter table public.liquidaciones_profesoras
  alter column comprobante_path drop not null,
  alter column egreso_id drop not null,
  alter column pagada_at drop not null,
  alter column pagada_at drop default,
  alter column pagada_por drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'liquidaciones_pago_completo') then
    alter table public.liquidaciones_profesoras add constraint liquidaciones_pago_completo check (
      (pagada_at is null and pagada_por is null and comprobante_path is null and egreso_id is null)
      or (pagada_at is not null and pagada_por is not null and comprobante_path is not null and egreso_id is not null)
    );
  end if;
end $$;

comment on table public.liquidaciones_profesoras is
  'PRD-0010 parte 3: lo que se le debe a una profesora por un mes, congelado al cerrar. Al pagar se agregan el comprobante y el egreso. Solo owner. La profesora ve lo suyo por mis_liquidaciones(), sin comprobante (ADR-0008). Nunca se edita: se anula y se cierra de nuevo.';

-- ---------------------------------------------------------------------------
-- 2. El libro no se edita
-- ---------------------------------------------------------------------------

create or replace function public.liquidaciones_no_se_editan()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Una liquidación no se borra: se anula' using errcode = '22023';
  end if;

  if (new.profesora_id, new.mes, new.monto_clp, new.detalle, new.huella, new.cerrada_at, new.cerrada_por)
     is distinct from
     (old.profesora_id, old.mes, old.monto_clp, old.detalle, old.huella, old.cerrada_at, old.cerrada_por) then
    raise exception 'Lo congelado de una liquidación no se cambia: se anula y se cierra de nuevo'
      using errcode = '22023';
  end if;

  if old.pagada_at is not null
     and (new.pagada_at, new.pagada_por, new.comprobante_path, new.egreso_id)
         is distinct from
         (old.pagada_at, old.pagada_por, old.comprobante_path, old.egreso_id) then
    raise exception 'Un pago registrado no se cambia: se anula' using errcode = '22023';
  end if;

  if old.anulada_at is not null
     and (new.anulada_at, new.anulada_por, new.motivo_anulacion, new.deleted_at)
         is distinct from
         (old.anulada_at, old.anulada_por, old.motivo_anulacion, old.deleted_at) then
    raise exception 'Una liquidación anulada no vuelve' using errcode = '22023';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists liquidaciones_no_se_editan on public.liquidaciones_profesoras;
create trigger liquidaciones_no_se_editan
  before update or delete on public.liquidaciones_profesoras
  for each row execute function public.liquidaciones_no_se_editan();

-- ---------------------------------------------------------------------------
-- 3. Cuándo cae la recuperación
-- ---------------------------------------------------------------------------
-- Cambia el tipo de retorno, así que se recrean. La huella no cambia: mover la
-- fecha de una recuperación dentro del mismo estado no mueve el monto.

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
  recupera_inicio timestamptz
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
         ori.inicio
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
  cross join public.bordes_de_mes(p_mes) b
  where cl.inicio >= b.desde and cl.inicio < b.hasta
    and (cl.tipo = 'parrilla' or cl.publicada_at is not null)
  order by cl.inicio, cl.id;
$$;

revoke all on function public.insumos_del_mes(date) from public, anon, authenticated, service_role;

create function public.insumos_liquidacion(p_mes date)
returns table (
  clase_id uuid, profesora_id uuid, curso_id uuid, curso text, sede text,
  inicio timestamptz, fin timestamptz, tipo text, estado text, causa text,
  profesora_se_presento boolean, recuperada boolean, recupera_clase_id uuid,
  creditos_consumidos int, recuperacion_inicio timestamptz, recupera_inicio timestamptz
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

create function public.mis_insumos_liquidacion(p_mes date)
returns table (
  clase_id uuid, curso_id uuid, curso text, sede text,
  inicio timestamptz, fin timestamptz, tipo text, estado text, causa text,
  profesora_se_presento boolean, recuperada boolean, creditos_consumidos int,
  recuperacion_inicio timestamptz, recupera_inicio timestamptz
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
         i.recuperacion_inicio, i.recupera_inicio
  from public.insumos_del_mes(p_mes) i
  where i.profesora_id = v_profesora;
end;
$$;

revoke all on function public.mis_insumos_liquidacion(date) from public, anon;
grant execute on function public.mis_insumos_liquidacion(date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Cerrar y pagar
-- ---------------------------------------------------------------------------

/**
 * Cerrar: congela el monto, el detalle y la huella. El monto lo calculó
 * lib/dominio con los mismos insumos; acá se comprueba que no cambiaron desde
 * que se miraron y que el mes se puede cerrar.
 *
 * **Cerrar dos veces no duplica:** con la misma huella devuelve la fila que ya
 * estaba. Con otra, rebota: ese mes está cerrado con otro cálculo.
 */
create or replace function public.cerrar_liquidacion(
  p_actor_user_id uuid,
  p_profesora_id uuid,
  p_mes date,
  p_monto_clp int,
  p_detalle jsonb,
  p_huella text
)
returns public.liquidaciones_profesoras
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_mes date := date_trunc('month', p_mes)::date;
  v_sin_causa int;
  v_fila public.liquidaciones_profesoras;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;
  if v_actor.id is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('owner') then
    raise exception 'Solo el owner cierra una liquidación' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profesoras where id = p_profesora_id) then
    raise exception 'Esa profesora no existe' using errcode = 'P0002';
  end if;

  -- Serializa dos cierres del mismo mes a la misma profesora.
  perform 1 from public.profesoras where id = p_profesora_id for update;

  select * into v_fila from public.liquidaciones_profesoras
  where profesora_id = p_profesora_id and mes = v_mes and deleted_at is null;
  if v_fila.id is not null then
    if v_fila.huella = p_huella then
      return v_fila;
    end if;
    raise exception 'Ese mes ya está cerrado con otro cálculo. Recarga la página'
      using errcode = '23514';
  end if;

  if v_mes < date '2026-11-01' then
    raise exception 'La liquidación empieza en noviembre de 2026: los meses anteriores se pagaron a mano'
      using errcode = '22023';
  end if;
  if public.hoy_santiago() < (v_mes + interval '1 month')::date then
    raise exception 'El mes todavía no termina' using errcode = '22023';
  end if;
  if p_monto_clp is null or p_monto_clp <= 0 then
    raise exception 'El monto tiene que ser mayor que cero' using errcode = '22023';
  end if;
  if not exists (select 1 from public.costos_profesoras where profesora_id = p_profesora_id) then
    raise exception 'Sin costo cargado para esa profesora' using errcode = '22023';
  end if;

  select count(*) into v_sin_causa
  from public.insumos_del_mes(v_mes) i
  where i.profesora_id = p_profesora_id
    and i.tipo = 'parrilla'
    and i.estado in ('cancelada', 'no_dictada')
    and i.causa is null;
  if v_sin_causa > 0 then
    raise exception '% clases canceladas o no dictadas sin causa: clasifícalas antes de cerrar', v_sin_causa
      using errcode = '22023';
  end if;

  if p_huella is distinct from public.huella_del_mes(p_profesora_id, v_mes) then
    raise exception 'El cálculo cambió mientras lo mirabas. Recarga la página antes de cerrar'
      using errcode = '22023';
  end if;

  insert into public.liquidaciones_profesoras
    (profesora_id, mes, monto_clp, detalle, huella, cerrada_por)
  values
    (p_profesora_id, v_mes, p_monto_clp, coalesce(p_detalle, '{}'::jsonb), p_huella, v_actor.id)
  returning * into v_fila;

  return v_fila;
end;
$$;

revoke all on function public.cerrar_liquidacion(uuid, uuid, date, int, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.cerrar_liquidacion(uuid, uuid, date, int, jsonb, text)
  to service_role;

drop function if exists public.pagar_liquidacion(uuid, uuid, date, int, jsonb, text, text);

/**
 * "Pagado": agrega el comprobante y el egreso a una liquidación cerrada, en una
 * transacción (PRD §8.3). Lo que se transfirió es lo congelado al cerrar: si los
 * insumos cambiaron desde entonces, rebota. Se anula y se cierra de nuevo.
 */
create or replace function public.pagar_liquidacion(
  p_actor_user_id uuid,
  p_liquidacion_id uuid,
  p_comprobante_path text
)
returns public.liquidaciones_profesoras
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_fila public.liquidaciones_profesoras;
  v_profesora public.profesoras;
  v_egreso public.egresos;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;
  if v_actor.id is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('owner') then
    raise exception 'Solo el owner marca una liquidación como pagada' using errcode = '42501';
  end if;

  select * into v_fila from public.liquidaciones_profesoras
  where id = p_liquidacion_id for update;
  if v_fila.id is null or v_fila.deleted_at is not null then
    raise exception 'Esa liquidación no existe o está anulada' using errcode = 'P0002';
  end if;
  if v_fila.pagada_at is not null then
    raise exception 'Ese mes ya está pagado' using errcode = '23514';
  end if;
  if coalesce(btrim(p_comprobante_path), '') = '' then
    raise exception 'Falta el comprobante de la transferencia' using errcode = '22023';
  end if;
  if v_fila.huella is distinct from public.huella_del_mes(v_fila.profesora_id, v_fila.mes) then
    raise exception 'El cálculo cambió desde que se cerró. Anula el cierre y vuelve a cerrar'
      using errcode = '22023';
  end if;

  select * into v_profesora from public.profesoras where id = v_fila.profesora_id;

  insert into public.egresos
    (fecha, categoria, descripcion, monto_clp, comprobante_path, registrado_por)
  values
    (public.hoy_santiago(), 'sueldo_profesora',
     format('Liquidación de %s, %s', v_profesora.nombre, to_char(v_fila.mes, 'MM/YYYY')),
     v_fila.monto_clp, p_comprobante_path, v_actor.id)
  returning * into v_egreso;

  update public.liquidaciones_profesoras
  set pagada_at = now(), pagada_por = v_actor.id,
      comprobante_path = p_comprobante_path, egreso_id = v_egreso.id
  where id = v_fila.id
  returning * into v_fila;

  return v_fila;
end;
$$;

revoke all on function public.pagar_liquidacion(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.pagar_liquidacion(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Lo que ve la profesora
-- ---------------------------------------------------------------------------

drop function if exists public.mis_liquidaciones();

/** Lo suyo, cerrado o pagado. Sin comprobante, sin quién cerró ni quién pagó (ADR-0008). */
create function public.mis_liquidaciones()
returns table (mes date, monto_clp int, cerrada_at timestamptz, pagada_at timestamptz, detalle jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select mes, monto_clp, cerrada_at, pagada_at, detalle
  from public.liquidaciones_profesoras
  where profesora_id = public.mi_profesora_id()
    and deleted_at is null
  order by mes desc;
$$;

revoke all on function public.mis_liquidaciones() from public, anon;
grant execute on function public.mis_liquidaciones() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. El comprobante
-- ---------------------------------------------------------------------------
-- Sin políticas sobre storage.objects para anon ni authenticated: solo la
-- service role lee y escribe. PNG además de lo de egresos: el comprobante de una
-- transferencia suele ser un pantallazo (PRD §8.4).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes-liquidaciones', 'comprobantes-liquidaciones', false, 2097152,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 7. Comprobaciones
-- ---------------------------------------------------------------------------

do $$
begin
  if has_function_privilege('authenticated', 'public.cerrar_liquidacion(uuid, uuid, date, int, jsonb, text)', 'execute')
     or has_function_privilege('anon', 'public.cerrar_liquidacion(uuid, uuid, date, int, jsonb, text)', 'execute')
     or has_function_privilege('authenticated', 'public.pagar_liquidacion(uuid, uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.pagar_liquidacion(uuid, uuid, text)', 'execute') then
    raise exception 'cerrar_liquidacion o pagar_liquidacion quedó abierta a una sesión.';
  end if;

  if has_function_privilege('anon', 'public.insumos_del_mes(date)', 'execute')
     or has_function_privilege('authenticated', 'public.insumos_del_mes(date)', 'execute') then
    raise exception 'insumos_del_mes no chequea rol y quedó abierta.';
  end if;
end $$;
