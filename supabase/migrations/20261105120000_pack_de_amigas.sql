-- PRD-0026 — Pack de amigas: una compra, dos lotes, dos cuentas.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, con
-- aprobación de Felipe en ese mismo mensaje, por el nombre de este archivo.
--
-- ---------------------------------------------------------------------------
-- La idea
-- ---------------------------------------------------------------------------
-- `creditos` ya tiene `perfil_id` y `compra_id` como columnas independientes:
-- nada obliga a que el lote quede en la cuenta de quien pagó. El pack es UNA
-- compra (un monto, una aprobación, una fila en el tablero) que al aprobarse
-- crea DOS lotes con el mismo `compra_id`, uno por perfil. Los dos créditos
-- cuentan como **vendidos** —sus movimientos son tipo `compra` y sus lotes
-- tienen compra—, no como regalados. Por eso NO se usa `regalar_creditos()`:
-- dejaría el lote de la amiga sin compra y el tablero lo contaría como regalo,
-- que es justo la separación que Felipe pidió el 04/10 (PRD-0023).
--
-- ---------------------------------------------------------------------------
-- Lo que hace este archivo
-- ---------------------------------------------------------------------------
-- 1. planes.clases_para_invitada: cuántas clases del plan van a la amiga. 0 en
--    todos los planes de hoy. El plan nuevo `pack-amigas` lleva 1.
-- 2. compras.perfil_invitada_id y compras.cantidad_invitada: **congelados al
--    declarar**, igual que el monto. Si mañana el plan cambia, una compra
--    pasada no se recalcula.
-- 3. consultas_invitada + buscar_invitada(): saber si un correo tiene cuenta,
--    con límite de intentos. Responde solo sí o no.
-- 4. declarar_pack_amigas(): la única forma de crear una compra con invitada.
-- 5. acreditar_compra(): el camino de los packs crea un lote por perfil, en la
--    misma transacción. El resto de la función queda idéntico a 20260910120000.
-- 6. Un candado para anular: `deleted_at` en una compra con clases vigentes sin
--    usar se rechaza. Ver PRD-0026 §6 y la nota en el punto 6.
--
-- `metricas_resumen` NO cambia: ya cuenta compras desde `compras` (una, con su
-- monto) y vendidas desde los movimientos tipo `compra` (dos). Comprobado en
-- la base local con un escenario, ver PRD-0026 §12.
--
-- Idempotente.

-- ---------------------------------------------------------------------------
-- 1. planes.clases_para_invitada y el plan nuevo
-- ---------------------------------------------------------------------------

alter table public.planes
  add column if not exists clases_para_invitada int not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'planes_clases_para_invitada_validas') then
    alter table public.planes add constraint planes_clases_para_invitada_validas
      -- Quien paga se queda con al menos una: si no, es un regalo, no un pack.
      check (clases_para_invitada >= 0 and clases_para_invitada < cantidad_clases);
  end if;
end $$;

comment on column public.planes.clases_para_invitada is
  'PRD-0026: cuántas clases del plan caen en la cuenta de otra persona que la compradora nombra por correo. 0 = plan normal.';

-- El precio y la vigencia son de Felipe (04/11/2026): 2 clases, $16.000, 30 días.
-- Al final del orden, para no mover lo que ya se ve.
insert into public.planes
  (slug, nombre, cantidad_clases, precio_clp, vigencia_dias, orden, activo, clases_para_invitada)
values
  ('pack-amigas', 'Pack de amigas', 2, 16000, 30,
   (select coalesce(max(orden), 0) + 1 from public.planes), true, 1)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2. compras: la invitada, congelada al declarar
-- ---------------------------------------------------------------------------

alter table public.compras
  add column if not exists perfil_invitada_id uuid,
  add column if not exists cantidad_invitada int not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'compras_perfil_invitada_id_fkey') then
    alter table public.compras add constraint compras_perfil_invitada_id_fkey
      foreign key (perfil_invitada_id) references public.perfiles (id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'compras_invitada_coherente') then
    alter table public.compras add constraint compras_invitada_coherente check (
      -- Con invitada, al menos una clase para ella y al menos una para quien paga.
      (perfil_invitada_id is null and cantidad_invitada = 0)
      or (perfil_invitada_id is not null
          and cantidad_invitada > 0
          and cantidad_invitada < cantidad_clases)
    );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'compras_invitada_no_es_quien_paga') then
    alter table public.compras add constraint compras_invitada_no_es_quien_paga
      check (perfil_invitada_id is null or perfil_invitada_id <> perfil_id);
  end if;
