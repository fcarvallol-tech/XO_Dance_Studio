-- La recuperativa de la Reggaeton Femme de Pau del martes 03/11/2026: viernes
-- 27/11/2026, de 20:00 a 21:00, en Los Leones (Felipe, 11/11/2026).
--
-- Se escribió el 11/11 en supabase/pendientes/ y pasó a migrations/ ese mismo
-- día, **después** de que las cuatro de la liquidación (20261105140000,
-- 20261106130000, 20261106140000 y 20261110130000) quedaran aplicadas en
-- producción y Felipe clasificara las causas: la del 03/11 quedó como
-- "asistencia_insuficiente", y no queda ninguna clase de noviembre sin causa.
-- Felipe quiso separarlas para saber cuál de las dos cosas fallaba si algo
-- salía mal. Se aplica con `supabase db push`, **con aprobación de Felipe por
-- su nombre**.
--
-- 🔴 DEPENDE DE 20261105140000 (`clases.recupera_clase_id`, el índice de una
-- recuperación por clase y `mes_pagado()`) y de 20261106140000 (una clase de
-- parrilla no puede quedar sin `fin`). Si falta alguna, aborta sin dejar nada.
--
-- ---------------------------------------------------------------------------
-- Por qué una migración y no la pantalla de PRD-0027
-- ---------------------------------------------------------------------------
-- Sin esta clase, los martes de Pau quedan con 3 dictadas en noviembre y no
-- alcanza el piso de 4 para optar a los objetivos. La pantalla que crea
-- recuperativas (PRD-0027) no está en producción y tiene hallazgos abiertos;
-- no se apura para el pago del 1/12 (Felipe, 11/11/2026).
--
-- La fila es la misma que haría `crear_recuperativa()`:
--   - tipo `parrilla`, con el `horario_id` de la clase original (los martes):
--     cuenta en ese horario para el incentivo (20261110130000);
--   - `recupera_clase_id` apuntando a la del 03/11;
--   - `fin` = inicio + 60 minutos, la duración de ese horario;
--   - `cupo_maximo` = la capacidad de la sala, 16.
--
-- **Publicada:** una clase de parrilla no lleva `publicada_at` —el check
-- `clases_tipo_coherente` lo prohíbe; ese campo es de las especiales—. Sale en
-- el calendario y se reserva por ser de parrilla, como cualquier otra.
--
-- Comprobado contra producción, solo lectura, el 11/11/2026:
--   - el viernes 27/11 no hay ninguna clase en Los Leones (solo dos en
--     Studio 98, a las 17:00 y a las 20:30), y Pau no tiene clases ese día;
--   - la clase del 03/11 está `cancelada`, motivo "Cancelada", con sus 2
--     reservas devueltas (20261103210000). La causa la marcó Felipe desde la
--     pantalla, ya en producción: "asistencia_insuficiente". La causa no es
--     condición para el enlace, pero sí para que la liquidación pague bien la
--     original.
-- Esta migración lo vuelve a comprobar al correr, porque entre el 11/11 y el
-- día que se aplique alguien puede haber creado algo.
--
-- Idempotente: si la clase del 03/11 ya tiene su recuperativa en pie, no hace
-- nada.

do $$
declare
  v_fecha constant date := '2026-11-27';
  v_inicio constant timestamptz := (date '2026-11-27' + time '20:00') at time zone 'America/Santiago';
  v_fin constant timestamptz := (date '2026-11-27' + time '21:00') at time zone 'America/Santiago';

  v_original public.clases;
  v_horario public.horarios;
  v_sede public.sedes;
  v_ya public.clases;
  v_choque text;
  v_nueva public.clases;
