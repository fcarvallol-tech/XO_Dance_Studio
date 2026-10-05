-- Catálogo de octubre de 2026 (Felipe, 05/10/2026).
--
-- Qué resuelve, en una sola transacción:
--   1. XO Teens se deja de dictar por ahora: el curso y su horario quedan
--      INACTIVOS —no se borran, para poder volver— y sus clases ya
--      materializadas salen del calendario.
--   2. Profesora nueva: Isi, con su foto, su bio y su Instagram. La bio de Lina
--      se reemplaza por la nueva que mandó.
--   3. Curso nuevo: Reggaeton Antiguo, dictado por Isi.
--   4. Sede nueva: Studio 98, en Providencia, para 35, a $23.500 la hora.
--   5. Horario nuevo: Reggaeton Antiguo con Isi, viernes 17:00, en Studio 98.
--   6. La vigencia de los créditos pasa de 60 a 45 días, **solo para los que se
--      emitan desde ahora**: los ya emitidos conservan su fecha de vencimiento.
--      La migración lo comprueba y aborta si no.
--
-- Bios, descripción, dificultad (`principiante`), Instagram y costo por hora
-- los mandó Felipe el 05/10/2026. Las bios van tal cual las escribió cada una,
-- en un solo párrafo como las demás.
--
-- Por slug, nunca por uuid: se aplica igual en staging y en producción.
-- Idempotente: se puede volver a correr sin daño.

do $$
declare
  v_hoy constant date := (now() at time zone 'America/Santiago')::date;
  v_teens uuid;
  v_carli uuid;
  v_diaguitas uuid;
  v_horario_teens uuid;
  v_isi uuid;
  v_studio uuid;
  v_curso uuid;
  v_canceladas int;
  v_borradas int;
  v_generadas int;
  v_vencimientos_antes numeric;
  v_vencimientos_despues numeric;
  v_lotes_antes int;
  v_lotes_despues int;
