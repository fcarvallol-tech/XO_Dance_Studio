-- Cancelar una clase devuelve los créditos, se cancele como se cancele.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`.
--
-- ---------------------------------------------------------------------------
-- Lo que pasaba
-- ---------------------------------------------------------------------------
-- PRD-0006 §5 dice: "Clase cancelada por XO. Se devuelve el crédito a todas las
-- reservas, siempre, sin importar la ventana de cancelación."
--
-- **Nada de eso existía.** Había `cancelar_reserva` —la que usa la alumna para
-- soltar su cupo— y ninguna función para cancelar una clase. Poner
-- `estado = 'cancelada'` desde el Table Editor, que es como se hace hoy porque
-- el portal de administración no existe, dejaba:
--
--   · la clase fuera del calendario (RLS solo exponía las programadas);
--   · **la reserva de la alumna también fuera**, porque la consulta descartaba
--     las reservas cuya clase no venía;
--   · la reserva en `confirmada`, como si la clase siguiera en pie;
--   · **el crédito sin devolver**;
--   · a la alumna sin enterarse de nada.
--
-- O sea que a alguien que pagó le desaparecía una clase de la pantalla y se
-- quedaba sin el crédito. Eso es plata.

-- ---------------------------------------------------------------------------
-- 1. Las clases canceladas se ven
-- ---------------------------------------------------------------------------
-- Idéntico a lo que hace la migración de la grilla semanal: si las dos se
-- aplican, la segunda deja lo mismo. Se repite acá para que este arreglo no
-- dependa de que esa rama se mergee — sin esto, la clase cancelada seguiría
-- desapareciendo aunque los créditos ya vuelvan.

drop policy if exists clases_lectura_publica on public.clases;
create policy clases_lectura_publica on public.clases
  for select to anon, authenticated
  using (true);

comment on table public.clases is
  $c$Las clases son PÚBLICAS por diseño, canceladas incluidas. Ocultar las canceladas las hacía
desaparecer del calendario y arrastraba consigo la reserva de quien ya había pagado. Filtrar por
estado o por profesora es cosa de la consulta, no de RLS. Lo que sí protege la base es quién está
inscrito: ver inscritas_de_clase.$c$;

-- ---------------------------------------------------------------------------
-- 2. Devolver los créditos de una clase
-- ---------------------------------------------------------------------------
-- Devuelve **siempre**, sin mirar la ventana de cancelación: la alumna no tuvo
-- nada que ver. Y devuelve **a su lote original**, para no estirarle el
-- vencimiento por algo que canceló la academia.
--
-- Idempotente: solo toca reservas que sigan `confirmada`, así que correrla dos
-- veces no devuelve dos veces.

create or replace function public.devolver_creditos_de_clase(
  p_clase_id uuid,
  p_actor_perfil_id uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserva record;
  v_devueltas int := 0;
begin
  for v_reserva in
    select id, perfil_id, credito_id
    from public.reservas
    where clase_id = p_clase_id
      and estado = 'confirmada'
    for update
  loop
    update public.reservas
    set estado = 'cancelada',
        cancelada_at = now(),
        credito_devuelto = true
    where id = v_reserva.id;

    update public.creditos
    set cantidad_disponible = cantidad_disponible + 1
    where id = v_reserva.credito_id;

    insert into public.movimientos_credito
      (perfil_id, credito_id, reserva_id, tipo, cantidad, saldo_resultante, motivo, creado_por)
    values
      (v_reserva.perfil_id, v_reserva.credito_id, v_reserva.id, 'cancelacion', 1,
       public.saldo_creditos(v_reserva.perfil_id),
       'La academia canceló la clase', p_actor_perfil_id);

    v_devueltas := v_devueltas + 1;
  end loop;

  return v_devueltas;
end;
$$;

revoke all on function public.devolver_creditos_de_clase(uuid, uuid) from public, anon, authenticated;
grant execute on function public.devolver_creditos_de_clase(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Un trigger, y no solo una función
-- ---------------------------------------------------------------------------
-- **Esto es lo que hace que el arreglo sirva de verdad.** Mientras no exista el
-- portal de administración, cancelar una clase se hace editando la fila en el
-- Table Editor. Una función que hay que acordarse de llamar no se llamaría
-- nunca, y los créditos quedarían sin devolver igual que hoy.
--
-- Con el trigger, la devolución ocurre **se cancele como se cancele**: desde la
-- función, desde el Table Editor o desde una consulta suelta.

create or replace function public.al_cancelar_clase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
begin
  -- Solo al pasar a cancelada. Volver a guardar una clase ya cancelada no
  -- vuelve a devolver nada.
  if new.estado = 'cancelada' and old.estado is distinct from 'cancelada' then
    -- Puede ser null: desde el Table Editor no hay sesión que atribuir.
    select id into v_actor from public.perfiles where user_id = auth.uid();
    perform public.devolver_creditos_de_clase(new.id, v_actor);
  end if;

  return new;
end;
$$;

drop trigger if exists clases_al_cancelar on public.clases;
create trigger clases_al_cancelar
  after update on public.clases
  for each row execute function public.al_cancelar_clase();

-- ---------------------------------------------------------------------------
-- 4. La función para cuando exista la interfaz de admin
-- ---------------------------------------------------------------------------
-- El trigger cubre la devolución; esta agrega lo que el trigger no puede saber:
-- que quien cancela tenga permiso, y el motivo que la alumna va a leer.

create or replace function public.cancelar_clase(
  p_clase_id uuid,
  p_actor_user_id uuid,
  p_motivo text
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

  if coalesce(btrim(p_motivo), '') = '' then
    -- La alumna va a leer esto en su pantalla. "Cancelada" a secas no explica
    -- nada y la deja escribiendo por WhatsApp.
    raise exception 'Dinos por qué se cancela: la alumna lo va a leer'
      using errcode = '23514';
  end if;

  select * into v_clase from public.clases where id = p_clase_id for update;

  if v_clase is null then
    raise exception 'La clase no existe' using errcode = 'P0002';
  end if;
  if v_clase.estado = 'cancelada' then
    return v_clase;
  end if;

  -- El trigger de §3 devuelve los créditos al ejecutarse este update.
  update public.clases
  set estado = 'cancelada', motivo_cancelacion = btrim(p_motivo)
  where id = v_clase.id
  returning * into v_clase;

  return v_clase;
end;
$$;

revoke all on function public.cancelar_clase(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cancelar_clase(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Lo que este arreglo NO hace
-- ---------------------------------------------------------------------------
-- **No manda el correo** que PRD-0006 §5 promete. Un trigger de base de datos
-- no puede, y la interfaz de administración desde donde saldría no existe
-- todavía. Por ahora la alumna se entera al entrar: ve la clase tachada, el
-- motivo y el aviso de que le devolvieron la clase.
--
-- Queda anotado en PRD-0006 y en la deuda técnica: cuando exista el portal de
-- administración (PRD-0009), cancelar desde ahí debe además avisar por correo.
