-- PRD-0032 — Avisarle a la alumna que se le vencen las clases.
--
-- El problema: al 09/11 hay 47 alumnas con 131 clases sin usar que vencen entre
-- el 3 y el 7 de diciembre, y nadie les avisa. Esta función es la que dice a
-- quién hay que escribirle y cuántas clases le quedan.
--
-- Sin tablas nuevas. El correo va por la cola de PRD-0019 (`envios_correo`),
-- con la clave `vencimiento:<perfil>:<fecha>`, que es única ahí: un aviso por
-- persona y por vencimiento, corra el barrido las veces que corra.
--
-- ⚠️ La clave se arma igual en `lib/dominio/vencimientos.ts`
-- (`claveDeVencimiento`). Si cambia una, cambia la otra.

/**
 * Dos preguntas con la misma regla de "qué le queda":
 *
 * 1. **Sin persona** (`p_perfil_id` null): qué avisos hay que encolar hoy. Una
 *    fila por persona y fecha de vencimiento en Chile, con la suma de lo
 *    disponible, si:
 *      - la cuenta es de alumna y no está borrada (§3.6: las profesoras con
 *        créditos de regalo no reciben aviso);
 *      - le queda algo (§3.4; un lote revocado entero queda en 0);
 *      - vence en **10 a 3 días** desde `p_hoy` (§3.7: 10 es el día normal;
 *        de 9 a 3 es la recuperación si un barrido no corrió; con menos de 3
 *        "vencen pasado mañana" llega tarde para organizarse);
 *      - y todavía no hay una fila con esa clave, en ningún estado: si se
 *        descartó, también cuenta como avisado.
 *
 * 2. **Con persona y fecha**: cuánto le queda **ahora** en ese vencimiento.
 *    Es el chequeo al enviar o reintentar (§3.4, §6): si usó sus clases entre
 *    que se encoló y se mandó, devuelve 0 filas y el envío queda descartado; si
 *    usó una parte, el correo dice lo que queda. Acá no se mira ni la ventana
 *    ni la clave, porque la fila ya existe: eso lo cubre `caduca_at`.
 *
 * `p_hoy` es un parámetro y no `now()` para poder probar el 23/11 sin esperar
 * al 23/11.
 *
 * `security definer` porque lee `creditos` y `perfiles` de todas las personas,
 * con correo. Por eso **solo la ejecuta `service_role`**: ninguna sesión, ni
 * la de owner. La llama el barrido de `/api/correos`, que no es una persona.
 */
create or replace function public.avisos_de_vencimiento_pendientes(
  p_hoy date,
  p_perfil_id uuid default null,
  p_vence date default null
)
returns table (
  perfil_id uuid,
  correo text,
  nombre text,
  vence date,
  vence_at timestamptz,
  clases int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_hoy is null then
    raise exception 'Falta p_hoy' using errcode = '22023';
  end if;
  if p_perfil_id is not null and p_vence is null then
    raise exception 'Con persona hace falta la fecha de vencimiento' using errcode = '22023';
  end if;

  return query
  with lotes as (
    select
      c.perfil_id,
      (c.fecha_vencimiento at time zone 'America/Santiago')::date as vence,
      c.fecha_vencimiento,
      c.cantidad_disponible
    from public.creditos c
    where c.cantidad_disponible > 0
      and c.fecha_vencimiento > now()
      and (p_perfil_id is null or c.perfil_id = p_perfil_id)
  )
  select
    p.id,
    p.email,
    p.nombre,
    l.vence,
    min(l.fecha_vencimiento),
    sum(l.cantidad_disponible)::int
  from lotes l
  join public.perfiles p on p.id = l.perfil_id
  where p.rol = 'alumna'
    and p.deleted_at is null
    and (
      -- Con persona: solo esa fecha.
      (p_perfil_id is not null and l.vence = p_vence)
      or
      -- Sin persona: la ventana de 10 a 3 días, y sin aviso previo.
      (p_perfil_id is null
        and l.vence - p_hoy between 3 and 10
        and not exists (
          select 1 from public.envios_correo e
          where e.clave_idempotencia =
            'vencimiento:' || p.id::text || ':' || to_char(l.vence, 'YYYY-MM-DD')
        ))
    )
  group by p.id, p.email, p.nombre, l.vence
  order by l.vence, p.id;
end;
$$;

-- Ninguna sesión la ejecuta. `public` no alcanza: Supabase le da EXECUTE a
-- anon y authenticated por privilegios por defecto, así que se revocan por
-- nombre. Y el grant a service_role va escrito, aunque hoy funcione sin él
-- (CLAUDE.md, PRD-0008 §15).
revoke all on function public.avisos_de_vencimiento_pendientes(date, uuid, date)
  from public, anon, authenticated;
grant execute on function public.avisos_de_vencimiento_pendientes(date, uuid, date)
  to service_role;

comment on function public.avisos_de_vencimiento_pendientes(date, uuid, date) is
  'PRD-0032. Sin persona: los avisos de vencimiento a encolar hoy (alumna, disponible > 0, de 10 a 3 días, sin fila con la clave vencimiento:<perfil>:<fecha>). Con persona y fecha: cuánto le queda ahora en ese vencimiento. Solo service_role.';
