-- PRD-0021 — La capacidad es de la sala, y las clases dictadas dejan rastro.
--
-- NO ejecutar a mano: se aplica con `supabase db push`, primero a staging y a
-- producción solo con aprobación.
--
-- ---------------------------------------------------------------------------
-- Qué resuelve
-- ---------------------------------------------------------------------------
-- Hay una sala nueva de **40 personas** contra las 22 de las otras dos, y dos
-- clases de un intensivo que **ya se dictaron** ahí, de hora y media, cobradas
-- por transferencia fuera del sistema. Cargar eso destapó tres supuestos:
--
--   1. El 22 estaba escrito en `crear_especial` como si fuera una regla del
--      sistema —"El cupo va de 1 a 22"— cuando es la medida de dos salas. Con
--      eso, una clase de 40 personas **no se podía crear**.
--   2. `generar_clases` no seteaba cupo: caía al default de la columna, así que
--      toda la parrilla nacía en 22 sin mirar dónde.
--   3. `reservas` exige `credito_id` o `compra_id`, así que no había forma de
--      anotar que fueron 35 personas sin fabricar 35 compras que no existieron.
--
-- **Reemplaza PRD-0018 §9.8.** El cupo por defecto pasa a ser la capacidad de la
-- sala; se puede bajar y no subir por encima de ella.
--
-- Y el costo por hora de la sala **no es público**: es lo que la academia paga,
-- puede estar negociado, y junto al precio por clase deja calcular el margen.
-- Ver la sección 2.

-- ---------------------------------------------------------------------------
-- 1. La sala sabe cuánta gente le cabe y cuánto cuesta
-- ---------------------------------------------------------------------------

alter table public.sedes
  add column if not exists capacidad smallint not null default 22
    check (capacidad between 1 and 200),
  add column if not exists costo_hora_clp int
    check (costo_hora_clp is null or costo_hora_clp >= 0);

-- Las dos que ya existen miden 22. Explícito y no heredado del default: el 22
-- pasa a ser un dato de esas dos salas, no un número del sistema.
update public.sedes set capacidad = 22
  where slug in ('seduccion-latina', 'diaguitas');

comment on column public.sedes.capacidad is
  'Cuánta gente le cabe. El cupo de una clase no puede superarla (PRD-0021). Diaguitas y Seducción Latina miden 22; EB Dance Studio, 40.';

comment on column public.sedes.costo_hora_clp is
  'Lo que la academia paga por hora de sala. NO es público: ver los grants por columna. La tabla de finanzas de PRD-0010 parte 2 lo va a leer de acá.';

-- ---------------------------------------------------------------------------
-- 2. El costo por hora queda fuera de lo que la API expone
-- ---------------------------------------------------------------------------
-- Decidido por Felipe el 26/09/2026: no es el precio de lista de la sala, es lo
-- que él paga —puede estar negociado— y junto al precio por clase cualquiera
-- calcula el margen de la academia.
--
-- **No hace falta una tabla aparte.** PostgREST respeta los permisos por
-- columna, y todas nuestras lecturas públicas de `sedes` piden columnas
-- explícitas (`CAMPOS_SEDE` en `lib/catalogo-consultas.ts`), nunca `*`. Así que
-- se le quita el select de tabla a `anon` y `authenticated` y se les devuelve
-- columna por columna, salvo el costo.
--
-- ⚠️ **La contrapartida, y hay que tenerla presente:** desde ahora, una columna
-- nueva en `sedes` **no la ve `anon` hasta que alguien la agregue a esta lista**.
-- Falla fuerte —`permission denied for column`— y no en silencio, que es lo
-- mejor que se puede pedir; y el escenario de la fase 3 compara la lista de
-- columnas legibles contra la esperada, así que agregar una sin decidir aparece
-- como diferencia en la corrida y no como una sorpresa en producción.

revoke select on public.sedes from anon, authenticated;

grant select (id, slug, nombre, direccion, comuna, referencia, orden, activa,
              capacidad, created_at, updated_at, deleted_at)
  on public.sedes to anon, authenticated;

-- El servidor sí lo lee: la liquidación necesita el costo.
grant select on public.sedes to service_role;