end $$;

create index if not exists compras_invitada_idx
  on public.compras (perfil_invitada_id) where perfil_invitada_id is not null;

comment on column public.compras.perfil_invitada_id is
  'PRD-0026: la amiga que recibe parte de las clases. Se fija al declarar y no cambia. No se ve desde la cuenta de ella: la compra sigue siendo de quien pagó.';
comment on column public.compras.cantidad_invitada is
  'PRD-0026: cuántas de cantidad_clases van al lote de la invitada. Congelado al declarar, como el monto.';

-- `authenticated` declara compras con grants por columna (20260831120000) y
-- estas dos **no** están entre ellas: una alumna no puede nombrar invitada con
-- un insert directo. Este disparador cierra lo que queda: que alguien declare
-- el plan de amigas por la API sin pasar por `declarar_pack_amigas`, y que la
-- invitada cambie después de declarada.
create or replace function public.compras_invitada_cuadra_con_el_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_para_invitada int;
begin
  if tg_op = 'UPDATE' then
    if new.perfil_invitada_id is distinct from old.perfil_invitada_id
       or new.cantidad_invitada is distinct from old.cantidad_invitada then
      raise exception 'La amiga de un pack no se cambia después de declarado'
        using errcode = '22023';
    end if;
    return new;
  end if;

  if new.plan_id is null then
    if new.perfil_invitada_id is not null then
      raise exception 'Una clase especial no lleva amiga' using errcode = '22023';
    end if;
    return new;
  end if;

  select clases_para_invitada into v_para_invitada
  from public.planes where id = new.plan_id;

  if coalesce(v_para_invitada, 0) > 0 and new.perfil_invitada_id is null then
    raise exception 'Este plan necesita el correo de tu amiga' using errcode = '22023';
  end if;
  if coalesce(v_para_invitada, 0) = 0 and new.perfil_invitada_id is not null then
    raise exception 'Este plan no lleva amiga' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists compras_invitada_cuadra on public.compras;
create trigger compras_invitada_cuadra
  before insert or update of perfil_invitada_id, cantidad_invitada on public.compras
  for each row execute function public.compras_invitada_cuadra_con_el_plan();

-- ---------------------------------------------------------------------------
-- 3. Buscar a la amiga, con límite de intentos
-- ---------------------------------------------------------------------------
-- Validar un correo ya le confirma a quien pregunta que esa persona es alumna
-- de XO, y la mayoría son menores. Así que: responde **solo sí o no** —nunca
-- nombre ni otro dato— y cada pregunta cuenta.
--
-- **El límite: 5 por hora y 10 por día, por cuenta compradora** (PRD-0026
-- §8.5). Alcanza para equivocarse dos o tres veces escribiendo el correo de la
-- amiga, y no para ir probando una lista. Cuenta **todas** las preguntas, con o
-- sin cuenta detrás: si solo contaran los "no", ir probando correos que sí
-- existen saldría gratis.
--
-- Lo que se guarda es **que se preguntó**, no qué: el correo consultado no se
-- registra. Un registro de correos de menores que alguien tecleó sería un
-- dato personal más que cuidar, y para el límite no hace falta.

