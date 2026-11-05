-- PRD-0027 — La clase recuperativa.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, con
-- aprobación de Felipe en ese mismo mensaje, por el nombre de este archivo.
--
-- 🔴 DEPENDE DE 20261105140000_liquidacion_profesoras.sql: usa
-- `clases.recupera_clase_id`, el estado `no_dictada`, `mes_pagado()` y el índice
-- de una recuperación por clase, que nacen ahí. Sin ella, esta migración aborta
-- en el primer bloque y no deja nada a medias. `db push` las va a listar juntas.
--
-- ---------------------------------------------------------------------------
-- Qué es una recuperativa
-- ---------------------------------------------------------------------------
-- Una fila de `clases` de tipo `parrilla`, con el mismo `horario_id` de la clase
-- caída, otra fecha y `recupera_clase_id` apuntando a ella. **No es una
-- especial**: la especial no consume créditos, y las alumnas a las que se les
-- devolvió el crédito no podrían usarlo. Pasa `clases_tipo_coherente` sin
-- tocarlo y `reservar()` la trata como cualquier clase, así que no se toca.
--
-- Lo que hace:
--  1. El índice de una recuperación por clase deja de contar las caídas: si la
--     recuperativa se cancela, la clase original se puede volver a recuperar.
--  2. crear_recuperativa(): crea la clase y la liga, en una transacción.
--  3. afectadas_de_clases(): quiénes perdieron su lugar cuando la clase cayó.
--
-- Idempotente.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clases'
      and column_name = 'recupera_clase_id'
  ) then
    raise exception 'Falta 20261105140000_liquidacion_profesoras.sql: esta migración depende de ella.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Una recuperativa viva por clase
-- ---------------------------------------------------------------------------
-- Tal como venía, una recuperativa cancelada ocupaba el índice para siempre, y
-- la clase original quedaba sin forma de recuperarse. Cuenta solo la que sigue
-- en pie: el mismo criterio con que `insumos_del_mes` dice "recuperada".

drop index if exists public.clases_una_recuperacion_por_clase;
create unique index clases_una_recuperacion_por_clase
  on public.clases (recupera_clase_id)
  where recupera_clase_id is not null and estado = 'programada';

-- ---------------------------------------------------------------------------
-- 2. crear_recuperativa()
-- ---------------------------------------------------------------------------

/**
 * Crea la recuperativa de una clase caída. Admin u owner.
 *
 * - El cupo sale de `sedes.capacidad` de la sala elegida, nunca de un número.
 * - La hora llega en hora de Santiago y se convierte acá, igual que en
 *   generar_clases().
 * - Dura lo que duraba la original.
 * - No reserva por nadie: las alumnas tienen su crédito y reservan solas.
 *
 * Los mensajes están escritos para mostrarse en la pantalla (22023).
 */