begin
  -- -------------------------------------------------------------------------
  -- 0. Lo que ya existe, por slug
  -- -------------------------------------------------------------------------
  select id into v_teens from public.cursos where slug = 'teens';
  select id into v_carli from public.profesoras where slug = 'carli';
  select id into v_diaguitas from public.sedes where slug = 'diaguitas';
  if v_teens is null or v_carli is null or v_diaguitas is null then
    raise exception 'Falta alguno de los slugs base (teens, carli, diaguitas).';
  end if;

  -- Los créditos ya emitidos, para comprobar al final que no se tocaron.
  select coalesce(sum(extract(epoch from fecha_vencimiento)), 0), count(*)
  into v_vencimientos_antes, v_lotes_antes
  from public.creditos;

  -- -------------------------------------------------------------------------
  -- 1. XO Teens: inactivo, y sus clases futuras fuera del calendario
  -- -------------------------------------------------------------------------
  select id into v_horario_teens from public.horarios
  where curso_id = v_teens and profesora_id = v_carli and sede_id = v_diaguitas
    and dia_semana = 1 and hora = '18:00' and deleted_at is null;

  if v_horario_teens is not null then
    -- Con reservas: se cancelan. El trigger de clases devuelve el crédito a cada
    -- alumna, y el motivo es lo que ella lee en su pantalla.
    update public.clases c
    set estado = 'cancelada',
        motivo_cancelacion = 'XO Teens se deja de dictar por ahora. Te devolvimos la clase para que la uses en otro horario.'
    where c.horario_id = v_horario_teens
      and c.estado = 'programada'
      and c.fecha >= v_hoy
      and exists (select 1 from public.reservas r where r.clase_id = c.id);
    get diagnostics v_canceladas = row_count;

    -- Sin reservas: se borran, como en el cambio de horario de Pau (08/09).
    delete from public.clases c
    where c.horario_id = v_horario_teens
      and c.estado = 'programada'
      and c.fecha >= v_hoy
      and not exists (select 1 from public.reservas r where r.clase_id = c.id);
    get diagnostics v_borradas = row_count;

    update public.horarios set activo = false where id = v_horario_teens and activo;
    raise notice 'Teens: % clases futuras canceladas (con reservas), % borradas (sin reservas).',
      v_canceladas, v_borradas;
  end if;

  update public.cursos set activo = false where id = v_teens and activo;

  -- -------------------------------------------------------------------------
  -- 2. Isi
  -- -------------------------------------------------------------------------
  insert into public.profesoras (slug, nombre, estilo, bio, instagram, foto_url, orden, activa)
  values ('isi', 'Isi', 'Reggaeton Antiguo',
          'Holi🌸 Soy la Isi, bailarina e historiadora. Desde el 2017 me he dedicado al aprendizaje de distintos estilos urbanos como: Hip Hop, Dancehall, Afro Dance y Reggaetón. Entre el 2021 y 2024 me dediqué a realizar clases de danzas urbanas para niñas y adolescentes, y ahí descubrí mi pasión por la enseñanza y el acompañamiento de procesos nuevos para aquellos que comparten ese mismo entusiasmo. Mi interés siempre estará en que aprendas algo nuevo en cada clase, sin dejar de lado el pasarlo bien y el disfrute. Las y los espero💫',
          'https://www.instagram.com/isimonttrios/',
          '/profesoras/isi.webp',
          (select coalesce(max(orden), 0) + 1 from public.profesoras), true)
  on conflict (slug) do update set bio = excluded.bio, instagram = excluded.instagram;
  select id into v_isi from public.profesoras where slug = 'isi';

  -- La bio nueva de Lina.
  update public.profesoras
  set bio = 'Hola! Soy Lina🩷🌟 bailarina, intérprete y profesora. A lo largo de los años he explorado distintos estilos como jazz, urbano y ballet, desarrollando mi propia metodología y forma de enseñar. El objetivo en mis clases es crear un espacio seguro, cómodo y respetuoso donde cada alumna pueda expresarse, conectar con su cuerpo y desarrollar mayor confianza a través del baile, para que cada clase sea una instancia para disfrutar, explorar la sensualidad, potenciar la expresión y sentirse segura siendo una misma, independiente de su nivel o experiencia previa. Nos vemos en clase!✨🌸🩰'
  where slug = 'lina' and bio is distinct from 'Hola! Soy Lina🩷🌟 bailarina, intérprete y profesora. A lo largo de los años he explorado distintos estilos como jazz, urbano y ballet, desarrollando mi propia metodología y forma de enseñar. El objetivo en mis clases es crear un espacio seguro, cómodo y respetuoso donde cada alumna pueda expresarse, conectar con su cuerpo y desarrollar mayor confianza a través del baile, para que cada clase sea una instancia para disfrutar, explorar la sensualidad, potenciar la expresión y sentirse segura siendo una misma, independiente de su nivel o experiencia previa. Nos vemos en clase!✨🌸🩰';
  if not found and not exists (select 1 from public.profesoras where slug = 'lina') then
    raise exception 'No existe la profesora lina.';
  end if;

  -- Su costo: la regla general de CONTEXT.md §5.b, la misma de las demás.
  insert into public.costos_profesoras (profesora_id, base_hora_clp, variable_credito_clp)
  values (v_isi, 18000, 250)
  on conflict (profesora_id) do nothing;

  -- -------------------------------------------------------------------------
  -- 3. Reggaeton Antiguo
  -- -------------------------------------------------------------------------
  insert into public.cursos (slug, nombre, publico, estilo, descripcion, dificultad, orden, activo)
  values ('reggaeton-antiguo', 'Reggaeton Antiguo', 'Desde los 15 años', 'Reggaeton Antiguo',
          'El reggaetón de los 2000, el que sonaba en todas las fiestas. Perreo clásico, con la actitud y el flow de esa época.', 'principiante', 4, true)
  on conflict (slug) do update set descripcion = excluded.descripcion;
  select id into v_curso from public.cursos where slug = 'reggaeton-antiguo';

  -- -------------------------------------------------------------------------
  -- 4. Studio 98
  -- -------------------------------------------------------------------------
  insert into public.sedes (slug, nombre, direccion, comuna, referencia, capacidad, costo_hora_clp, orden, activa)
  values ('studio-98', 'Studio 98', 'Barros Borgoño 71, oficina 101', 'Providencia',
          'cerca del metro Manuel Montt', 35, 23500,
          (select coalesce(max(orden), 0) + 1 from public.sedes), true)
  on conflict (slug) do update set costo_hora_clp = excluded.costo_hora_clp;
  select id into v_studio from public.sedes where slug = 'studio-98';

  -- -------------------------------------------------------------------------
  -- 5. El horario: viernes 17:00
  -- -------------------------------------------------------------------------
  -- Lo que los índices únicos rechazarían, dicho con palabras.
  if exists (
    select 1 from public.horarios
    where activo and deleted_at is null and dia_semana = 5 and hora = '17:00'
      and (sede_id = v_studio or profesora_id = v_isi)
      and not (curso_id = v_curso and profesora_id = v_isi and sede_id = v_studio)
  ) then
    raise exception 'Ya hay otra clase el viernes a las 17:00 en Studio 98 o con Isi.';
  end if;

  insert into public.horarios (curso_id, profesora_id, sede_id, dia_semana, hora)
  select v_curso, v_isi, v_studio, 5, '17:00'::time
  where not exists (
    select 1 from public.horarios
    where curso_id = v_curso and profesora_id = v_isi and sede_id = v_studio
      and dia_semana = 5 and hora = '17:00' and activo and deleted_at is null
  );

  -- Materializa las clases del horario nuevo en la ventana de siempre.
  select public.generar_clases() into v_generadas;
  raise notice 'generar_clases() creó % clases.', v_generadas;

  -- -------------------------------------------------------------------------
  -- 6. Vigencia: 45 días para lo que se emita desde ahora
  -- -------------------------------------------------------------------------
  -- `acreditar_compra` y `regalar_creditos` leen la vigencia **al emitir** y la
  -- guardan en `creditos.fecha_vencimiento`. Nada recalcula esa fecha después,
  -- así que cambiar el plan no toca lo ya emitido. Se comprueba igual.
  update public.planes set vigencia_dias = 45 where vigencia_dias <> 45;
  update public.parametros set valor = '45', updated_at = now()
  where clave = 'regalo_vigencia_dias' and valor <> '45';

  select coalesce(sum(extract(epoch from fecha_vencimiento)), 0), count(*)
  into v_vencimientos_despues, v_lotes_despues
  from public.creditos;
  if v_vencimientos_despues <> v_vencimientos_antes or v_lotes_despues <> v_lotes_antes then
    raise exception 'Algo cambió el vencimiento de créditos ya emitidos: se aborta todo.';
  end if;

  -- -------------------------------------------------------------------------
  -- Comprobaciones finales
  -- -------------------------------------------------------------------------
  if exists (select 1 from public.horarios where curso_id = v_teens and activo and deleted_at is null) then
    raise exception 'Quedó un horario de Teens activo.';
  end if;
  if exists (select 1 from public.clases where curso_id = v_teens and estado = 'programada' and fecha >= v_hoy) then
    raise exception 'Quedaron clases de Teens programadas desde hoy.';
  end if;
  if not exists (
    select 1 from public.horarios
    where curso_id = v_curso and profesora_id = v_isi and sede_id = v_studio
      and dia_semana = 5 and hora = '17:00' and activo and deleted_at is null
  ) then
    raise exception 'No quedó el horario de Reggaeton Antiguo con Isi.';
  end if;
  if exists (select 1 from public.planes where vigencia_dias <> 45) then
    raise exception 'Quedó un plan con vigencia distinta de 45.';
  end if;
end
$$;
