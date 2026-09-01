-- PRD-0017 parte 2 — La base pasa a ser la única fuente de precios.
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`.
--
-- La parte 1 creó `planes` mientras `lib/planes.ts` seguía dibujando la sección
-- Planes del sitio: dos fuentes para el mismo precio. Ya nos pasó con los
-- cursos y terminó en una incoherencia visible. Acá la base queda mandando y
-- el archivo se reduce a tipos y formato.

-- ---------------------------------------------------------------------------
-- 1. La promoción, en la base
-- ---------------------------------------------------------------------------
-- Forma provisional a propósito: PRD-0012 diseñó una tabla aparte con período,
-- nombre, tope y administración exclusiva de owner. Estas dos columnas son lo
-- mínimo para que el precio promocional no se quede en el código, y PRD-0012
-- las reemplaza cuando llegue.
--
-- Gana algo de inmediato: PRD-0014 §5 advertía que la promo "se apaga a mano y
-- necesita deploy" porque la landing es estática. Con esto se apaga desde el
-- Table Editor y el webhook refresca el sitio en segundos.

alter table public.planes
  add column if not exists precio_promocional int
    check (precio_promocional is null or precio_promocional >= 0),
  add column if not exists promo_hasta date,
  add column if not exists promo_nombre text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'planes_promo_completa') then
    alter table public.planes add constraint planes_promo_completa
      -- Un precio promocional sin fecha de término es una promo que no termina.
      check (precio_promocional is null or promo_hasta is not null);
  end if;
end $$;

comment on column public.planes.precio_promocional is
  'Provisional hasta PRD-0012: precio vigente mientras promo_hasta no pase. Nulo = sin promoción.';

-- La promo de lanzamiento, tal como estaba en lib/planes.ts.
update public.planes
set precio_promocional = 20000, promo_hasta = date '2026-08-31',
    promo_nombre = 'Promo de lanzamiento'
where slug = 'pack-4';

update public.planes
set precio_promocional = 36000, promo_hasta = date '2026-08-31',
    promo_nombre = 'Promo de lanzamiento'
where slug = 'pack-8';

-- ---------------------------------------------------------------------------
-- 2. Los datos de transferencia
-- ---------------------------------------------------------------------------
-- Sin esto la alumna no puede transferir. Van en `parametros` y no en el
-- código por lo mismo de siempre: cambian sin deploy.
--
-- ⚠️ SE SIEMBRAN VACÍOS A PROPÓSITO. No los conozco y no se inventan datos
-- bancarios. Mientras estén vacíos, la página de compra muestra que faltan y
-- no deja declarar: es mejor eso que mandar a alguien a transferir a ninguna
-- parte. Se cargan desde el Table Editor.

insert into public.parametros (clave, valor, descripcion) values
  ('transferencia_banco', '', 'Banco de la cuenta de XO. POR CONFIRMAR.'),
  ('transferencia_tipo_cuenta', '', 'Corriente, vista o ahorro. POR CONFIRMAR.'),
  ('transferencia_numero', '', 'Número de cuenta. POR CONFIRMAR.'),
  ('transferencia_rut', '', 'RUT de XO Dance Studio SpA. POR CONFIRMAR.'),
  ('transferencia_titular', 'XO Dance Studio SpA', 'Nombre del titular de la cuenta.'),
  ('transferencia_correo', 'xo.dancestudioo@gmail.com', 'Correo al que llega el comprobante del banco.'),
  ('correo_academia', 'xo.dancestudioo@gmail.com', 'A dónde llega el aviso de transferencia declarada.')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- 3. El grant que faltaba en `parametros`
-- ---------------------------------------------------------------------------
-- La parte 1 revocó todo sobre `parametros` y lo devolvió a `anon` y
-- `authenticated`, pero olvidó a `service_role`. Postgres lo dice literal:
-- "GRANT SELECT ON public.parametros TO service_role".
--
-- Hoy no se nota porque `parametro_int` es security definer y corre como su
-- dueño, pero cualquier lectura directa con el cliente admin responde 42501.
-- Es el mismo descuido que hubo con `perfiles`: en los proyectos nuevos de
-- Supabase los privilegios por defecto ya no alcanzan a los roles del Data API
-- y hay que escribirlos.

grant select, insert, update on public.parametros to service_role;

/** Varios parámetros de una, para no hacer siete consultas. */
create or replace function public.parametros_como_json()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(clave, valor), '{}'::jsonb) from public.parametros;
$$;

grant execute on function public.parametros_como_json() to anon, authenticated, service_role;