-- ---------------------------------------------------------------------------
-- 3. Una clase que ya se dictó, con su asistencia observada
-- ---------------------------------------------------------------------------
-- **Sin compras y sin reservas.** La plata se cobró por transferencia fuera del
-- sistema y nadie reservó por la web: inventar 35 compras para que los números
-- cuadren sería lo contrario de trazabilidad.

alter table public.clases
  add column if not exists asistentes_registrados smallint
    check (asistentes_registrados is null or asistentes_registrados >= 0),
  -- "~35" y "20" no son el mismo tipo de dato. El tablero que algún día los lea
  -- tiene que poder distinguir una cuenta de una estimación.
  add column if not exists asistentes_aproximados boolean not null default false,
  add column if not exists registro_nota text,
  add column if not exists asistencia_registrada_por uuid references public.perfiles (id),
  add column if not exists asistencia_registrada_at timestamptz;

comment on column public.clases.asistentes_registrados is
  'Cuánta gente fue, observado a mano. Para clases cobradas fuera del sistema, donde no hay reservas. No crea ni compras ni reservas (PRD-0021 §8.3).';

-- ---------------------------------------------------------------------------
-- 4. El cupo no puede superar la sala, se escriba por donde se escriba
-- ---------------------------------------------------------------------------
-- El trigger es la regla; los mensajes lindos de las funciones son cortesía.
-- Un check de tabla no sirve —no puede consultar otra tabla— y poner la
-- validación solo en las funciones deja fuera los inserts directos, que son
-- justamente los que hace una migración de datos como la de la fase 4.
--
-- **No se aplica hacia atrás**: si mañana se remide una sala y queda más chica,
-- las clases ya dictadas no se vuelven inválidas. Por eso valida en insert y en
-- update del cupo o de la sede, no sobre lo que ya está guardado.

create or replace function public.clase_cabe_en_la_sala()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  v_capacidad smallint;
begin
  select capacidad into v_capacidad from public.sedes where id = new.sede_id;

  if v_capacidad is not null and new.cupo_maximo > v_capacidad then
    raise exception 'El cupo (%) no cabe en la sala, que es de %', new.cupo_maximo, v_capacidad
      using errcode = '23514';
  end if;

  return new;
end;
$fn$;

drop trigger if exists clases_cupo_cabe_en_la_sala on public.clases;
create trigger clases_cupo_cabe_en_la_sala
  before insert or update of cupo_maximo, sede_id on public.clases
  for each row execute function public.clase_cabe_en_la_sala();

-- ---------------------------------------------------------------------------
-- 5. Registrar la asistencia de una clase que ya ocurrió
-- ---------------------------------------------------------------------------

create or replace function public.registrar_asistencia(
  p_clase_id uuid,
  p_actor_user_id uuid,
  p_cantidad smallint,
  p_aproximado boolean default false,
  p_nota text default null
)
returns public.clases
language plpgsql
security definer
set search_path = public
as $fn$
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
    raise exception 'La clase no existe' using errcode = 'P0002';
  end if;
  if v_clase.inicio > now() then
    raise exception 'Esa clase todavía no ocurrió: no tiene asistentes' using errcode = '22023';
  end if;
  if p_cantidad is null or p_cantidad < 0 then
    raise exception 'La asistencia va de 0 en adelante' using errcode = '23514';
  end if;

  -- Se sobreescribe, no se acumula: es un dato observado, no un contador.
  update public.clases
  set asistentes_registrados = p_cantidad,
      asistentes_aproximados = coalesce(p_aproximado, false),
      registro_nota = nullif(btrim(p_nota), ''),
      asistencia_registrada_por = v_actor.id,
      asistencia_registrada_at = now()
  where id = v_clase.id
  returning * into v_clase;

  return v_clase;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 6. Las funciones que tenían el 22 escrito
-- ---------------------------------------------------------------------------
-- Cuerpos completos, con el bloque del cupo cambiado y nada más. Se reprodujeron
-- desde el archivo de PRD-0018 con un reemplazo puntual para no arrastrar
-- diferencias al copiarlos a mano.

