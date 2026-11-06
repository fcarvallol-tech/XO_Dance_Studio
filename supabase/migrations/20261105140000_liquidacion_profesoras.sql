-- PRD-0010 parte 3 — Liquidación de profesoras: el modelo.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, con
-- aprobación de Felipe en ese mismo mensaje, por el nombre de este archivo.
--
-- ---------------------------------------------------------------------------
-- La regla de pago NO vive acá
-- ---------------------------------------------------------------------------
-- Toda la regla —el variable con su umbral, las causas, la recuperación, el
-- incentivo en dos tramos, el piso de 4— vive en `lib/dominio/liquidacion.ts`,
-- con sus tests. Esta migración entrega **insumos** (cada clase con su estado,
-- su causa y cuántos créditos se consumieron) y **guarda lo pagado**. Ningún
-- monto se calcula en SQL: si la regla estuviera en los dos lados, habría dos
-- versiones de la misma decisión y una sola con tests.
--
-- ¿Y cómo se asegura que lo que se congela al pagar es lo que se vio? Con una
-- **huella**: `huella_liquidacion()` resume los insumos de esa profesora y ese
-- mes. La pantalla la recibe junto con los insumos; `pagar_liquidacion()` la
-- recalcula adentro y rebota si cambió. Es el "el monto cambió mientras lo
-- mirabas" de PRD-0010 parte 3 §8.3, sin duplicar la regla.
--
-- ---------------------------------------------------------------------------
-- Lo que hace
-- ---------------------------------------------------------------------------
--  1. clases.estado admite `no_dictada`; clases.recupera_clase_id.
--  2. causas_de_clase: la causa y su detalle, **fuera de `clases`**, que es
--     pública entera desde 20260904120000. Un detalle como "la profe estaba
--     enferma" no puede quedar a la vista de cualquiera.
--  3. reasignaciones_de_clase: el registro de cada reemplazo.
--  4. El disparador que devuelve créditos actúa también al pasar a
--     `no_dictada`; una `no_dictada` no vuelve a `programada`.
--  5. costos_profesoras.umbral_variable (5) y la fila de Isi con la tarifa
--     general (Felipe, 04/11/2026).
--  6. liquidaciones_profesoras: lo pagado, congelado, con su comprobante y su
--     egreso. **Solo desde noviembre de 2026**: octubre se pagó a mano y no se
--     carga (Felipe, 04/11/2026).
--  7. Funciones: insumos para el owner, insumos para la profesora (los suyos y
--     sin nada de las alumnas, ADR-0008), huella, registrar_no_dictada,
--     marcar_recuperacion, reasignar_clase, pagar_liquidacion,
--     anular_liquidacion.
--  8. La clase de Pau del 03/11 queda clasificada como
--     `asistencia_insuficiente` (CONTEXT.md, 03/11/2026).
--  9. metricas_finanzas y metricas_demanda: dictada pasa a ser `programada` y
--     pasada. Con "distinta de cancelada" una `no_dictada` se contaba dictada.
--     `metricas_resumen` NO se toca acá: la redefine también la migración de
--     PRD-0024 (20261105130000) y la que se aplique última ganaría. Solo usa
--     ese criterio para `ultima_clase_at`, que es una fecha de referencia.
--
-- `reservar()` no se toca.
--
-- Idempotente.

-- ---------------------------------------------------------------------------
-- 1. clases: el estado nuevo y la recuperación
-- ---------------------------------------------------------------------------

do $$
declare
  v_nombre text;
begin
  for v_nombre in
    select conname from pg_constraint
    where conrelid = 'public.clases'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%estado%programada%cancelada%'
  loop
    execute format('alter table public.clases drop constraint %I', v_nombre);
  end loop;

  alter table public.clases add constraint clases_estado_valido
    check (estado in ('programada', 'cancelada', 'no_dictada'));
end $$;

comment on column public.clases.estado is
  'programada: sigue en pie (y si ya pasó, se presume dictada). cancelada: se avisó antes. no_dictada: llegó la hora y no hubo clase, registrado después (PRD-0010 parte 3 §7.1).';

