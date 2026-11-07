/**
 * Noviembre en staging con las cantidades del escenario de la liquidación, para
 * ver $124.500 y $18.750 en la pantalla. **Por el camino real:** las alumnas
 * reciben créditos con regalar_creditos() y reservan con reservar(), sin escribir
 * reservas a mano. Las clases se cancelan con el mismo update de la clase de Pau.
 * Las causas NO se ponen acá: se ponen desde la pantalla.
 *
 * Idempotente: una alumna que ya reservó esa clase no vuelve a reservar.
 */
import { conectar, staging } from "./staging.mjs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(staging.NEXT_PUBLIC_SUPABASE_URL, staging.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const db = await conectar();
const sql = async (q, p) => (await db.query(q, p)).rows;
const [owner] = await sql(`select user_id from perfiles where rol = 'owner' limit 1`);

async function clase(slug, dia) {
  const [c] = await sql(
    `select cl.id from clases cl join profesoras p on p.id = cl.profesora_id
     where p.slug = $1 and (cl.inicio at time zone 'America/Santiago')::date = $2::date
     order by cl.inicio limit 1`, [slug, dia]);
  if (!c) throw new Error(`No hay clase de ${slug} el ${dia}`);
  return c.id;
}

const alumnas = [];
for (let i = 1; i <= 16; i++) {
  const email = `prueba.${String(i).padStart(2, "0")}@ejemplo.invalid`;
  let [p] = await sql(`select id, user_id from perfiles where email = $1`, [email]);
  if (!p) {
    const nueva = await supabase.auth.admin.createUser({
      email, email_confirm: true, user_metadata: { full_name: `Prueba ${i}` },
    });
    if (nueva.error) throw new Error(nueva.error.message);
    [p] = await sql(`select id, user_id from perfiles where user_id = $1`, [nueva.data.user.id]);
    const r = await supabase.rpc("regalar_creditos", {
      p_perfil_id: p.id, p_cantidad: 5, p_motivo: "Noviembre de prueba en staging", p_actor_user_id: owner.user_id,
    });
    if (r.error) throw new Error(r.error.message);
  }
  alumnas.push(p);
}
console.log("alumnas de prueba:", alumnas.length);

async function llenar(claseId, cuantas) {
  const [{ n: hay }] = await sql(`select count(*)::int n from reservas where clase_id = $1 and estado = 'confirmada'`, [claseId]);
  let faltan = cuantas - hay;
  for (const a of alumnas) {
    if (faltan <= 0) break;
    const [ya] = await sql(`select 1 from reservas where clase_id = $1 and perfil_id = $2`, [claseId, a.id]);
    if (ya) continue;
    const { error } = await supabase.rpc("reservar", {
      p_clase_id: claseId, p_actor_user_id: a.user_id, p_perfil_id: null, p_origen: "web",
    });
    if (error) throw new Error(`reservar: ${error.message}`);
    faltan--;
  }
  const [{ n }] = await sql(`select count(*)::int n from reservas where clase_id = $1 and estado = 'confirmada'`, [claseId]);
  console.log(`  ${claseId.slice(0, 8)}: ${n} (pedidas ${cuantas})`);
}

await llenar(await clase("pau", "2026-11-10"), 16);
await llenar(await clase("pau", "2026-11-24"), 14);
await llenar(await clase("pau", "2026-11-21"), 14);
await llenar(await clase("pau", "2026-11-18"), 12);
const reemplazo = await clase("pau", "2026-11-19").catch(() => clase("drimy", "2026-11-19"));
await llenar(reemplazo, 8);

// El reemplazo: la dicta Drimy. Va antes de cancelar las suyas, que no la incluyen.
const [drimy] = await sql(`select id from profesoras where slug = 'drimy'`);
const r = await supabase.rpc("reasignar_clase", {
  p_actor_user_id: owner.user_id, p_clase_id: reemplazo, p_profesora_nueva_id: drimy.id,
});
if (r.error) throw new Error(r.error.message);

const cancelar = (id) => sql(
  `update public.clases set estado = 'cancelada', motivo_cancelacion = 'Cancelada'
   where id = $1 and estado = 'programada'`, [id]);
await cancelar(await clase("pau", "2026-11-17"));
await cancelar(await clase("pau", "2026-11-26"));
const propias = await sql(
  `select cl.id from clases cl join profesoras p on p.id = cl.profesora_id
   where p.slug = 'drimy' and cl.id <> $1 and cl.estado = 'programada'
     and cl.inicio > now() and cl.inicio < '2026-12-01 03:00+00'`, [reemplazo]);
for (const c of propias) await cancelar(c.id);
console.log("canceladas de Drimy:", propias.length);

// Una que cae fuera del mes: la de Lina del 28/11 cancelada, para recuperarla en diciembre.
const [lina] = await sql(
  `select cl.id from clases cl join profesoras p on p.id = cl.profesora_id
   where p.slug = 'lina' and cl.estado = 'programada' and cl.inicio < '2026-12-01 03:00+00' order by cl.inicio desc limit 1`);
if (lina) { await cancelar(lina.id); console.log("clase de Lina para diciembre:", lina.id); }

// Dos cuentas de profesora para mirar su portal.
for (const slug of ["pau", "drimy"]) {
  const email = `profe.${slug}@ejemplo.invalid`;
  let [p] = await sql(`select id, rol from perfiles where email = $1`, [email]);
  if (!p) {
    const nueva = await supabase.auth.admin.createUser({
      email, email_confirm: true, user_metadata: { full_name: `Profe ${slug}` },
    });
    if (nueva.error) throw new Error(nueva.error.message);
    [p] = await sql(`select id, rol from perfiles where user_id = $1`, [nueva.data.user.id]);
  }
  if (p.rol !== "profesora") {
    await sql(`begin`);
    await sql(`alter table public.perfiles disable trigger user`);
    await sql(`update perfiles set rol = 'profesora', profesora_id = $1, perfil_completo_at = now() where id = $2`, [slug, p.id]);
    await sql(`alter table public.perfiles enable trigger user`);
    await sql(`commit`);
  }
}
await db.end();