create or replace function public.crear_recuperativa(
  p_actor_user_id uuid,
  p_original_id uuid,
  p_fecha date,
  p_hora time,
  p_sede_id uuid,
  p_profesora_id uuid
)
returns public.clases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_original public.clases;
  v_horario public.horarios;
  v_sede public.sedes;
  v_viva public.clases;
  v_inicio timestamptz := (p_fecha + p_hora) at time zone 'America/Santiago';
  v_fin timestamptz;
  v_nueva public.clases;
  v_indice text;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;
  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  select * into v_original from public.clases where id = p_original_id for update;
  if v_original is null then
    raise exception 'Esa clase no existe' using errcode = 'P0002';
  end if;
  if v_original.tipo <> 'parrilla' then
    raise exception 'Las clases especiales no se recuperan: se pagan aparte y no consumen créditos'
      using errcode = '22023';
  end if;
  if v_original.estado not in ('cancelada', 'no_dictada') then
    raise exception 'Solo se recupera una clase cancelada o no dictada' using errcode = '22023';
  end if;
  if v_original.recupera_clase_id is not null then
    raise exception 'Esa clase ya era una recuperativa. Crea la nueva desde la clase original'
      using errcode = '22023';
  end if;

  select * into v_viva from public.clases
  where recupera_clase_id = v_original.id and estado = 'programada';
  -- `.id` y no la fila: `fila is not null` exige todas las columnas llenas, y una
  -- clase de parrilla tiene `titulo` nulo.
  if v_viva.id is not null then
    raise exception 'Esa clase ya tiene su recuperativa, el %',
      to_char(v_viva.inicio at time zone 'America/Santiago', 'DD/MM "a las" HH24:MI')
      using errcode = '22023';
  end if;

  if public.mes_pagado(v_original.profesora_id, v_original.inicio) then
    raise exception 'El mes de esa clase ya se le pagó a la profesora. Si esto cambia lo que se debía, va como ajuste'
      using errcode = '22023';
  end if;

  if p_fecha is null or p_hora is null then
    raise exception 'Falta la fecha o la hora' using errcode = '22023';
  end if;
  if v_inicio <= now() then
    raise exception 'La recuperativa tiene que ser en el futuro' using errcode = '22023';
  end if;

  select * into v_sede from public.sedes
  where id = p_sede_id and activa and deleted_at is null;
  if v_sede is null then
    raise exception 'Esa sala no existe o no está activa' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profesoras
    where id = p_profesora_id and activa and deleted_at is null
  ) then
    raise exception 'Esa profesora no existe o no está activa' using errcode = '22023';
  end if;

  -- El único de (horario_id, fecha): dos clases de un mismo horario no pueden
  -- caer el mismo día, aunque sean a distinta hora y una esté cancelada.
  if exists (
    select 1 from public.clases
    where horario_id = v_original.horario_id and fecha = p_fecha
  ) then
    raise exception 'Ese día ya hay una clase de este horario, aunque esté cancelada. Una clase y su recuperativa no pueden caer el mismo día: elige otra fecha'
      using errcode = '22023';
  end if;

  -- Lo mismo, antes de que exista la fila. Si la recuperativa cae en el día
  -- regular más allá de lo generado, generar_clases() choca con ella más
  -- adelante y deja de crear la clase regular, en silencio.
  select * into v_horario from public.horarios where id = v_original.horario_id;
  if v_horario.activo and v_horario.deleted_at is null
     and extract(isodow from p_fecha) = v_horario.dia_semana then
    raise exception 'Ese día de la semana es el de la clase regular de este horario. Si la recuperativa cae ahí, la clase regular de esa fecha no se generaría: elige otro día'
      using errcode = '22023';
  end if;

  v_fin := case when v_original.fin is null then null
                else v_inicio + (v_original.fin - v_original.inicio) end;

  if public.solape_de_especial(
       null, p_sede_id, p_profesora_id, v_inicio,
       coalesce(v_fin, v_inicio + interval '60 minutes')
     ) is not null then
    raise exception 'Esa sala o esa profesora ya tiene una clase a esa hora: elige otra'
      using errcode = '22023';
  end if;

  begin
    insert into public.clases
      (tipo, horario_id, fecha, inicio, fin, curso_id, profesora_id, sede_id,
       cupo_maximo, recupera_clase_id)
    values
      ('parrilla', v_original.horario_id, p_fecha, v_inicio, v_fin, v_original.curso_id,
       p_profesora_id, p_sede_id, v_sede.capacidad, v_original.id)
    returning * into v_nueva;
  exception when unique_violation then
    -- Dos pestañas a la vez: lo revisado arriba ya no era cierto al insertar.
    get stacked diagnostics v_indice = constraint_name;
    if v_indice = 'clases_una_recuperacion_por_clase' then
      raise exception 'Esa clase ya tiene su recuperativa' using errcode = '22023';
    end if;
    raise exception 'Ese día ya hay una clase de este horario: elige otra fecha' using errcode = '22023';
  end;

  return v_nueva;
end;
$$;

revoke all on function public.crear_recuperativa(uuid, uuid, date, time, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.crear_recuperativa(uuid, uuid, date, time, uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3. afectadas_de_clases()
-- ---------------------------------------------------------------------------

/**
 * Quiénes perdieron su lugar porque la academia bajó la clase, por cada clase
 * original pedida. Incluye a las de una recuperativa anterior que también cayó.
 *
 * **No basta con `reservas.estado = 'cancelada'`:** una alumna que había
 * cancelado por su cuenta también queda así, con el crédito devuelto, y no
 * perdió nada. Lo que las separa es el movimiento que escribe
 * `devolver_creditos_de_clase`.
 *
 * Con la service role: devuelve correos. `vence` es el del lote devuelto:
 * `reservar()` mira el vencimiento al reservar, no la fecha de la clase, así que
 * lo que le impide reservar a una alumna es que ya haya vencido.
 */
create or replace function public.afectadas_de_clases(p_originales uuid[])
returns table (original_id uuid, perfil_id uuid, email text, vence timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (coalesce(cl.recupera_clase_id, cl.id), r.perfil_id)
         coalesce(cl.recupera_clase_id, cl.id), r.perfil_id, p.email, c.fecha_vencimiento
  from public.clases cl
  join public.reservas r on r.clase_id = cl.id
  join public.movimientos_credito m
    on m.reserva_id = r.id
   and m.tipo = 'cancelacion'
   and m.motivo = 'La academia canceló la clase'
  join public.creditos c on c.id = r.credito_id
  join public.perfiles p on p.id = r.perfil_id and p.deleted_at is null
  where coalesce(cl.recupera_clase_id, cl.id) = any(p_originales)
  order by coalesce(cl.recupera_clase_id, cl.id), r.perfil_id, c.fecha_vencimiento desc;
$$;

revoke all on function public.afectadas_de_clases(uuid[]) from public, anon, authenticated;
grant execute on function public.afectadas_de_clases(uuid[]) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Comprobaciones
-- ---------------------------------------------------------------------------

do $$
begin
  if has_function_privilege('authenticated', 'public.crear_recuperativa(uuid, uuid, date, time, uuid, uuid)', 'execute')
     or has_function_privilege('anon', 'public.crear_recuperativa(uuid, uuid, date, time, uuid, uuid)', 'execute') then
    raise exception 'crear_recuperativa quedó abierta a una sesión.';
  end if;

  if has_function_privilege('authenticated', 'public.afectadas_de_clases(uuid[])', 'execute')
     or has_function_privilege('anon', 'public.afectadas_de_clases(uuid[])', 'execute') then
    raise exception 'afectadas_de_clases entrega correos y quedó abierta a una sesión.';
  end if;
end $$;