create or replace function public.crear_especial(
  p_actor_user_id uuid,
  p_titulo text,
  p_curso_id uuid,
  p_profesora_id uuid,
  p_sede_id uuid,
  p_inicio timestamptz,
  p_duracion_min int default 60,
  p_cupo_maximo int default null,
  p_cancion text default null,
  p_descripcion text default null,
  p_dificultad text default null,
  p_reel_url text default null,
  p_portada_path text default null,
  p_precio_clp int default null,
  p_minimo_alumnas int default null
)
returns public.clases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_precio int;
  v_reel text;
  v_fin timestamptz;
  v_slug text;
  v_base text;
  v_n int := 1;
  v_choca uuid;
  v_capacidad smallint;
  v_cupo int;
  v_clase public.clases;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  if coalesce(btrim(p_titulo), '') = '' then
    raise exception 'La clase necesita un título' using errcode = '23514';
  end if;
  if p_inicio is null then
    raise exception 'La clase necesita fecha y hora' using errcode = '23514';
  end if;
  if p_duracion_min is null or p_duracion_min < 30 or p_duracion_min > 180 then
    raise exception 'La duración va de 30 a 180 minutos' using errcode = '23514';
  end if;
  if p_dificultad is not null
     and p_dificultad not in ('principiante', 'intermedio', 'avanzado') then
    raise exception 'Dificultad inválida' using errcode = '23514';
  end if;
  if not exists (select 1 from public.cursos where id = p_curso_id and deleted_at is null) then
    raise exception 'El curso no existe' using errcode = 'P0002';
  end if;
  -- Las especiales son para 15+ (§4). El formulario no ofrece Teens; la base
  -- tampoco lo acepta.
  if exists (select 1 from public.cursos where id = p_curso_id and slug = 'teens') then
    raise exception 'Las clases especiales no son para Teens' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profesoras where id = p_profesora_id and deleted_at is null) then
    raise exception 'La profesora no existe' using errcode = 'P0002';
  end if;
  select capacidad into v_capacidad from public.sedes
  where id = p_sede_id and deleted_at is null;

  if v_capacidad is null then
    raise exception 'La sede no existe' using errcode = 'P0002';
  end if;

  -- **El cupo sale de la sala** (PRD-0021 §8.1). Sin cupo explícito es la
  -- capacidad; con cupo, no puede superarla. Hasta el 26/09/2026 el tope era un
  -- 22 escrito acá, que era tratar la medida de dos salas como una regla del
  -- sistema: la sala nueva mide 40 y no se podía usar.
  v_cupo := coalesce(p_cupo_maximo, v_capacidad);
  if v_cupo < 1 or v_cupo > v_capacidad then
    raise exception 'El cupo va de 1 a %, que es la capacidad de la sala', v_capacidad
      using errcode = '23514';
  end if;

  -- El precio: owner lo fija; admin usa el default, y sin default no crea.
  if p_precio_clp is not null and public.nivel_rol(v_actor.rol) >= public.nivel_rol('owner') then
    v_precio := p_precio_clp;
  else
    v_precio := public.parametro_int('especial_precio_default_clp', null);
  end if;
  if v_precio is null then
    raise exception 'Falta el precio por defecto: lo carga owner en parámetros (especial_precio_default_clp), o crea la clase con precio'
      using errcode = '23514';
  end if;
  if v_precio < 0 then
    raise exception 'El precio no puede ser negativo' using errcode = '23514';
  end if;

  if p_reel_url is not null then
    v_reel := public.codigo_de_reel(p_reel_url);
    if v_reel is null then
      raise exception 'El link tiene que ser un Reel o un post de Instagram' using errcode = '23514';
    end if;
  end if;

  v_fin := p_inicio + make_interval(mins => p_duracion_min);

  -- Nada se guarda si se pisa con otra clase, ni como borrador (§9.3).
  v_choca := public.solape_de_especial(null, p_sede_id, p_profesora_id, p_inicio, v_fin);
  if v_choca is not null then
    raise exception 'Se pisa con otra clase en esa sede o de esa profesora a esa hora'
      using errcode = '23514', detail = v_choca::text;
  end if;

  -- Slug: el título más la fecha en Santiago; si ya existe, se numera.
  v_base := public.slug_de(p_titulo) || '-'
            || to_char(p_inicio at time zone 'America/Santiago', 'YYYYMMDD');
  v_slug := v_base;
  while exists (select 1 from public.clases where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.clases
    (tipo, horario_id, fecha, inicio, fin, curso_id, profesora_id, sede_id, cupo_maximo,
     slug, titulo, cancion, descripcion, dificultad, reel_codigo, portada_path,
     precio_clp, minimo_alumnas, creada_por)
  values
    ('especial', null, (p_inicio at time zone 'America/Santiago')::date, p_inicio, v_fin,
     p_curso_id, p_profesora_id, p_sede_id, v_cupo,
     v_slug, btrim(p_titulo), nullif(btrim(p_cancion), ''), nullif(btrim(p_descripcion), ''),
     p_dificultad, v_reel, nullif(btrim(p_portada_path), ''),
     v_precio, p_minimo_alumnas, v_actor.id)
  returning * into v_clase;

  return v_clase;
end;
$$;

create or replace function public.editar_especial(
  p_actor_user_id uuid,
  p_clase_id uuid,
  p_titulo text default null,
  p_curso_id uuid default null,
  p_profesora_id uuid default null,
  p_sede_id uuid default null,
  p_inicio timestamptz default null,
  p_duracion_min int default null,
  p_cupo_maximo int default null,
  p_cancion text default null,
  p_descripcion text default null,
  p_dificultad text default null,
  p_reel_url text default null,
  p_portada_path text default null,
  p_precio_clp int default null,
  p_minimo_alumnas int default null
)
returns public.clases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_clase public.clases;
  v_inicio timestamptz;
  v_fin timestamptz;
  v_duracion int;
  v_reel text;
  v_choca uuid;
  v_capacidad smallint;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('admin') then
    raise exception 'Se necesita rol admin o superior' using errcode = '42501';
  end if;

  select * into v_clase from public.clases where id = p_clase_id for update;

  if v_clase is null or v_clase.tipo <> 'especial' then
    raise exception 'La clase especial no existe' using errcode = 'P0002';
  end if;
  if v_clase.estado = 'cancelada' then
    raise exception 'Una clase cancelada no se edita' using errcode = '22023';
  end if;

  if p_titulo is not null and btrim(p_titulo) = '' then
    raise exception 'La clase necesita un título' using errcode = '23514';
  end if;
  if p_duracion_min is not null and (p_duracion_min < 30 or p_duracion_min > 180) then
    raise exception 'La duración va de 30 a 180 minutos' using errcode = '23514';
  end if;
  -- Contra la capacidad de la sala **que va a quedar**, que puede ser la nueva
  -- si en la misma edición se cambia de sede (PRD-0021 §9.1).
  if p_cupo_maximo is not null then
    select capacidad into v_capacidad from public.sedes
    where id = coalesce(p_sede_id, v_clase.sede_id) and deleted_at is null;

    if v_capacidad is null then
      raise exception 'La sede no existe' using errcode = 'P0002';
    end if;
    if p_cupo_maximo < 1 or p_cupo_maximo > v_capacidad then
      raise exception 'El cupo va de 1 a %, que es la capacidad de la sala', v_capacidad
        using errcode = '23514';
    end if;
  end if;
  if p_cupo_maximo is not null and p_cupo_maximo < public.cupo_tomado(v_clase.id) then
    raise exception 'Hay más reservas que ese cupo' using errcode = '23514';
  end if;
  if p_dificultad is not null
     and p_dificultad not in ('principiante', 'intermedio', 'avanzado') then
    raise exception 'Dificultad inválida' using errcode = '23514';
  end if;
  if p_curso_id is not null then
    if not exists (select 1 from public.cursos where id = p_curso_id and deleted_at is null) then
      raise exception 'El curso no existe' using errcode = 'P0002';
    end if;
    if exists (select 1 from public.cursos where id = p_curso_id and slug = 'teens') then
      raise exception 'Las clases especiales no son para Teens' using errcode = '23514';
    end if;
  end if;
  if p_profesora_id is not null
     and not exists (select 1 from public.profesoras where id = p_profesora_id and deleted_at is null) then
    raise exception 'La profesora no existe' using errcode = 'P0002';
  end if;
  if p_sede_id is not null
     and not exists (select 1 from public.sedes where id = p_sede_id and deleted_at is null) then
    raise exception 'La sede no existe' using errcode = 'P0002';
  end if;
  if p_precio_clp is not null and p_precio_clp < 0 then
    raise exception 'El precio no puede ser negativo' using errcode = '23514';
  end if;

  if p_reel_url is not null then
    v_reel := public.codigo_de_reel(p_reel_url);
    if v_reel is null then
      raise exception 'El link tiene que ser un Reel o un post de Instagram' using errcode = '23514';
    end if;
  end if;

  v_inicio := coalesce(p_inicio, v_clase.inicio);
  v_duracion := coalesce(p_duracion_min,
                         (extract(epoch from (v_clase.fin - v_clase.inicio)) / 60)::int);
  v_fin := v_inicio + make_interval(mins => v_duracion);

  v_choca := public.solape_de_especial(
    v_clase.id,
    coalesce(p_sede_id, v_clase.sede_id),
    coalesce(p_profesora_id, v_clase.profesora_id),
    v_inicio, v_fin);
  if v_choca is not null then
    raise exception 'Se pisa con otra clase en esa sede o de esa profesora a esa hora'
      using errcode = '23514', detail = v_choca::text;
  end if;

  update public.clases
  set titulo = coalesce(nullif(btrim(p_titulo), ''), titulo),
      curso_id = coalesce(p_curso_id, curso_id),
      profesora_id = coalesce(p_profesora_id, profesora_id),
      sede_id = coalesce(p_sede_id, sede_id),
      inicio = v_inicio,
      fin = v_fin,
      fecha = (v_inicio at time zone 'America/Santiago')::date,
      cupo_maximo = coalesce(p_cupo_maximo, cupo_maximo),
      cancion = coalesce(nullif(btrim(p_cancion), ''), cancion),
      descripcion = coalesce(nullif(btrim(p_descripcion), ''), descripcion),
      dificultad = coalesce(p_dificultad, dificultad),
      reel_codigo = coalesce(v_reel, reel_codigo),
      portada_path = coalesce(nullif(btrim(p_portada_path), ''), portada_path),
      -- Solo owner. Un admin que manda precio no cambia nada.
      precio_clp = case
        when p_precio_clp is not null
             and public.nivel_rol(v_actor.rol) >= public.nivel_rol('owner')
          then p_precio_clp
        else precio_clp end,
      minimo_alumnas = coalesce(p_minimo_alumnas, minimo_alumnas)
  where id = v_clase.id
  returning * into v_clase;

  return v_clase;
end;
$$;

create or replace function public.generar_clases(p_dias int default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dias int := coalesce(p_dias, public.parametro_int('generar_dias', 70));
  v_creadas int;
begin
  with fechas as (
    select h.id as horario_id, h.curso_id, h.profesora_id, h.sede_id, h.hora,
           s.capacidad, d::date as fecha
    from public.horarios h
    -- El cupo de cada clase sale de su sala (PRD-0021 §8.1). Antes no se
    -- seteaba y caía al default de la columna, que era 22 para todas.
    join public.sedes s on s.id = h.sede_id and s.deleted_at is null
    cross join generate_series(current_date, current_date + v_dias, interval '1 day') d
    where h.activo
      and h.deleted_at is null
      -- ISO: extract(isodow) da 1 = lunes … 7 = domingo, igual que dia_semana.
      and extract(isodow from d) = h.dia_semana
  )
  insert into public.clases
    (horario_id, fecha, inicio, curso_id, profesora_id, sede_id, cupo_maximo)
  select
    f.horario_id,
    f.fecha,
    -- Las clases se piensan en hora de Santiago; se guardan en UTC.
    (f.fecha + f.hora) at time zone 'America/Santiago',
    f.curso_id, f.profesora_id, f.sede_id, f.capacidad
  from fechas f
  on conflict (horario_id, fecha) do nothing;

  get diagnostics v_creadas = row_count;
  return v_creadas;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Permisos, escritos y no heredados del default
-- ---------------------------------------------------------------------------

revoke all on function public.clase_cabe_en_la_sala() from public, anon, authenticated;
revoke all on function public.registrar_asistencia(uuid, uuid, smallint, boolean, text)
  from public, anon, authenticated;

grant execute on function public.registrar_asistencia(uuid, uuid, smallint, boolean, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 8. Lo que esta migración NO hace
-- ---------------------------------------------------------------------------
-- · No carga la sede nueva ni las clases del intensivo: eso es la migración
--   siguiente, separada para que el diff de los datos se lea aparte del de las
--   reglas.
-- · No muestra la asistencia en ninguna pantalla. Mostrarla —y decidir si cuenta
--   como "clase dictada" para la liquidación— es PRD-0010 §8.5.
-- · No crea horarios en la sala nueva.
-- · No toca las clases existentes: sus cupos de 22 siguen siendo válidos porque
--   las dos salas viejas miden 22.