alter table public.clases
  add column if not exists recupera_clase_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clases_recupera_clase_id_fkey') then
    alter table public.clases add constraint clases_recupera_clase_id_fkey
      foreign key (recupera_clase_id) references public.clases (id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clases_no_se_recupera_a_si_misma') then
    alter table public.clases add constraint clases_no_se_recupera_a_si_misma
      check (recupera_clase_id is null or recupera_clase_id <> id);
  end if;
end $$;

-- Una clase se recupera una sola vez: "se paga una sola vez, en la recuperación".
create unique index if not exists clases_una_recuperacion_por_clase
  on public.clases (recupera_clase_id) where recupera_clase_id is not null;

comment on column public.clases.recupera_clase_id is
  'PRD-0010 parte 3: esta clase es la recuperación de esa otra, que no se dictó. La original no se paga; esta se paga como cualquier dictada (Felipe, 03/11/2026).';

-- ---------------------------------------------------------------------------
-- 2. causas_de_clase
-- ---------------------------------------------------------------------------
-- Por qué una clase no se dictó o se canceló. Es lo que lee la liquidación.
-- Las cinco causas de Felipe (04/11/2026); se agregan más si aparecen casos que
-- no calcen. Qué paga cada una lo decide `efectoDeCausa()` en lib/dominio.

create table if not exists public.causas_de_clase (
  clase_id uuid primary key references public.clases (id) on delete restrict,
  causa text not null check (causa in (
    'sala_no_disponible', 'cambio_de_parrilla', 'ausencia_profesora',
    'sin_alumnas', 'asistencia_insuficiente'
  )),
  detalle text not null check (char_length(btrim(detalle)) >= 5),
  -- Null solo cuando la registró una migración (no hay sesión que atribuir).
  registrada_por uuid references public.perfiles (id),
  registrada_at timestamptz not null default now(),
  -- Si la profesora llegó (Felipe, 05/11/2026). El dato vale para las cinco
  -- causas, pero solo cambia el pago en `sala_no_disponible`: ahí paga la base
  -- aunque se recupere (Felipe, 06/11/2026; la regla está en lib/dominio). Vive
  -- acá y no en `clases` por lo mismo que la causa: `clases` es pública entera.
  profesora_se_presento boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists causas_de_clase_updated_at on public.causas_de_clase;
create trigger causas_de_clase_updated_at before update on public.causas_de_clase
  for each row execute function public.tocar_updated_at();

comment on table public.causas_de_clase is
  'PRD-0010 parte 3: por qué una clase de parrilla no se dictó o se canceló. Fuera de clases, que es pública: el detalle puede decir algo de la profesora. Solo admin y owner la leen; se escribe con registrar_no_dictada().';

alter table public.causas_de_clase enable row level security;
revoke all on public.causas_de_clase from anon, authenticated;
grant select on public.causas_de_clase to authenticated;
grant select, insert, update on public.causas_de_clase to service_role;

drop policy if exists causas_de_clase_admin_lee on public.causas_de_clase;
create policy causas_de_clase_admin_lee on public.causas_de_clase
  for select to authenticated using (public.tiene_nivel('admin'));

-- ---------------------------------------------------------------------------
-- 3. reasignaciones_de_clase
-- ---------------------------------------------------------------------------
-- Un reemplazo cambia `clases.profesora_id` —se le paga a quien dictó, decisión
-- 3 del 04/11/2026— y deja acá quién era, quién pasó a ser y quién lo hizo.
-- Solo se agrega.

create table if not exists public.reasignaciones_de_clase (
  id uuid primary key default gen_random_uuid(),
  clase_id uuid not null references public.clases (id) on delete restrict,
  profesora_anterior_id uuid not null references public.profesoras (id),
  profesora_nueva_id uuid not null references public.profesoras (id),
  registrada_por uuid not null references public.perfiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (profesora_anterior_id <> profesora_nueva_id)
);

create index if not exists reasignaciones_de_clase_clase_idx
  on public.reasignaciones_de_clase (clase_id, created_at desc);

alter table public.reasignaciones_de_clase enable row level security;
revoke all on public.reasignaciones_de_clase from anon, authenticated;
grant select on public.reasignaciones_de_clase to authenticated;
grant select, insert on public.reasignaciones_de_clase to service_role;

drop policy if exists reasignaciones_admin_lee on public.reasignaciones_de_clase;
create policy reasignaciones_admin_lee on public.reasignaciones_de_clase
  for select to authenticated using (public.tiene_nivel('admin'));

-- ---------------------------------------------------------------------------
-- 4. Devolver créditos también al no dictarse
-- ---------------------------------------------------------------------------
-- Copia de 20260904130000 §3 con una sola diferencia: actúa al pasar a
-- `cancelada` **o** a `no_dictada`. Para la alumna el efecto es el mismo: no
-- recibió la clase. Pasar de una a la otra no devuelve dos veces: la primera
-- ya dejó las reservas en `cancelada` y la función solo toca `confirmada` y
-- `pendiente_pago`.

create or replace function public.al_cancelar_clase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
begin
  if new.estado in ('cancelada', 'no_dictada')
     and old.estado not in ('cancelada', 'no_dictada') then
    select id into v_actor from public.perfiles where user_id = auth.uid();
    perform public.devolver_creditos_de_clase(new.id, v_actor);
  end if;

  return new;
end;
$$;

-- Una `no_dictada` no vuelve a `programada`: los créditos ya se devolvieron y
-- volver no los cobra de nuevo. Se corrige cambiando la causa (PRD §7.4).
create or replace function public.clases_no_dictada_no_vuelve()
returns trigger
language plpgsql
as $$
begin
  if old.estado = 'no_dictada' and new.estado = 'programada' then
    raise exception 'Una clase no dictada no vuelve a programada: sus créditos ya se devolvieron. Corrige la causa en vez de eso'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists clases_no_dictada_no_vuelve on public.clases;
create trigger clases_no_dictada_no_vuelve
  before update of estado on public.clases
  for each row execute function public.clases_no_dictada_no_vuelve();

-- ---------------------------------------------------------------------------
-- 5. Tarifas: el umbral y la fila de Isi
-- ---------------------------------------------------------------------------

alter table public.costos_profesoras
  add column if not exists umbral_variable int not null default 5
    check (umbral_variable >= 0);

comment on column public.costos_profesoras.umbral_variable is
  'El variable se paga desde el crédito siguiente a este: con 5, desde la sexta alumna (Felipe, 21/10/2026). Lo lee lib/dominio/liquidacion.ts.';

-- Isi entró el 05/10 y no tenía fila. Su tarifa es la general (Felipe,
-- 04/11/2026, decisión 2).
insert into public.costos_profesoras (profesora_id, base_hora_clp, variable_credito_clp, umbral_variable)
select id, 18000, 250, 5 from public.profesoras where slug = 'isi'
on conflict (profesora_id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. liquidaciones_profesoras: lo pagado
-- ---------------------------------------------------------------------------
-- No hay fila hasta que se paga (PRD §8.1): pendiente es un cálculo, pagado es
-- un hecho. Una vez escrita, el monto y el detalle no se recalculan nunca.

create table if not exists public.liquidaciones_profesoras (
  id uuid primary key default gen_random_uuid(),
  profesora_id uuid not null references public.profesoras (id) on delete restrict,
  -- Primer día del mes. Desde noviembre de 2026: octubre no se carga.
  mes date not null check (mes >= date '2026-11-01' and extract(day from mes) = 1),
  monto_clp int not null check (monto_clp > 0),
  -- La foto del cálculo al pagar: cada línea, los incentivos, la tarifa.
  detalle jsonb not null,
  -- La huella de los insumos con que se calculó: si hoy da otra, algo cambió
  -- por fuera de las funciones (PRD §8.6).
  huella text not null,
  comprobante_path text not null check (btrim(comprobante_path) <> ''),
  egreso_id uuid not null references public.egresos (id) on delete restrict,
  pagada_at timestamptz not null default now(),
  pagada_por uuid not null references public.perfiles (id),
  anulada_at timestamptz,
  anulada_por uuid references public.perfiles (id),
  motivo_anulacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((deleted_at is null) = (anulada_at is null)),
  check (anulada_at is null or (anulada_por is not null and char_length(btrim(motivo_anulacion)) >= 5))
);

create unique index if not exists liquidaciones_una_vigente_por_mes
  on public.liquidaciones_profesoras (profesora_id, mes) where deleted_at is null;

drop trigger if exists liquidaciones_profesoras_updated_at on public.liquidaciones_profesoras;
create trigger liquidaciones_profesoras_updated_at before update on public.liquidaciones_profesoras
  for each row execute function public.tocar_updated_at();

comment on table public.liquidaciones_profesoras is
  'PRD-0010 parte 3: lo que se le pagó a una profesora por un mes, congelado con su detalle, su comprobante y su egreso. Solo owner. La profesora ve lo suyo por mis_liquidaciones(), sin comprobante (ADR-0008).';

alter table public.liquidaciones_profesoras enable row level security;
revoke all on public.liquidaciones_profesoras from anon, authenticated;
grant select on public.liquidaciones_profesoras to authenticated;
grant select, insert, update on public.liquidaciones_profesoras to service_role;

drop policy if exists liquidaciones_owner_lee on public.liquidaciones_profesoras;
create policy liquidaciones_owner_lee on public.liquidaciones_profesoras
  for select to authenticated using (public.tiene_nivel('owner'));

-- ---------------------------------------------------------------------------
-- 7. Funciones
-- ---------------------------------------------------------------------------

/** Los bordes de un mes de Santiago, como instantes. */
create or replace function public.bordes_de_mes(p_mes date)
returns table (desde timestamptz, hasta timestamptz)
language sql
immutable
as $$
  select (date_trunc('month', p_mes)::timestamp at time zone 'America/Santiago'),
         ((date_trunc('month', p_mes) + interval '1 month')::timestamp at time zone 'America/Santiago');
$$;

/**
 * El día de hoy en Santiago. Una sola fuente para "¿ya terminó el mes?" y para
 * la fecha del egreso al pagar. Que sea una función y no `now()` repetido
 * permite probar el pago de un mes cerrado sin esperar a que se cierre.
 */
create or replace function public.hoy_santiago()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Santiago')::date;
$$;

revoke all on function public.hoy_santiago() from public, anon;
grant execute on function public.hoy_santiago() to authenticated, service_role;

/** Si esa profesora ya tiene pagado el mes de ese instante. El candado de §7.4. */
create or replace function public.mes_pagado(p_profesora_id uuid, p_instante timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.liquidaciones_profesoras
    where profesora_id = p_profesora_id
      and deleted_at is null
      and mes = date_trunc('month', (p_instante at time zone 'America/Santiago'))::date
  );
$$;

/**
 * Los insumos de un mes: una fila por clase, de todas las profesoras. **Sin
 * chequeo de rol y sin grant a nadie**: la llaman solo las funciones de abajo,
 * que sí chequean. No lee `perfiles`: cuenta reservas, no las nombra.
 *
 * Créditos consumidos: el mismo predicado que atribuye ingreso y que usa
 * metricas_finanzas (PRD-0010 §7.1.3) — con crédito, sin devolver, fuera de
 * pendiente_pago, expirada y liberada.
 */
create or replace function public.insumos_del_mes(p_mes date)
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
  creditos_consumidos int
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
         exists (
           select 1 from public.clases r
           where r.recupera_clase_id = cl.id
             and r.estado not in ('cancelada', 'no_dictada')
         ),
         cl.recupera_clase_id,
         (select count(*)::int from public.reservas r
           where r.clase_id = cl.id
             and r.credito_id is not null
             and r.credito_devuelto = false
             and r.estado not in ('pendiente_pago', 'expirada', 'liberada'))
  from public.clases cl
  join public.cursos cu on cu.id = cl.curso_id
  join public.sedes se on se.id = cl.sede_id
  left join public.causas_de_clase ca on ca.clase_id = cl.id and ca.deleted_at is null
  cross join public.bordes_de_mes(p_mes) b
  where cl.inicio >= b.desde and cl.inicio < b.hasta
    and (cl.tipo = 'parrilla' or cl.publicada_at is not null)
  order by cl.inicio, cl.id;
$$;

revoke all on function public.insumos_del_mes(date) from public, anon, authenticated, service_role;
revoke all on function public.bordes_de_mes(date) from public, anon;
grant execute on function public.bordes_de_mes(date) to authenticated, service_role;
revoke all on function public.mes_pagado(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.mes_pagado(uuid, timestamptz) to service_role;

/**
 * La huella de los insumos de una profesora en un mes, con su tarifa. Cambia
 * si cambia cualquier cosa que mueva el monto: una clase, su estado, su causa,
 * si la profesora se presentó, sus créditos, una recuperación o la tarifa.
 */
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
                  i.profesora_se_presento, i.recuperada, i.creditos_consumidos),
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

/** Owner: los insumos del mes, de todas, más la huella de cada profesora. */
create or replace function public.insumos_liquidacion(p_mes date)
returns table (
  clase_id uuid, profesora_id uuid, curso_id uuid, curso text, sede text,
  inicio timestamptz, fin timestamptz, tipo text, estado text, causa text,
  profesora_se_presento boolean, recuperada boolean, recupera_clase_id uuid,
  creditos_consumidos int
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

create or replace function public.huellas_liquidacion(p_mes date)
returns table (profesora_id uuid, huella text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.tiene_nivel('owner') then
    raise exception 'Solo el owner ve la liquidación' using errcode = '42501';
  end if;
  return query
  select p.id, public.huella_del_mes(p.id, p_mes) from public.profesoras p;
end;
$$;

revoke all on function public.insumos_liquidacion(date) from public, anon;
grant execute on function public.insumos_liquidacion(date) to authenticated, service_role;
revoke all on function public.huellas_liquidacion(date) from public, anon;
grant execute on function public.huellas_liquidacion(date) to authenticated, service_role;

/**
 * La profesora: **solo sus clases**, filtrado adentro por la sesión (ADR-0008).
 * El tipo de retorno es el contrato: ningún dato de una alumna —la función no
 * lee `perfiles`—, ni ingreso, ni precios, ni costos de sala. Admin, que no
 * tiene profesora asociada, recibe cero filas.
 */
create or replace function public.mis_insumos_liquidacion(p_mes date)
returns table (
  clase_id uuid, curso_id uuid, curso text, sede text,
  inicio timestamptz, fin timestamptz, tipo text, estado text, causa text,
  profesora_se_presento boolean, recuperada boolean, creditos_consumidos int
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
         i.causa, i.profesora_se_presento, i.recuperada, i.creditos_consumidos
  from public.insumos_del_mes(p_mes) i
  where i.profesora_id = v_profesora;
end;
$$;

/** La profesora: su tarifa y lo que se le pagó. Sin comprobante, sin quién pagó. */
create or replace function public.mi_tarifa()
returns table (base_hora_clp int, variable_credito_clp int, umbral_variable int)
language sql
stable
security definer
set search_path = public
as $$
  select base_hora_clp, variable_credito_clp, umbral_variable
  from public.costos_profesoras
  where profesora_id = public.mi_profesora_id();
$$;

create or replace function public.mis_liquidaciones()
returns table (mes date, monto_clp int, pagada_at timestamptz, detalle jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select mes, monto_clp, pagada_at, detalle
  from public.liquidaciones_profesoras
  where profesora_id = public.mi_profesora_id()
    and deleted_at is null
  order by mes desc;
$$;

revoke all on function public.mis_insumos_liquidacion(date) from public, anon;
grant execute on function public.mis_insumos_liquidacion(date) to authenticated, service_role;
revoke all on function public.mi_tarifa() from public, anon;
grant execute on function public.mi_tarifa() to authenticated, service_role;
revoke all on function public.mis_liquidaciones() from public, anon;
grant execute on function public.mis_liquidaciones() to authenticated, service_role;

/**
 * Registrar por qué una clase de parrilla no se dictó (PRD §7.4). Admin u
 * owner, no la profesora: es parte interesada.
 *
 * - `programada` y ya empezó → pasa a `no_dictada` (el disparador devuelve los
 *   créditos) y queda la causa.
 * - `cancelada` o `no_dictada` → solo se registra o se cambia la causa. Así se
 *   clasifican también las cancelaciones, que deciden igual si se paga.
 * - Una futura no se "no dicta": se cancela.
 * - `p_profesora_se_presento` se pasa cada vez, apagado por defecto: reclasificar
 *   sin prenderlo lo apaga. Lo que decide cuánto paga es lib/dominio.
 * - Si el mes de esa clase ya se le pagó a esa profesora, rebota: lo pagado no
 *   se mueve por la puerta de atrás (§8.6).
 */
create or replace function public.registrar_no_dictada(
  p_actor_user_id uuid,
  p_clase_id uuid,
  p_causa text,
  p_detalle text,
  p_profesora_se_presento boolean default false
)
returns public.causas_de_clase
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_clase public.clases;
  v_fila public.causas_de_clase;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;
  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  select * into v_clase from public.clases where id = p_clase_id for update;
  if v_clase is null then
    raise exception 'Esa clase no existe' using errcode = 'P0002';
  end if;
  if v_clase.tipo <> 'parrilla' then
    raise exception 'Las clases especiales se pagan con otra regla' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_detalle, ''))) < 5 then
    raise exception 'Escribe qué pasó (al menos 5 caracteres)' using errcode = '22023';
  end if;
  if public.mes_pagado(v_clase.profesora_id, v_clase.inicio) then
    raise exception 'Ese mes ya se le pagó a esa profesora. Si esto cambia lo que se le debía, va como ajuste en el mes siguiente'
      using errcode = '22023';
  end if;

  if v_clase.estado = 'programada' then
    if v_clase.inicio > now() then
      raise exception 'Esa clase todavía no ocurre: se cancela, no se marca como no dictada'
        using errcode = '22023';
    end if;
    update public.clases set estado = 'no_dictada' where id = v_clase.id;
  end if;

  insert into public.causas_de_clase
    (clase_id, causa, detalle, registrada_por, registrada_at, profesora_se_presento)
  values (v_clase.id, p_causa, btrim(p_detalle), v_actor.id, now(),
          coalesce(p_profesora_se_presento, false))
  on conflict (clase_id) do update
    set causa = excluded.causa, detalle = excluded.detalle,
        registrada_por = excluded.registrada_por,
        profesora_se_presento = excluded.profesora_se_presento,
        deleted_at = null
  returning * into v_fila;

  return v_fila;
end;
$$;

/** La recuperación de una clase que no se dictó. Una sola por clase. */
create or replace function public.marcar_recuperacion(
  p_actor_user_id uuid,
  p_recuperacion_id uuid,
  p_original_id uuid
)
returns public.clases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_original public.clases;
  v_recuperacion public.clases;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;
  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  select * into v_original from public.clases where id = p_original_id for update;
  select * into v_recuperacion from public.clases where id = p_recuperacion_id for update;
  if v_original is null or v_recuperacion is null then
    raise exception 'Esa clase no existe' using errcode = 'P0002';
  end if;
  if v_original.id = v_recuperacion.id then
    raise exception 'Una clase no se recupera a sí misma' using errcode = '22023';
  end if;
  if v_original.estado not in ('cancelada', 'no_dictada') then
    raise exception 'Solo se recupera una clase cancelada o no dictada' using errcode = '22023';
  end if;
  if v_recuperacion.estado <> 'programada' or v_recuperacion.tipo <> 'parrilla' then
    raise exception 'La recuperación tiene que ser una clase de parrilla en pie' using errcode = '22023';
  end if;
  if v_original.curso_id <> v_recuperacion.curso_id then
    raise exception 'La recuperación tiene que ser del mismo curso' using errcode = '22023';
  end if;
  if public.mes_pagado(v_original.profesora_id, v_original.inicio)
     or public.mes_pagado(v_recuperacion.profesora_id, v_recuperacion.inicio) then
    raise exception 'Uno de los dos meses ya se pagó. Si esto cambia lo que se debía, va como ajuste'
      using errcode = '22023';
  end if;

  update public.clases set recupera_clase_id = v_original.id
  where id = v_recuperacion.id
  returning * into v_recuperacion;

  return v_recuperacion;
end;
$$;

/** Un reemplazo: la clase pasa a quien la dictó, y queda registrado. */
create or replace function public.reasignar_clase(
  p_actor_user_id uuid,
  p_clase_id uuid,
  p_profesora_nueva_id uuid
)
returns public.clases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_clase public.clases;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;
  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  select * into v_clase from public.clases where id = p_clase_id for update;
  if v_clase is null then
    raise exception 'Esa clase no existe' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.profesoras where id = p_profesora_nueva_id) then
    raise exception 'Esa profesora no existe' using errcode = 'P0002';
  end if;
  if v_clase.profesora_id = p_profesora_nueva_id then
    return v_clase;
  end if;
  if public.mes_pagado(v_clase.profesora_id, v_clase.inicio)
     or public.mes_pagado(p_profesora_nueva_id, v_clase.inicio) then
    raise exception 'Ese mes ya se le pagó a una de las dos. Si esto cambia lo que se debía, va como ajuste'
      using errcode = '22023';
  end if;

  insert into public.reasignaciones_de_clase
    (clase_id, profesora_anterior_id, profesora_nueva_id, registrada_por)
  values (v_clase.id, v_clase.profesora_id, p_profesora_nueva_id, v_actor.id);

  update public.clases set profesora_id = p_profesora_nueva_id
  where id = v_clase.id
  returning * into v_clase;

  return v_clase;
end;
$$;

revoke all on function public.registrar_no_dictada(uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.registrar_no_dictada(uuid, uuid, text, text, boolean) to service_role;
revoke all on function public.marcar_recuperacion(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.marcar_recuperacion(uuid, uuid, uuid) to service_role;
revoke all on function public.reasignar_clase(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.reasignar_clase(uuid, uuid, uuid) to service_role;

/**
 * "Pagado": congela el monto, el detalle y la huella, y registra el egreso, en
 * una sola transacción (PRD §8.3). El monto lo calculó lib/dominio con los
 * mismos insumos; acá se comprueba que esos insumos no cambiaron desde que se
 * miraron —la huella— y que el mes se puede pagar.
 */
create or replace function public.pagar_liquidacion(
  p_actor_user_id uuid,
  p_profesora_id uuid,
  p_mes date,
  p_monto_clp int,
  p_detalle jsonb,
  p_huella text,
  p_comprobante_path text
)
returns public.liquidaciones_profesoras
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_profesora public.profesoras;
  v_mes date := date_trunc('month', p_mes)::date;
  v_sin_causa int;
  v_egreso public.egresos;
  v_fila public.liquidaciones_profesoras;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;
  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('owner') then
    raise exception 'Solo el owner marca una liquidación como pagada' using errcode = '42501';
  end if;

  select * into v_profesora from public.profesoras where id = p_profesora_id;
  if v_profesora is null then
    raise exception 'Esa profesora no existe' using errcode = 'P0002';
  end if;

  if v_mes < date '2026-11-01' then
    raise exception 'La liquidación empieza en noviembre de 2026: los meses anteriores se pagaron a mano'
      using errcode = '22023';
  end if;
  if public.hoy_santiago() < (v_mes + interval '1 month')::date then
    raise exception 'El mes todavía no termina' using errcode = '22023';
  end if;
  if coalesce(btrim(p_comprobante_path), '') = '' then
    raise exception 'Falta el comprobante de la transferencia' using errcode = '22023';
  end if;
  if p_monto_clp is null or p_monto_clp <= 0 then
    raise exception 'El monto tiene que ser mayor que cero' using errcode = '22023';
  end if;
  if not exists (select 1 from public.costos_profesoras where profesora_id = p_profesora_id) then
    raise exception 'Sin costo cargado para esa profesora' using errcode = '22023';
  end if;

  -- Serializa dos pagos del mismo mes a la misma profesora.
  perform 1 from public.profesoras where id = p_profesora_id for update;

  if exists (
    select 1 from public.liquidaciones_profesoras
    where profesora_id = p_profesora_id and mes = v_mes and deleted_at is null
  ) then
    raise exception 'Ese mes ya está pagado' using errcode = '23514';
  end if;

  select count(*) into v_sin_causa
  from public.insumos_del_mes(v_mes) i
  where i.profesora_id = p_profesora_id
    and i.tipo = 'parrilla'
    and i.estado in ('cancelada', 'no_dictada')
    and i.causa is null;
  if v_sin_causa > 0 then
    raise exception '% clases canceladas o no dictadas sin causa: clasifícalas antes de pagar', v_sin_causa
      using errcode = '22023';
  end if;

  if p_huella is distinct from public.huella_del_mes(p_profesora_id, v_mes) then
    raise exception 'El cálculo cambió mientras lo mirabas. Recarga la página antes de marcarlo'
      using errcode = '22023';
  end if;

  insert into public.egresos
    (fecha, categoria, descripcion, monto_clp, comprobante_path, registrado_por)
  values
    (public.hoy_santiago(), 'sueldo_profesora',
     format('Liquidación de %s, %s', v_profesora.nombre, to_char(v_mes, 'MM/YYYY')),
     p_monto_clp, p_comprobante_path, v_actor.id)
  returning * into v_egreso;

  insert into public.liquidaciones_profesoras
    (profesora_id, mes, monto_clp, detalle, huella, comprobante_path, egreso_id, pagada_por)
  values
    (p_profesora_id, v_mes, p_monto_clp, coalesce(p_detalle, '{}'::jsonb), p_huella,
     p_comprobante_path, v_egreso.id, v_actor.id)
  returning * into v_fila;

  return v_fila;
end;
$$;

/** Anular un pago marcado por error (PRD §8.5): no borra nada, y anula su egreso. */
create or replace function public.anular_liquidacion(
  p_actor_user_id uuid,
  p_liquidacion_id uuid,
  p_motivo text
)
returns public.liquidaciones_profesoras
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_fila public.liquidaciones_profesoras;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;
  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('owner') then
    raise exception 'Solo el owner anula un pago' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe por qué se anula (al menos 5 caracteres)' using errcode = '22023';
  end if;

  select * into v_fila from public.liquidaciones_profesoras
  where id = p_liquidacion_id for update;
  if v_fila is null then
    raise exception 'Ese pago no existe' using errcode = 'P0002';
  end if;
  if v_fila.deleted_at is not null then
    return v_fila;
  end if;

  update public.egresos
  set deleted_at = now(), anulado_por = v_actor.id, motivo_anulacion = btrim(p_motivo)
  where id = v_fila.egreso_id and deleted_at is null;

  update public.liquidaciones_profesoras
  set anulada_at = now(), anulada_por = v_actor.id, motivo_anulacion = btrim(p_motivo),
      deleted_at = now()
  where id = v_fila.id
  returning * into v_fila;

  return v_fila;
end;
$$;

revoke all on function public.pagar_liquidacion(uuid, uuid, date, int, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.pagar_liquidacion(uuid, uuid, date, int, jsonb, text, text)
  to service_role;
revoke all on function public.anular_liquidacion(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.anular_liquidacion(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 8. La clase de Pau del 03/11/2026
-- ---------------------------------------------------------------------------
-- La Reggaeton Femme de Pau en Los Leones, 18:00, cancelada por
-- 20261103210000. No se dictó porque no llegaron alumnas suficientes, Pau no
-- faltó, y se va a recuperar (CONTEXT.md, 03/11/2026). Si no se recupera, paga
-- la base. `profesora_se_presento` queda apagado (Felipe, 06/11/2026): ese
-- campo solo cambia el pago en `sala_no_disponible`, y esta fecha se le paga
-- una sola vez, el día que la recupere.
--
-- En una base sin esa clase (staging, la base local) no hace nada.

do $$
declare
  v_clase public.clases;
begin
  select cl.* into v_clase
  from public.clases cl
  join public.profesoras p on p.id = cl.profesora_id
  join public.cursos cu on cu.id = cl.curso_id
  join public.sedes s on s.id = cl.sede_id
  where p.slug = 'pau' and cu.slug = 'reggaeton-femme' and s.slug = 'seduccion-latina'
    and cl.fecha = date '2026-11-03'
    and (cl.inicio at time zone 'America/Santiago')::time = '18:00';

  if v_clase.id is null then
    raise notice 'No está la clase de Pau del 03/11: nada que clasificar.';
    return;
  end if;

  insert into public.causas_de_clase (clase_id, causa, detalle, registrada_por, registrada_at)
  values (v_clase.id, 'asistencia_insuficiente',
          'No llegaron alumnas suficientes el primer día de uso del sitio. Pau no faltó. Se va a recuperar (Felipe, 03/11/2026).',
          null, v_clase.updated_at)
  on conflict (clase_id) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- 9. metricas_finanzas y metricas_demanda: dictada es programada y pasada
-- ---------------------------------------------------------------------------
-- Copias de 20260930150000 y 20260910120000 con una línea cambiada cada una.

create or replace function public.metricas_finanzas(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_desde_ant timestamptz,
  p_hasta_ant timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_salida jsonb;
begin
  -- Primera línea, porque esta función es `security definer` y RLS no la frena.
  if not public.tiene_nivel('owner') then
    raise exception 'Solo el owner ve las finanzas del negocio' using errcode = '42501';
  end if;
  if p_hasta <= p_desde or p_hasta_ant <= p_desde_ant then
    raise exception 'El periodo termina antes de empezar' using errcode = '22023';
  end if;

  with
  -- `fecha` es un día de Santiago; el período llega en timestamptz. Se
  -- convierte el borde, no cada fila.
  bordes as (
    select (p_desde at time zone 'America/Santiago')::date as d1,
           (p_hasta at time zone 'America/Santiago')::date as d2,
           (p_desde_ant at time zone 'America/Santiago')::date as a1,
           (p_hasta_ant at time zone 'America/Santiago')::date as a2
  ),
  vigentes as (
    select e.id, e.fecha, e.categoria, ce.nombre as categoria_nombre, e.descripcion,
           e.monto_clp, e.sede_id, e.comprobante_path, s.nombre as sede
    from public.egresos e
    join public.categorias_egreso ce on ce.slug = e.categoria
    left join public.sedes s on s.id = e.sede_id
    where e.deleted_at is null
  ),
  eg_act as (
    select coalesce(sum(monto_clp), 0)::bigint as total_clp, count(*)::int as n
    from vigentes, bordes where fecha >= d1 and fecha < d2
  ),
  eg_ant as (
    select coalesce(sum(monto_clp), 0)::bigint as total_clp, count(*)::int as n
    from vigentes, bordes where fecha >= a1 and fecha < a2
  ),
  eg_hist as (
    select coalesce(sum(monto_clp), 0)::bigint as total_clp, count(*)::int as n,
           max(fecha) as ultimo_egreso
    from vigentes
  ),
  -- Clases de parrilla del período que ya ocurrieron y no se cancelaron. Las
  -- especiales quedan fuera: se pagan con otra regla (50% de lo recaudado tras
  -- la sala) que todavía no está construida.
  dictadas as (
    select cl.id, cl.inicio, cl.fin, cl.profesora_id, cl.sede_id,
           cu.nombre as curso, pr.nombre as profesora, se.nombre as sede,
           se.costo_hora_clp,
           cp.base_hora_clp, cp.variable_credito_clp
    -- Se devuelven `inicio` y `fin`; las horas las calcula `horasDeClase` en
    -- lib/dominio/finanzas.ts. Acá no se divide.
    from public.clases cl
    join public.cursos cu on cu.id = cl.curso_id
    join public.profesoras pr on pr.id = cl.profesora_id
    join public.sedes se on se.id = cl.sede_id
    left join public.costos_profesoras cp on cp.profesora_id = cl.profesora_id
    where cl.tipo = 'parrilla'
      -- PRD-0010 parte 3: dictada es `programada` y pasada. Antes se filtraba
      -- "distinta de cancelada", y una `no_dictada` se habría costeado.
      and cl.estado = 'programada'
      and cl.inicio >= p_desde and cl.inicio < p_hasta
      and cl.inicio < now()
  ),
  -- El mismo predicado que atribuye ingreso (PRD §7.1.3): consumió y no
  -- recuperó. Una cancelación tardía consume y paga; una a tiempo no.
  consumidas as (
    select r.clase_id, count(*)::int as n
    from public.reservas r
    join dictadas d on d.id = r.clase_id
    where r.credito_id is not null
      and r.credito_devuelto = false
      and r.estado not in ('pendiente_pago', 'expirada', 'liberada')
    group by r.clase_id
  ),
  atribucion as (
    select r.clase_id,
           co.monto_clp as monto_compra_clp,
           co.cantidad_clases as clases_compra,
           r.credito_devuelto as recupero_credito,
           count(*)::int as n
    from public.reservas r
    join dictadas d on d.id = r.clase_id
    join public.creditos cr on cr.id = r.credito_id
    left join public.compras co on co.id = cr.compra_id and co.deleted_at is null
    where r.estado not in ('pendiente_pago', 'expirada', 'liberada')
    group by r.clase_id, co.monto_clp, co.cantidad_clases, r.credito_devuelto
  )
  select jsonb_build_object(
    'meta', jsonb_build_object(
      'desde', p_desde, 'hasta', p_hasta,
      'desde_anterior', p_desde_ant, 'hasta_anterior', p_hasta_ant,
      'generado_at', now()
    ),
    'egresos', jsonb_build_object(
      'total_clp', (select total_clp from eg_act),
      'n', (select n from eg_act),
      'lista', coalesce(
        (select jsonb_agg(jsonb_build_object(
           'id', id, 'fecha', fecha, 'categoria', categoria,
           'categoria_nombre', categoria_nombre, 'descripcion', descripcion,
           'monto_clp', monto_clp, 'sede', sede,
           'tiene_comprobante', comprobante_path is not null
         ) order by fecha desc, monto_clp desc)
         from vigentes, bordes where fecha >= d1 and fecha < d2),
        '[]'::jsonb)
    ),
    'egresos_anterior', jsonb_build_object(
      'total_clp', (select total_clp from eg_ant), 'n', (select n from eg_ant)
    ),
    'desde_siempre', jsonb_build_object(
      'total_clp', (select total_clp from eg_hist), 'n', (select n from eg_hist),
      'ultimo_egreso', (select ultimo_egreso from eg_hist)
    ),
    'por_clase', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'clase_id', d.id, 'inicio', d.inicio, 'fin', d.fin, 'curso', d.curso,
         'profesora', d.profesora, 'sede', d.sede,
         'costo_hora_sala_clp', d.costo_hora_clp,
         'base_hora_profesora_clp', d.base_hora_clp,
         'variable_credito_clp', d.variable_credito_clp,
         'creditos_consumidos', coalesce(c.n, 0),
         'atribucion', coalesce(
           (select jsonb_agg(jsonb_build_object(
              'monto_compra_clp', a.monto_compra_clp, 'clases_compra', a.clases_compra,
              'recupero_credito', a.recupero_credito, 'n', a.n
            )) from atribucion a where a.clase_id = d.id),
           '[]'::jsonb)
       ) order by d.inicio)
       from dictadas d left join consumidas c on c.clase_id = d.id),
      '[]'::jsonb)
  )
  into v_salida;

  return v_salida;
end;
$$;

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
           cl.profesora_id, cl.curso_id, cl.sede_id, cl.tipo, cl.titulo
    from public.clases cl
    where cl.inicio >= p_desde and cl.inicio < p_hasta
      and (cl.tipo = 'parrilla' or cl.publicada_at is not null)
  ),
  -- Mismo contrato que cupo_tomado / cupoTomado.
  ocupadas as (
    select r.clase_id, count(*)::int as reservas
    from public.reservas r
    where r.estado in ('confirmada', 'asistio')
       or (r.estado = 'pendiente_pago' and r.expira_at > now())
    group by r.clase_id
  ),
  detalle as (
    select cp.id, cp.horario_id, cp.fecha, cp.inicio, cp.estado, cp.cupo_maximo,
           cp.profesora_id, cp.tipo,
           -- Una especial se llama por su coreografía, no por el curso.
           coalesce(cp.titulo, cu.nombre) as curso,
           pr.nombre as profesora, se.nombre as sede,
           coalesce(oc.reservas, 0) as reservas,
           -- PRD-0010 parte 3: una `no_dictada` no es dictada.
           (cp.estado = 'programada' and cp.inicio < now()) as dictada
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
  reservas_por_profesora as (
    select d.profesora_id, coalesce(sum(d.reservas), 0)::int as reservas
    from detalle d
    group by d.profesora_id
  ),
  atribucion as (
    select cl.profesora_id,
           case when r.compra_id is not null
                then co_cl.monto_clp - coalesce(co_cl.reembolso_monto_clp, 0)
                else co.monto_clp end as monto_compra_clp,
           case when r.compra_id is not null then 1 else co.cantidad_clases end as clases_compra,
           r.credito_devuelto as recupero_credito,
           (cl.inicio < now()) as clase_ya_ocurrio,
           count(*)::int as n
    from public.reservas r
    join public.clases cl on cl.id = r.clase_id
    left join public.creditos cr on cr.id = r.credito_id
    left join public.compras co on co.id = cr.compra_id and co.deleted_at is null
    left join public.compras co_cl on co_cl.id = r.compra_id
      and co_cl.deleted_at is null
      and co_cl.estado in ('pagada', 'reembolsada', 'por_reembolsar')
    where r.created_at >= p_desde and r.created_at < p_hasta
      -- Una pendiente, una expirada o una que la alumna soltó no trajo plata:
      -- no atribuye.
      and r.estado not in ('pendiente_pago', 'expirada', 'liberada')
    group by cl.profesora_id, 2, 3, r.credito_devuelto, (cl.inicio < now())
  ),
  -- Cómo se cayeron las pendientes de pago. El eje del período es
  -- `cancelada_at` —cuándo dejó de estar en pie—, igual que las cancelaciones
  -- de metricas_resumen, y no `inicio` como el resto de esta función.
  pendientes as (
    select
      (count(*) filter (where r.estado = 'liberada'))::int as soltadas,
      (count(*) filter (where r.estado = 'expirada'))::int as expiradas,
      (count(*) filter (where r.estado = 'expirada' and cl.estado = 'cancelada'))::int
        as expiradas_por_clase_cancelada
    from public.reservas r
    join public.clases cl on cl.id = r.clase_id
    where r.estado in ('liberada', 'expirada')
      and r.cancelada_at >= p_desde and r.cancelada_at < p_hasta
  ),
  -- Cupos tomados ahora mismo por alguien que todavía no transfiere. No lleva
  -- período: es una foto, y es lo que hay que mirar antes de decir que una
  -- clase está llena.
  pendientes_vigentes as (
    select count(*)::int as n
    from public.reservas r
    where r.estado = 'pendiente_pago' and r.expira_at > now()
  )

  select jsonb_build_object(
    'meta', jsonb_build_object('desde', p_desde, 'hasta', p_hasta, 'generado_at', now()),
    'pendientes', jsonb_build_object(
      'soltadas', (select soltadas from pendientes),
      'expiradas', (select expiradas from pendientes),
      'expiradas_por_clase_cancelada', (select expiradas_por_clase_cancelada from pendientes),
      'vigentes_ahora', (select n from pendientes_vigentes)
    ),
    'por_clase', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'clase_id', id, 'fecha', fecha, 'inicio', inicio, 'estado', estado,
         'curso', curso, 'profesora', profesora, 'sede', sede, 'tipo', tipo,
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

-- ---------------------------------------------------------------------------
-- 10. Comprobaciones
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from public.costos_profesoras cp join public.profesoras p on p.id = cp.profesora_id
    where p.slug = 'isi'
  ) and exists (select 1 from public.profesoras where slug = 'isi') then
    raise exception 'Isi quedó sin tarifa.';
  end if;

  if exists (select 1 from public.costos_profesoras where umbral_variable <> 5) then
    raise exception 'Una tarifa quedó con un umbral distinto de 5.';
  end if;

  -- Lo que mueve plata, solo por service_role.
  if has_function_privilege('authenticated', 'public.pagar_liquidacion(uuid, uuid, date, int, jsonb, text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.registrar_no_dictada(uuid, uuid, text, text, boolean)', 'execute')
     or has_function_privilege('authenticated', 'public.reasignar_clase(uuid, uuid, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.insumos_del_mes(date)', 'execute')
     or has_function_privilege('anon', 'public.mis_insumos_liquidacion(date)', 'execute')
     or has_function_privilege('anon', 'public.insumos_liquidacion(date)', 'execute') then
    raise exception 'Una función de la liquidación quedó abierta de más.';
  end if;

  if has_table_privilege('anon', 'public.causas_de_clase', 'select')
     or has_table_privilege('anon', 'public.liquidaciones_profesoras', 'select') then
    raise exception 'anon puede leer causas o liquidaciones.';
  end if;
end $$;