begin
  -- Las dos migraciones de las que depende.
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'clases'
                   and column_name = 'recupera_clase_id') then
    raise exception 'Falta 20261105140000_liquidacion_profesoras: no existe clases.recupera_clase_id.';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clases_parrilla_con_fin') then
    raise exception 'Falta 20261106140000_duracion_en_horarios.';
  end if;

  -- La original, buscada igual que en 20261103210000.
  select cl.* into v_original
  from public.clases cl
  join public.profesoras p on p.id = cl.profesora_id
  join public.cursos cu on cu.id = cl.curso_id
  join public.sedes s on s.id = cl.sede_id
  where p.slug = 'pau'
    and cu.slug = 'reggaeton-femme'
    and s.slug = 'seduccion-latina'
    and cl.fecha = date '2026-11-03'
    and (cl.inicio at time zone 'America/Santiago')::time = '18:00';

  if v_original.id is null then
    raise exception 'No está la Reggaeton Femme de Pau del 03/11 a las 18:00 en Los Leones.';
  end if;

  select * into v_ya from public.clases
  where recupera_clase_id = v_original.id and estado = 'programada';
  if v_ya.id is not null then
    raise notice 'La clase del 03/11 ya tiene su recuperativa en pie (%), el %. No se toca nada.',
      v_ya.id, to_char(v_ya.inicio at time zone 'America/Santiago', 'DD/MM HH24:MI');
    return;
  end if;

  if v_original.tipo <> 'parrilla' or v_original.estado not in ('cancelada', 'no_dictada') then
    raise exception 'La clase del 03/11 está % (%): solo se recupera una clase de parrilla cancelada o no dictada.',
      v_original.estado, v_original.tipo;
  end if;
  if v_original.recupera_clase_id is not null then
    raise exception 'La clase del 03/11 es a su vez una recuperativa.';
  end if;
  if public.mes_pagado(v_original.profesora_id, v_original.inicio) then
    raise exception 'Noviembre de Pau ya está pagado. Esto va como ajuste, no como clase nueva.';
  end if;
  if v_inicio <= now() then
    raise exception 'El 27/11 a las 20:00 ya pasó.';
  end if;

  select * into v_horario from public.horarios where id = v_original.horario_id;
  if v_horario.dia_semana <> 2 or v_horario.hora <> time '18:00' then
    raise exception 'El horario de la clase del 03/11 no es el de los martes a las 18:00.';
  end if;

  select * into v_sede from public.sedes
  where slug = 'seduccion-latina' and activa and deleted_at is null;
  if v_sede.id is null then
    raise exception 'Los Leones no está activa.';
  end if;

  -- Nada más en Los Leones ni con Pau a esa hora, en ningún estado vivo.
  select string_agg(format('%s %s-%s (%s)', s.nombre,
           to_char(cl.inicio at time zone 'America/Santiago', 'HH24:MI'),
           to_char(cl.fin at time zone 'America/Santiago', 'HH24:MI'), cl.tipo), ', ')
  into v_choque
  from public.clases cl
  join public.sedes s on s.id = cl.sede_id
  where cl.estado = 'programada'
    and (cl.sede_id = v_sede.id or cl.profesora_id = v_original.profesora_id)
    and cl.inicio < v_fin
    and coalesce(cl.fin, cl.inicio + interval '60 minutes') > v_inicio;
  if v_choque is not null then
    raise exception 'Ya hay clase en Los Leones o con Pau el 27/11 entre las 20:00 y las 21:00: %', v_choque;
  end if;

  -- Una clase por horario y fecha.
  if exists (select 1 from public.clases
             where horario_id = v_original.horario_id and fecha = v_fecha) then
    raise exception 'Ya hay una clase del horario de los martes con fecha 27/11.';
  end if;

  insert into public.clases
    (tipo, horario_id, fecha, inicio, fin, curso_id, profesora_id, sede_id,
     cupo_maximo, recupera_clase_id)
  values
    ('parrilla', v_original.horario_id, v_fecha, v_inicio, v_fin, v_original.curso_id,
     v_original.profesora_id, v_sede.id, v_sede.capacidad, v_original.id)
  returning * into v_nueva;

  if v_nueva.cupo_maximo <> 16 then
    raise exception 'El cupo quedó en %, y Los Leones es de 16.', v_nueva.cupo_maximo;
  end if;

  raise notice 'Recuperativa creada: %, viernes 27/11 20:00-21:00 en %, cupo %, recupera la %.',
    v_nueva.id, v_sede.nombre, v_nueva.cupo_maximo, v_original.id;
end $$;
