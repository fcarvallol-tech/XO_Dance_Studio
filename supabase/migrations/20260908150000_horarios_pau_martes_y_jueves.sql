-- Cambio de horario de Pau: Girly pasa de lunes 20:00 a martes 20:00 y
-- Reggaeton Femme de miércoles 20:00 a jueves 19:30. Las dos siguen en el
-- Centro Comunitario Diaguitas. Motivo: problema de salas (08/09/2026).
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`.
--
-- ESTADO al 08/09/2026: escrita y revisada a mano, SIN ejecutar contra ningún
-- Postgres. El intento contra staging falló por autenticación de la CLI, no
-- por el SQL. Ver context/prds/0018-clases-especiales.md §14 para retomar.
--
-- ---------------------------------------------------------------------------
-- Por qué no basta con editar `horarios`
-- ---------------------------------------------------------------------------
-- `clases` COPIA curso, profesora, sede e `inicio` del horario al generarse
-- (PRD-0017 §8.2), justamente para que una clase ya reservada no se mueva sola
-- si el horario cambia. Eso protege a la alumna, pero significa que las clases
-- de lunes y miércoles que ya están materializadas —hasta el 09/11/2026— se
-- quedan donde están aunque el horario diga otra cosa. Hay que sacarlas a mano.
--
-- ---------------------------------------------------------------------------
-- Qué hace, en orden
-- ---------------------------------------------------------------------------
--   1. Corta las clases de los dos horarios viejos desde la fecha de corte:
--      · las que tienen alguna reserva se CANCELAN con motivo legible, y el
--        trigger `clases_al_cancelar` devuelve los créditos como corresponde;
--      · las que nadie reservó se BORRAN. Cancelarlas las dejaría tachadas en
--        la grilla y sumadas al contador de canceladas del tablero de owner,
--        cuando en realidad no se canceló nada: se movieron antes de que
--        alguien las reservara. Hoy no hay reservas, así que en la práctica
--        esta rama borra las 19 (la del lunes 07/09, que no se dictó, y las
--        18 futuras).
--   2. Desactiva los horarios viejos. No los borra: las clases pasadas y las
--      métricas por horario apuntan a esas filas.
--   3. Crea los dos horarios nuevos.
--   4. Materializa las clases nuevas: primero las que van entre el corte y hoy,
--      que `generar_clases()` no crea porque parte de `current_date`, y después
--      `generar_clases()` para el resto. Así la Girly de hoy martes 08/09 queda
--      registrada en el horario nuevo aunque esto se aplique otro día.
--   5. Verifica el resultado y aborta si algo no cuadra.
--
-- Idempotente: si se vuelve a correr, no encuentra nada que cortar, no
-- reinserta y no duplica clases.
--
-- ---------------------------------------------------------------------------
-- La fecha de corte
-- ---------------------------------------------------------------------------
-- Desde `v_corte` rige el horario nuevo, y **el corte manda sobre el reloj**:
-- el cambio ya está operando desde el lunes 07/09/2026. Pau no dictó ese lunes
-- con el horario viejo, dictó Girly el martes 08/09 en el nuevo, y la primera
-- Reggaeton Femme nueva es el jueves 10/09. Por eso las clases viejas se sacan
-- por fecha >= corte aunque ya hayan pasado —la del lunes 07/09 no ocurrió— y
-- las nuevas se crean desde el corte aunque su fecha ya haya pasado: la de hoy
-- sí ocurrió y tiene que quedar registrada.
--
-- ---------------------------------------------------------------------------
-- Índices únicos
-- ---------------------------------------------------------------------------
-- `horarios_sede_unico (sede_id, dia_semana, hora)` y
-- `horarios_profesora_unico (profesora_id, dia_semana, hora)`, ambos parciales
-- sobre activo y no borrado. Los horarios nuevos no chocan con ninguno: hoy no
-- hay ninguna clase los martes ni los jueves, en ninguna sede ni de ninguna
-- profesora. Igual se verifica abajo antes de insertar, con un mensaje claro,
-- y se agrega lo que el índice no mira: que no haya otra clase en la misma sede
-- o de la misma profesora a menos de una hora, porque el índice compara la hora
-- exacta y una clase de 19:30 pisaría a una de 20:00 sin que él se entere.

do $$
declare
  v_corte constant date := '2026-09-07';

  v_pau uuid;
  v_diaguitas uuid;
  v_girly uuid;
  v_reggaeton uuid;

  v_viejo_girly uuid;      -- lunes 20:00
  v_viejo_reggaeton uuid;  -- miércoles 20:00

  v_canceladas int;
  v_borradas int;
  v_generadas int;
  v_activos int;
  v_sobrantes int;
  v_nuevas int;
begin
  -- -------------------------------------------------------------------------
  -- 0. Resolver ids por slug. Se escribe por slug y no por uuid para no depender
  --    de los identificadores de una base en particular.
  -- -------------------------------------------------------------------------
  select id into v_pau from public.profesoras where slug = 'pau';
  select id into v_diaguitas from public.sedes where slug = 'diaguitas';
  select id into v_girly from public.cursos where slug = 'girly';
  select id into v_reggaeton from public.cursos where slug = 'reggaeton-femme';

  if v_pau is null or v_diaguitas is null or v_girly is null or v_reggaeton is null then
    raise exception 'Falta alguno de los slugs base (pau, diaguitas, girly, reggaeton-femme). Revisar si se aplicó PRD-0016.';
  end if;

  -- Los horarios viejos. Pueden estar ya inactivos si esta migración ya corrió.
  select id into v_viejo_girly from public.horarios
  where profesora_id = v_pau and sede_id = v_diaguitas and curso_id = v_girly
    and dia_semana = 1 and hora = '20:00' and deleted_at is null;

  select id into v_viejo_reggaeton from public.horarios
  where profesora_id = v_pau and sede_id = v_diaguitas and curso_id = v_reggaeton
    and dia_semana = 3 and hora = '20:00' and deleted_at is null;

  if v_viejo_girly is null or v_viejo_reggaeton is null then
    raise exception 'No se encontraron los horarios viejos de Pau (lunes 20:00 Girly, miércoles 20:00 Reggaeton Femme). Revisar antes de seguir.';
  end if;

  -- -------------------------------------------------------------------------
  -- 1. Verificar que los horarios nuevos no choquen.
  -- -------------------------------------------------------------------------
  -- (a) Lo que los índices únicos rechazarían, dicho con palabras.
  if exists (
    select 1 from public.horarios
    where activo and deleted_at is null
      and sede_id = v_diaguitas
      and ((dia_semana = 2 and hora = '20:00') or (dia_semana = 4 and hora = '19:30'))
      and not (profesora_id = v_pau and curso_id in (v_girly, v_reggaeton))
  ) then
    raise exception 'Ya hay otra clase en Diaguitas a la hora exacta de uno de los horarios nuevos (martes 20:00 o jueves 19:30).';
  end if;

  if exists (
    select 1 from public.horarios
    where activo and deleted_at is null
      and profesora_id = v_pau
      and ((dia_semana = 2 and hora = '20:00') or (dia_semana = 4 and hora = '19:30'))
      and not (sede_id = v_diaguitas and curso_id in (v_girly, v_reggaeton))
  ) then
    raise exception 'Pau ya tiene otra clase a la hora exacta de uno de los horarios nuevos.';
  end if;

  -- (b) Lo que los índices NO miran: solapes. Las clases duran una hora.
  if exists (
    select 1 from public.horarios
    where activo and deleted_at is null
      and (sede_id = v_diaguitas or profesora_id = v_pau)
      and (
        (dia_semana = 2 and hora > '19:00' and hora < '21:00' and hora <> '20:00')
        or
        (dia_semana = 4 and hora > '18:30' and hora < '20:30' and hora <> '19:30')
      )
  ) then
    raise exception 'Hay una clase en Diaguitas o de Pau que se solapa con los horarios nuevos (a menos de una hora). El índice único no lo detecta; revisar a mano.';
  end if;

  -- -------------------------------------------------------------------------
  -- 2. Cortar las clases de los horarios viejos desde el corte.
  -- -------------------------------------------------------------------------
  -- Por fecha, no por reloj: la del lunes 07/09 ya pasó en el calendario pero
  -- no se dictó, así que sale igual. Las anteriores al corte (31/08 y 02/09) sí
  -- se dictaron y se quedan.
  --
  -- Primero se cancelan las que tienen alguna reserva. El trigger
  -- `clases_al_cancelar` devuelve el crédito a cada reserva confirmada, siempre
  -- y a su lote original, porque la alumna no tuvo nada que ver. El motivo lo
  -- lee ella en "Mis clases", así que dice a dónde se movió la clase.
  update public.clases c
  set estado = 'cancelada',
      motivo_cancelacion = case
        when c.horario_id = v_viejo_girly
          then 'Cambio de horario: Girly con Pau pasa a los martes a las 20:00, en la misma sede'
        else 'Cambio de horario: Reggaeton Femme con Pau pasa a los jueves a las 19:30, en la misma sede'
      end
  where c.horario_id in (v_viejo_girly, v_viejo_reggaeton)
    and c.estado = 'programada'
    and c.fecha >= v_corte
    and exists (select 1 from public.reservas r where r.clase_id = c.id);

  get diagnostics v_canceladas = row_count;

  -- Después se borran las que nadie reservó nunca. La FK de `reservas` a
  -- `clases` es `on delete restrict`: si algo se colara acá con una reserva, la
  -- base rechaza el borrado y la migración entera se revierte.
  delete from public.clases c
  where c.horario_id in (v_viejo_girly, v_viejo_reggaeton)
    and c.estado = 'programada'
    and c.fecha >= v_corte
    and not exists (select 1 from public.reservas r where r.clase_id = c.id);

  get diagnostics v_borradas = row_count;

  raise notice 'Clases viejas de Pau: % canceladas (con reservas), % borradas (sin reservas).',
    v_canceladas, v_borradas;

  -- -------------------------------------------------------------------------
  -- 3. Desactivar los horarios viejos.
  -- -------------------------------------------------------------------------
  update public.horarios
  set activo = false
  where id in (v_viejo_girly, v_viejo_reggaeton)
    and activo;

  -- -------------------------------------------------------------------------
  -- 4. Crear los horarios nuevos. `where not exists` en vez de `on conflict`
  --    porque los únicos son índices parciales.
  -- -------------------------------------------------------------------------
  insert into public.horarios (curso_id, profesora_id, sede_id, dia_semana, hora)
  select v_girly, v_pau, v_diaguitas, 2, '20:00'::time
  where not exists (
    select 1 from public.horarios
    where curso_id = v_girly and profesora_id = v_pau and sede_id = v_diaguitas
      and dia_semana = 2 and hora = '20:00' and activo and deleted_at is null
  );

  insert into public.horarios (curso_id, profesora_id, sede_id, dia_semana, hora)
  select v_reggaeton, v_pau, v_diaguitas, 4, '19:30'::time
  where not exists (
    select 1 from public.horarios
    where curso_id = v_reggaeton and profesora_id = v_pau and sede_id = v_diaguitas
      and dia_semana = 4 and hora = '19:30' and activo and deleted_at is null
  );

  -- -------------------------------------------------------------------------
  -- 5. Materializar.
  -- -------------------------------------------------------------------------
  -- (a) Las clases entre el corte y hoy. `generar_clases()` parte de
  --     `current_date`, así que si esto se aplica el miércoles, la Girly del
  --     martes 08/09 —que sí se dictó— no existiría en ninguna parte. Misma
  --     fórmula de `inicio` que generar_clases: hora de Santiago, guardada en
  --     UTC. Idempotente por `clases_horario_fecha`.
  insert into public.clases
    (horario_id, fecha, inicio, curso_id, profesora_id, sede_id)
  select h.id, d::date, (d::date + h.hora) at time zone 'America/Santiago',
         h.curso_id, h.profesora_id, h.sede_id
  from public.horarios h
  cross join generate_series(v_corte, current_date, interval '1 day') d
  where h.profesora_id = v_pau
    and h.activo and h.deleted_at is null
    and h.dia_semana in (2, 4)
    and extract(isodow from d) = h.dia_semana
  on conflict (horario_id, fecha) do nothing;

  get diagnostics v_generadas = row_count;
  raise notice 'Clases nuevas de Pau entre el corte y hoy: %.', v_generadas;

  -- (b) El resto, hacia adelante. Solo agrega las de los horarios nuevos porque
  --     las demás ya existen.
  select public.generar_clases() into v_generadas;
  raise notice 'generar_clases() creó % clases.', v_generadas;

  -- -------------------------------------------------------------------------
  -- 6. Verificar. Si algo no cuadra, se aborta y no queda nada a medias.
  -- -------------------------------------------------------------------------
  select count(*) into v_activos from public.horarios
  where profesora_id = v_pau and activo and deleted_at is null;

  if v_activos <> 2 then
    raise exception 'Pau debería quedar con exactamente 2 horarios activos y quedó con %.', v_activos;
  end if;

  if exists (
    select 1 from public.horarios
    where profesora_id = v_pau and activo and deleted_at is null
      and not ((dia_semana = 2 and hora = '20:00') or (dia_semana = 4 and hora = '19:30'))
  ) then
    raise exception 'Pau quedó con un horario activo que no es martes 20:00 ni jueves 19:30.';
  end if;

  select count(*) into v_sobrantes from public.clases
  where horario_id in (v_viejo_girly, v_viejo_reggaeton)
    and estado = 'programada'
    and fecha >= v_corte;

  if v_sobrantes > 0 then
    raise exception 'Quedaron % clases programadas en los horarios viejos de Pau.', v_sobrantes;
  end if;

  -- Cada martes y jueves entre el corte y hoy tiene su clase en el horario
  -- nuevo. Es lo que garantiza que la Girly del 08/09 quedó registrada.
  if exists (
    select 1
    from public.horarios h
    cross join generate_series(v_corte, current_date, interval '1 day') d
    where h.profesora_id = v_pau and h.activo and h.deleted_at is null
      and h.dia_semana in (2, 4)
      and extract(isodow from d) = h.dia_semana
      and not exists (
        select 1 from public.clases c where c.horario_id = h.id and c.fecha = d::date
      )
  ) then
    raise exception 'Falta alguna clase de Pau entre el corte (%) y hoy en los horarios nuevos.', v_corte;
  end if;

  select count(*) into v_nuevas from public.clases c
  join public.horarios h on h.id = c.horario_id
  where h.profesora_id = v_pau and h.activo and h.deleted_at is null
    and c.estado = 'programada' and c.fecha >= v_corte;

  if v_nuevas = 0 then
    raise exception 'No se materializó ninguna clase en los horarios nuevos de Pau. Revisar el parámetro generar_dias.';
  end if;

  raise notice 'Listo: % clases programadas en los horarios nuevos de Pau.', v_nuevas;
end $$;