create table if not exists public.consultas_invitada (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles (id) on delete restrict,
  encontrada boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists consultas_invitada_perfil_idx
  on public.consultas_invitada (perfil_id, created_at desc);

drop trigger if exists consultas_invitada_updated_at on public.consultas_invitada;
create trigger consultas_invitada_updated_at before update on public.consultas_invitada
  for each row execute function public.tocar_updated_at();

comment on table public.consultas_invitada is
  'PRD-0026: cada vez que una compradora preguntó si un correo tiene cuenta. Sin el correo: solo quién, cuándo y si había cuenta. Es el contador del límite de intentos.';

-- Sin políticas y sin grants para anon ni authenticated: solo la leen las
-- funciones de abajo. RLS activo igual, por regla.
alter table public.consultas_invitada enable row level security;
revoke all on public.consultas_invitada from anon, authenticated;
grant select, insert on public.consultas_invitada to service_role;

insert into public.parametros (clave, valor, descripcion)
values
  ('invitada_consultas_por_hora', '5',
   'PRD-0026: cuántas veces por hora una cuenta puede preguntar si un correo tiene cuenta.'),
  ('invitada_consultas_por_dia', '10',
   'PRD-0026: lo mismo, por día. Las dos cuentan todas las preguntas, con o sin cuenta detrás.')
on conflict (clave) do nothing;

/**
 * El perfil de la amiga por su correo, o null si no tiene cuenta. **Cuenta un
 * intento siempre que llega a buscar.** Solo service_role: la llama el
 * servidor después de saber quién pregunta, y `declarar_pack_amigas`.
 *
 * Lanza —sin contar intento— si es el correo de la propia compradora o si se
 * pasó del límite. Lo demás no lanza: devolver null en vez de un error es lo
 * que permite que el intento quede registrado, porque un `raise` revertiría el
 * insert de `consultas_invitada`.
 */
create or replace function public.buscar_invitada(
  p_actor_user_id uuid,
  p_correo text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_correo text := lower(btrim(coalesce(p_correo, '')));
  v_por_hora int := public.parametro_int('invitada_consultas_por_hora', 5);
  v_por_dia int := public.parametro_int('invitada_consultas_por_dia', 10);
  v_hora int;
  v_dia int;
  v_invitada uuid;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null then
    raise exception 'Necesitas iniciar sesión' using errcode = '42501';
  end if;

  if v_correo = '' or position('@' in v_correo) = 0 then
    raise exception 'Escribe el correo de tu amiga' using errcode = '22023';
  end if;

  if v_correo = lower(btrim(coalesce(v_actor.email, ''))) then
    raise exception 'Ese es tu propio correo. El pack es para ti y otra persona'
      using errcode = '22023';
  end if;

  -- Serializa las preguntas de una misma cuenta: dos pestañas no pueden
  -- pasarse del límite leyendo el conteo al mismo tiempo.
  perform 1 from public.perfiles where id = v_actor.id for update;

  select
    count(*) filter (where created_at > now() - interval '1 hour'),
    count(*) filter (where created_at > now() - interval '1 day')
  into v_hora, v_dia
  from public.consultas_invitada
  where perfil_id = v_actor.id;

  if v_hora >= v_por_hora or v_dia >= v_por_dia then
    raise exception 'Hiciste demasiadas consultas seguidas. Espera un rato o escríbenos por WhatsApp'
      using errcode = '22023';
  end if;

  select id into v_invitada
  from public.perfiles
  where lower(btrim(email)) = v_correo
    and deleted_at is null
  limit 1;

  insert into public.consultas_invitada (perfil_id, encontrada)
  values (v_actor.id, v_invitada is not null);

  return v_invitada;
end;
$$;

revoke all on function public.buscar_invitada(uuid, text) from public, anon, authenticated;
grant execute on function public.buscar_invitada(uuid, text) to service_role;

comment on function public.buscar_invitada(uuid, text) is
  'PRD-0026: el perfil de la amiga por correo, o null. Cuenta un intento. Límite en parametros invitada_consultas_por_hora/_por_dia. Solo service_role; el servidor devuelve a la pantalla solo sí o no.';

-- ---------------------------------------------------------------------------
-- 4. declarar_pack_amigas()
-- ---------------------------------------------------------------------------
-- La compradora declara la transferencia de un plan con invitada. Es
-- `declararTransferencia` más la amiga, y **vuelve a buscarla** aunque la
-- pantalla ya lo haya hecho: lo que diga el navegador no vale.
--
-- Esa segunda búsqueda **cuenta como intento**. Si no contara, declarar sería
-- un oráculo sin límite: probar un correo, ver si la compra se crea.
--
-- El monto llega del servidor, que lo calcula con `resolverOferta` igual que
-- para cualquier pack (PRD-0020 §7): la promoción vigente vive allá, y
-- duplicarla acá serían dos versiones de la misma regla.
--
-- Devuelve jsonb y no lanza cuando la amiga no tiene cuenta, por lo mismo que
-- `buscar_invitada`: el intento tiene que quedar registrado.

create or replace function public.declarar_pack_amigas(
  p_actor_user_id uuid,
  p_plan_slug text,
  p_monto_clp int,
  p_correo_invitada text,
  p_titular text default null,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_plan public.planes;
  v_invitada uuid;
  v_compra public.compras;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null then
    raise exception 'Necesitas iniciar sesión' using errcode = '42501';
  end if;

  select * into v_plan from public.planes
  where slug = p_plan_slug and activo and deleted_at is null;

  if v_plan is null or v_plan.clases_para_invitada = 0 then
    raise exception 'Ese plan no es para dos' using errcode = '22023';
  end if;

  if p_monto_clp is null or p_monto_clp <= 0 then
    raise exception 'Monto inválido' using errcode = '22023';
  end if;

  v_invitada := public.buscar_invitada(p_actor_user_id, p_correo_invitada);

  if v_invitada is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_cuenta');
  end if;

  insert into public.compras
    (perfil_id, plan_id, cantidad_clases, monto_clp, medio_pago,
     titular_declarado, nota_alumna, perfil_invitada_id, cantidad_invitada)
  values
    (v_actor.id, v_plan.id, v_plan.cantidad_clases, p_monto_clp, 'transferencia',
     nullif(btrim(p_titular), ''), nullif(btrim(p_nota), ''),
     v_invitada, v_plan.clases_para_invitada)
  returning * into v_compra;

  return jsonb_build_object('ok', true, 'compra_id', v_compra.id);
end;
$$;

revoke all on function public.declarar_pack_amigas(uuid, text, int, text, text, text)
  from public, anon, authenticated;
grant execute on function public.declarar_pack_amigas(uuid, text, int, text, text, text)
  to service_role;

comment on function public.declarar_pack_amigas(uuid, text, int, text, text, text) is
  'PRD-0026: declara la transferencia de un plan con invitada. Busca a la amiga de nuevo (cuenta intento) y congela invitada y cantidad en la compra. Solo service_role.';

-- ---------------------------------------------------------------------------
-- 5. acreditar_compra(): un lote por perfil
-- ---------------------------------------------------------------------------
-- Copia de 20260910120000 §7.7. **Lo único que cambia es el camino de los
-- packs**: si la compra tiene invitada, se crean dos lotes con el mismo
-- `compra_id` y dos movimientos tipo `compra`, cada uno con el saldo de su
-- dueña. Mismo vencimiento para los dos, contado desde la aprobación. Todo en
-- la misma transacción: o quedan los dos lotes, o ninguno.
--
-- Si la amiga borró su cuenta entre la declaración y la aprobación, no se
-- acredita nada: la compra queda pendiente y se rechaza o se resuelve a mano.

create or replace function public.acreditar_compra(
  p_compra_id uuid,
  p_actor_user_id uuid,
  p_motivo text default null
)
returns public.compras
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_compra public.compras;
  v_plan public.planes;
  v_credito public.creditos;
  v_credito_invitada public.creditos;
  v_vence timestamptz;
  v_clase public.clases;
  v_reserva public.reservas;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  select * into v_compra from public.compras where id = p_compra_id for update;

  if v_compra is null then
    raise exception 'La compra no existe' using errcode = 'P0002';
  end if;

  if v_compra.estado = 'pagada' then
    return v_compra;
  end if;

  -- ----- Compra de una clase especial: idéntico a 20260910120000 -----
  if v_compra.clase_id is not null then
    if v_compra.estado not in ('pendiente', 'expirada') then
      raise exception 'Solo se puede acreditar una compra pendiente o expirada (está en %)', v_compra.estado
        using errcode = '22023';
    end if;

    select * into v_clase from public.clases where id = v_compra.clase_id for update;
    select * into v_reserva from public.reservas where compra_id = v_compra.id for update;

    if v_reserva is null then
      raise exception 'La compra no tiene reserva asociada' using errcode = 'P0002';
    end if;

    if v_reserva.estado = 'pendiente_pago'
       or (v_reserva.estado = 'expirada'
           and v_clase.estado = 'programada'
           and v_clase.inicio > now()
           and public.cupo_tomado(v_clase.id) < v_clase.cupo_maximo) then
      update public.reservas
      set estado = 'confirmada'
      where id = v_reserva.id;

      update public.compras
      set estado = 'pagada', aprobada_por = v_actor.id, aprobada_at = now()
      where id = v_compra.id
      returning * into v_compra;
    else
      update public.compras
      set estado = 'por_reembolsar', aprobada_por = v_actor.id, aprobada_at = now()
      where id = v_compra.id
      returning * into v_compra;
    end if;

    return v_compra;
  end if;

  -- ----- Compra de un pack -----
  if v_compra.estado <> 'pendiente' then
    raise exception 'Solo se puede acreditar una compra pendiente (está en %)', v_compra.estado
      using errcode = '22023';
  end if;

  if v_compra.perfil_invitada_id is not null and not exists (
    select 1 from public.perfiles
    where id = v_compra.perfil_invitada_id and deleted_at is null
  ) then
    raise exception 'La cuenta de la amiga ya no existe. No se acreditó nada: rechaza la compra o resuélvela a mano'
      using errcode = '22023';
  end if;

  select * into v_plan from public.planes where id = v_compra.plan_id;
  v_vence := now() + make_interval(days => coalesce(v_plan.vigencia_dias, 60));

  -- Quien pagó: todo menos lo de la amiga. Sin amiga, `cantidad_invitada` es 0
  -- y esto es exactamente lo de antes.
  insert into public.creditos
    (perfil_id, compra_id, cantidad_inicial, cantidad_disponible, fecha_vencimiento)
  values
    (v_compra.perfil_id, v_compra.id,
     v_compra.cantidad_clases - v_compra.cantidad_invitada,
     v_compra.cantidad_clases - v_compra.cantidad_invitada,
     v_vence)
  returning * into v_credito;

  if v_compra.perfil_invitada_id is not null then
    insert into public.creditos
      (perfil_id, compra_id, cantidad_inicial, cantidad_disponible, fecha_vencimiento)
    values
      (v_compra.perfil_invitada_id, v_compra.id,
       v_compra.cantidad_invitada, v_compra.cantidad_invitada, v_vence)
    returning * into v_credito_invitada;
  end if;

  update public.compras
  set estado = 'pagada', aprobada_por = v_actor.id, aprobada_at = now()
  where id = v_compra.id
  returning * into v_compra;

  insert into public.movimientos_credito
    (perfil_id, credito_id, tipo, cantidad, saldo_resultante, motivo, creado_por)
  values
    (v_compra.perfil_id, v_credito.id, 'compra', v_credito.cantidad_inicial,
     public.saldo_creditos(v_compra.perfil_id), p_motivo, v_actor.id);

  if v_credito_invitada.id is not null then
    insert into public.movimientos_credito
      (perfil_id, credito_id, tipo, cantidad, saldo_resultante, motivo, creado_por)
    values
      (v_compra.perfil_invitada_id, v_credito_invitada.id, 'compra',
       v_credito_invitada.cantidad_inicial,
       public.saldo_creditos(v_compra.perfil_invitada_id), p_motivo, v_actor.id);
  end if;

  return v_compra;
end;
$$;

-- Mismos grants que tenía: `create or replace` los conserva, pero se escriben
-- igual (CLAUDE.md: lo que funciona por defecto se rompe al primer revoke).
revoke all on function public.acreditar_compra(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.acreditar_compra(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Anular una compra: los lotes van juntos
-- ---------------------------------------------------------------------------
-- Hoy nada en el sitio anula una compra: `deleted_at` solo se escribe a mano
-- en el Table Editor, y **no toca los lotes**. Una compra anulada así deja sus
-- clases vivas y reservables, en un pack normal y en uno de amigas.
--
-- Felipe pidió que en el pack de amigas se vayan los dos lotes o ninguno. Lo
-- que no puede pasar es una anulación a medias: que alguien crea que anuló y
-- las clases sigan ahí. Así que se rechaza anular **cualquier** compra que
-- todavía tenga clases vigentes sin usar, en cualquiera de sus lotes. Para
-- anularla, primero se quitan esas clases —con la revocación de PRD-0024,
-- lote por lote y con motivo— y recién ahí se marca. Ver PRD-0026 §6.
--
-- Aplica a todas las compras, no solo al pack: el hueco era de todas.

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
-- 7. Comprobaciones
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from public.planes
    where slug = 'pack-amigas' and cantidad_clases = 2 and precio_clp = 16000
      and vigencia_dias = 30 and clases_para_invitada = 1
  ) then
    raise exception 'El plan pack-amigas no quedó como lo pidió Felipe (2 clases, $16.000, 30 días, 1 para la amiga). Si ya existía distinto, revisarlo a mano.';
  end if;

  if exists (
    select 1 from public.planes where slug <> 'pack-amigas' and clases_para_invitada <> 0
  ) then
    raise exception 'Un plan que no es el de amigas quedó con clases para invitada.';
  end if;

  if has_function_privilege('authenticated', 'public.buscar_invitada(uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.buscar_invitada(uuid, text)', 'execute')
     or has_function_privilege('authenticated', 'public.declarar_pack_amigas(uuid, text, int, text, text, text)', 'execute') then
    raise exception 'Las funciones del pack quedaron abiertas a una sesión.';
  end if;

  if has_column_privilege('authenticated', 'public.compras', 'perfil_invitada_id', 'insert') then
    raise exception 'Una alumna podría nombrar invitada con un insert directo.';
  end if;
end $$;
