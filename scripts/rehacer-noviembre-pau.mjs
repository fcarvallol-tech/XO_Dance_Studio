/**
 * Noviembre de Pau en staging, como un mes real (Felipe, 10/11/2026): el
 * horario de los martes con sus 4 clases —10, 17 y 24 más la recuperación del
 * 3/11 el viernes 27—. Antes estaban repartidas entre martes, miércoles y
 * sábado, y al promediar por horario el incentivo desaparecía por los datos de
 * prueba, no por la regla.
 *
 * Dos cambios, idempotentes:
 * 1. El martes 17/11 deja de estar cancelado ("cambio de parrilla" de prueba)
 *    y se llena con 15 reservas, por `reservar()`.
 * 2. La recuperación del 3/11, que estaba el miércoles 18/11 a las 15:00 en la
 *    "Sala de prueba", pasa al viernes 27/11 a las 18:00 en la sala de los
 *    martes. Conserva su horario (el de los martes) y sus 12 reservas.
 *
 * El jueves no se toca: 5/11 cambio de parrilla, 12/11 sin sala con Pau
 * presente y recuperado el sábado 21/11 (14), 19/11 de Drimy, 26/11 sin
 * alumnas y pendiente.
 *
 * Total esperado, a mano: **$127.000** (ver escenario-liquidacion.mjs §4).
 *
 * ⚠️ Escribe en staging. **Sin `--aplicar` solo muestra lo que haría.**
 *   node scripts/rehacer-noviembre-pau.mjs            # mirar
 *   node scripts/rehacer-noviembre-pau.mjs --aplicar  # solo con aprobación de Felipe
 */
import { conectar, staging } from "./staging.mjs";
import { createClient } from "@supabase/supabase-js";

const APLICAR = process.argv.includes("--aplicar");
const db = await conectar();
const sql = async (q, p) => (await db.query(q, p)).rows;

const [pau] = await sql(`select id from profesoras where slug = 'pau'`);
const [martes] = await sql(
  `select id, sede_id, hora from horarios where profesora_id = $1 and activo and dia_semana = 2`, [pau.id]);
const claseDel = async (dia) => (await sql(
  `select id, estado, horario_id, sede_id, recupera_clase_id,
          to_char(inicio at time zone 'America/Santiago', 'Dy DD/MM HH24:MI') cuando,
          (select count(*)::int from reservas r where r.clase_id = clases.id and r.estado = 'confirmada') reservas
   from clases where profesora_id = $1 and (inicio at time zone 'America/Santiago')::date = $2::date
   order by inicio`, [pau.id, dia]));

const [m17] = (await claseDel("2026-11-17")).filter((c) => c.horario_id === martes.id);
const [original] = (await claseDel("2026-11-03")).filter((c) => c.horario_id === martes.id);
const [recuperacion] = await sql(
  `select id, horario_id, to_char(inicio at time zone 'America/Santiago', 'Dy DD/MM HH24:MI') cuando,
          (select count(*)::int from reservas r where r.clase_id = clases.id and r.estado = 'confirmada') reservas
   from clases where recupera_clase_id = $1 and estado = 'programada'`, [original.id]);

console.log("Hoy en staging:");
console.log("  martes 17/11:", m17.estado, `${m17.reservas} reservas`);
console.log("  recuperación del 3/11:", recuperacion.cuando, `${recuperacion.reservas} reservas`,
  recuperacion.horario_id === martes.id ? "(horario de los martes)" : "(OTRO horario)");

const plan = [];
if (m17.estado !== "programada") plan.push("descancelar el martes 17/11 y quitarle la causa de prueba");
if (m17.reservas < 15) plan.push(`llenar el martes 17/11 hasta 15 reservas (tiene ${m17.reservas})`);
if (!recuperacion.cuando.startsWith("Fri 27/11")) plan.push(`mover la recuperación del 3/11 de ${recuperacion.cuando} al viernes 27/11 ${martes.hora.slice(0, 5)}`);
console.log(plan.length ? `\nLo que haría:\n${plan.map((p) => `  - ${p}`).join("\n")}` : "\nYa está como debe.");

if (!APLICAR || plan.length === 0) {
  if (!APLICAR && plan.length) console.log("\nNo se escribió nada. Con --aplicar, y solo con aprobación de Felipe.");
  await db.end();
  process.exit(0);
}

const supabase = createClient(staging.NEXT_PUBLIC_SUPABASE_URL, staging.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 1. El 17/11 vuelve a estar en pie. Cancelada (no no_dictada) sí puede volver.
await sql(`begin`);
await sql(`update clases set estado = 'programada', motivo_cancelacion = null where id = $1 and estado = 'cancelada'`, [m17.id]);
await sql(`update causas_de_clase set deleted_at = now() where clase_id = $1 and deleted_at is null`, [m17.id]);
// 2. La recuperación, al viernes 27 a la hora y en la sala de los martes.
await sql(
  `update clases set fecha = date '2026-11-27',
          inicio = (date '2026-11-27' + $2::time) at time zone 'America/Santiago',
          fin = (date '2026-11-27' + $2::time) at time zone 'America/Santiago' + (fin - inicio),
          sede_id = $3
   where id = $1`, [recuperacion.id, martes.hora, martes.sede_id]);
await sql(`commit`);

// Las reservas, por el camino real.
const alumnas = await sql(`select id, user_id from perfiles where email like 'prueba.%@ejemplo.invalid' order by email`);
const [owner] = await sql(`select user_id from perfiles where rol = 'owner' limit 1`);
let faltan = 15 - (await claseDel("2026-11-17")).find((c) => c.id === m17.id).reservas;
for (const a of alumnas) {
  if (faltan <= 0) break;
  const [ya] = await sql(`select 1 from reservas where clase_id = $1 and perfil_id = $2 and estado = 'confirmada'`, [m17.id, a.id]);
  if (ya) continue;
  const [{ n }] = await sql(`select coalesce(sum(cantidad_disponible), 0)::int n from creditos where perfil_id = $1 and fecha_vencimiento > now()`, [a.id]);
  if (n === 0) {
    const r = await supabase.rpc("regalar_creditos", {
      p_perfil_id: a.id, p_cantidad: 5, p_motivo: "Noviembre de prueba en staging", p_actor_user_id: owner.user_id,
    });
    if (r.error) throw new Error(r.error.message);
  }
  const { error } = await supabase.rpc("reservar", {
    p_clase_id: m17.id, p_actor_user_id: a.user_id, p_perfil_id: null, p_origen: "web",
  });
  if (error) throw new Error(`reservar: ${error.message}`);
  faltan--;
}

console.log("\nQuedó:");
console.log("  martes 17/11:", (await claseDel("2026-11-17")).find((c) => c.id === m17.id));
console.log("  recuperación:", (await claseDel("2026-11-27")).find((c) => c.id === recuperacion.id));
await db.end();
