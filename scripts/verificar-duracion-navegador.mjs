/**
 * Después de rellenar `fin`: los montos de noviembre tienen que ser exactamente
 * los mismos (Felipe, 06/11/2026). Se anula lo cerrado desde la pantalla para que
 * se recalcule con los `fin` reales. Reemplaza hoy_santiago() y la restaura.
 */
import { caso, db, fin, navegador, sesion, sql, texto, SITIO } from "./verificar-staging-comun.mjs";

const RESTAURAR = `create or replace function public.hoy_santiago() returns date language sql stable as $$
  select (now() at time zone 'America/Santiago')::date;
$$`;
const FIJAR = `create or replace function public.hoy_santiago() returns date language sql stable as $$ select date '2026-12-02' $$`;
const URL_MES = "/owner/liquidaciones?mes=2026-11";
const owner = await sesion("owner@ejemplo.invalid", URL_MES, 390);
const p = owner.pagina;
const tarjeta = (n) => p.locator(`details[data-profesora="${n}"]`);
async function abrir(n) {
  await p.goto(`${SITIO}${URL_MES}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  await tarjeta(n).locator("summary").click();
  return tarjeta(n);
}
const resumen = async (n) => (await tarjeta(n).locator("summary").innerText()).replace(/\s+/g, " ");

try {
  await db.query(FIJAR);
  const hechas = await sql(`select p.slug from liquidaciones_profesoras l join profesoras p on p.id = l.profesora_id where l.mes = '2026-11-01' and l.deleted_at is null`);
  if (!hechas.some((h) => h.slug === "drimy")) {
    const t = await abrir("Drimy");
    console.log("   ", await resumen("Drimy"));
    await t.getByRole("button", { name: /^Cerrar/ }).click();
    await p.waitForTimeout(8000);
    const a = await t.locator('[role="alert"]').count();
    if (a) console.log("    alerta:", await t.locator('[role="alert"]').first().innerText());
  }
  const filas = await sql(
    `select p.slug, l.monto_clp from liquidaciones_profesoras l join profesoras p on p.id = l.profesora_id
     where l.mes = '2026-11-01' and l.deleted_at is null order by 1`);
  caso("cerradas con los mismos montos", filas, [{ slug: "drimy", monto_clp: 18750 }, { slug: "pau", monto_clp: 124500 }]);
} finally {
  await db.query(RESTAURAR);
  console.log("\nhoy_santiago() restaurada:", (await sql(`select public.hoy_santiago()::text h`))[0].h);
}

console.log("\n4. El costo de la sala en una recuperativa (hallazgo 1)");
const [caida] = await sql(`select cl.id from clases cl join profesoras p on p.id = cl.profesora_id where cl.estado = 'cancelada' and p.slug = 'pau' and cl.fecha = '2026-11-26' limit 1`);
await p.goto(`${SITIO}/admin/especiales/nueva?categoria=recuperativa&clase=${caida.id}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
await p.getByLabel("Sala", { exact: true }).selectOption("__otra");
await p.getByLabel("Precio por hora *").fill("15000");
caso("muestra lo que cuesta esa clase", (await texto(p)).includes("de 60 minutos, costaría $15.000"), true);

console.log("\n5. generar_clases() y la regla");
const [{ antes }] = await sql(`select count(*)::int antes from clases where tipo = 'parrilla'`);
const [{ n }] = await sql(`select public.generar_clases(85) n`);
const [{ sinFin }] = await sql(`select count(*)::int "sinFin" from clases where tipo = 'parrilla' and fin is null`);
console.log(`    había ${antes}, creó ${n}`);
caso("generó clases, ninguna sin fin", [n > 0, sinFin], [true, 0]);
await db.query("begin");
let fallo = null;
try { await db.query(`update clases set fin = null where id = $1`, [caida.id]); } catch (e) { fallo = e.constraint; }
await db.query("rollback");
caso("quitarle el fin a una de parrilla se rechaza", fallo, "clases_parrilla_con_fin");

console.log("\n6. El calendario no cambió");
const a = await (await navegador.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
await a.goto(`${SITIO}/calendario`, { waitUntil: "domcontentloaded" });
await a.waitForTimeout(2500);
const cal = await texto(a);
caso("las clases de una hora no muestran rango", /\d\d:\d\d–\d\d:\d\d/.test(cal), false);
await fin();
