-- PRD-0021 — La sede EB Dance Studio y las dos clases del intensivo de septiembre.
--
-- NO ejecutar a mano: se aplica con `supabase db push`, primero a staging y a
-- producción solo con aprobación.
--
-- ---------------------------------------------------------------------------
-- Por qué esto es una migración y no un script
-- ---------------------------------------------------------------------------
-- Porque el punto es **dejar trazabilidad**. Una migración se revisa en el diff,
-- corre primero en staging, queda en el registro con fecha, y en seis meses
-- alguien puede leer acá por qué existen dos clases de septiembre que nadie
-- reservó por la web. Un script suelto no deja ninguna de esas cuatro cosas.
--
-- ---------------------------------------------------------------------------
-- Qué se carga
-- ---------------------------------------------------------------------------
-- 1. **EB Dance Studio**, la sala más grande de la academia: 40 personas contra
--    las 22 de las otras dos. Queda activa para todo, no solo para intensivos.
-- 2. Las **dos clases del intensivo** de "What you need" de Omar Courtz, con
--    Carli, que **ya se dictaron** ahí: 90 minutos, $8.000, estilo Girly.
--
-- ---------------------------------------------------------------------------
-- Lo que NO se carga, y es la decisión que importa
-- ---------------------------------------------------------------------------
-- **Ni una compra, ni una reserva, ni un crédito.** Todo se cobró por
-- transferencia **fuera del sistema** y nadie reservó por la web. `reservas`
-- exige `credito_id` o `compra_id`, así que anotar a las 35 personas obligaría a
-- fabricar 35 compras que no existieron, y eso sería lo contrario de
-- trazabilidad: números que cuadran y no son ciertos.
--
-- En su lugar va la **asistencia observada** de PRD-0021 §8.3: cuánta gente fue,
-- si el número es exacto o aproximado, y de dónde salió. Del 11/09 el dato es
-- "~35" —una estimación, y así queda marcada—; del 25/09 son 20 exactas.
--
-- Consecuencia buscada: `metricas_resumen` no cuenta esos ingresos, que es lo
-- correcto porque nunca pasaron por el sistema, y coincide con lo ya decidido el
-- 09/09/2026 —"lo cobrado en septiembre no entra a la base ni al tablero".
--
-- ---------------------------------------------------------------------------
-- Dos decisiones técnicas
-- ---------------------------------------------------------------------------
-- · **Las filas se insertan directo, no con `crear_especial()`.** Esa función
--   exige un actor con sesión y una migración no tiene ninguna. Lo que se pierde
--   —sus validaciones— lo cubre el trigger `clases_cupo_cabe_en_la_sala`, que sí
--   corre sobre un insert directo, más las comprobaciones de la fase 5.
-- · **Las clases quedan SIN publicar**, y es una ventaja: `metricas_demanda`
--   filtra `parrilla or publicada_at is not null`, así que no aparecen como dos
--   clases con cero reservas arruinando la ocupación del tablero; tampoco se ven
--   públicamente; y **sí aparecen en la grilla de Carli**, que no filtra por
--   publicada. Justo donde tienen que estar.

-- ---------------------------------------------------------------------------
-- 1. La sala
-- ---------------------------------------------------------------------------

insert into public.sedes
  (slug, nombre, direccion, comuna, referencia, orden, activa, capacidad, costo_hora_clp)
values
  ('eb-dance-studio', 'EB Dance Studio', 'Chucre Manzur 7', 'Providencia',
   'Bellavista', 3, true, 40, 27000)
on conflict (slug) do update set
  direccion = excluded.direccion,
  comuna = excluded.comuna,
  referencia = excluded.referencia,
  capacidad = excluded.capacidad,
  costo_hora_clp = excluded.costo_hora_clp,
  activa = excluded.activa;

-- ---------------------------------------------------------------------------
-- 2. Las dos clases, con su asistencia
-- ---------------------------------------------------------------------------
-- Las horas se escriben en hora de Santiago y se convierten con
-- `at time zone`, **no con un desfase a mano**: en septiembre Chile está en
-- −03:00 porque el reloj se adelantó el primer sábado, pero escribir "−03:00"
-- es el error que ya apareció una vez en el formulario de especiales.

do $$
declare
  v_sede uuid;
  v_curso uuid;
  v_profesora uuid;
  v_nota text := 'Intensivo cobrado por transferencia FUERA del sistema, a $8.000 por '
                 'persona. No hubo reservas por la web y no existe lista de nombres, así '
                 'que la asistencia va como número observado. Cargado por la migración de '
                 'PRD-0021, no por una persona en el portal.';
  v_clase record;
begin
  select id into v_sede from public.sedes where slug = 'eb-dance-studio';
  select id into v_curso from public.cursos where slug = 'girly';
  select id into v_profesora from public.profesoras where slug = 'carli';

  if v_sede is null or v_curso is null or v_profesora is null then
    raise exception 'Falta la sede, el curso Girly o la profesora Carli: no se carga a medias';
  end if;

  for v_clase in
    select *
    from (values
      ('2026-09-11 18:00'::text, 90, 35::smallint, true),
      ('2026-09-25 17:00'::text, 90, 20::smallint, false)
    ) as c (local, duracion, asistentes, aproximado)
  loop
    insert into public.clases
      (tipo, horario_id, fecha, inicio, fin, curso_id, profesora_id, sede_id, cupo_maximo,
       slug, titulo, cancion, descripcion, dificultad, reel_codigo, precio_clp,
       asistentes_registrados, asistentes_aproximados, registro_nota,
       asistencia_registrada_at)
    values
      ('especial',
       null,
       -- La fecha es el día en Santiago, que es el que la persona reconoce.
       v_clase.local::date,
       v_clase.local::timestamp at time zone 'America/Santiago',
       (v_clase.local::timestamp at time zone 'America/Santiago')
         + make_interval(mins => v_clase.duracion),
       v_curso, v_profesora, v_sede, 40,
       public.slug_de('What you need') || '-'
         || to_char(v_clase.local::timestamp, 'YYYYMMDD'),
       'What you need',
       'What you need · Omar Courtz',
       'Intensivo de coreografía completa, fuera de la parrilla.',
       'intermedio',
       'DdErD08oKJm',
       8000,
       v_clase.asistentes,
       v_clase.aproximado,
       v_nota,
       now())
    on conflict (slug) where slug is not null do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Lo que esta migración NO hace
-- ---------------------------------------------------------------------------
-- · No publica las clases: ya ocurrieron, y `publicar_especial` exige fecha
--   futura con razón.
-- · No crea horarios recurrentes en la sala nueva.
-- · No crea compras, reservas ni créditos. Ver arriba.
-- · No sube portada: no hay, y sin publicar no hace falta.
