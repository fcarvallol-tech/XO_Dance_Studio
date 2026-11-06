/** PRD-0024 desde la pantalla, en staging: menos, exacto y más; y el candado de anular. */
import { caso, fin, sesion, sql, supabase, texto } from "./verificar-staging-comun.mjs";

const COMPRA_VIVA = process.argv[2]; // la del pack de amigas: tiene créditos vivos
const [p] = await sql(
  `select p.id, p.email, sum(c.cantidad_disponible)::int saldo
   from perfiles p join creditos c on c.perfil_id = p.id
   where p.email like '%@ejemplo.invalid' and p.rol = 'alumna' and c.fecha_vencimiento > now()
     and p.email not in ('alumna.uno@ejemplo.invalid','alumna.dos@ejemplo.invalid','ana@ejemplo.invalid','bea@ejemplo.invalid')
   group by 1, 2 having sum(c.cantidad_disponible) >= 3 order by 3 desc limit 1`);
console.log("persona de prueba:", p.email, "saldo", p.saldo);
const saldo = async () => (await sql(
  `select coalesce(sum(cantidad_disponible),0)::int s from creditos where perfil_id = $1 and fecha_vencimiento > now()`, [p.id]))[0].s;
const libro = async () => (await sql(
  `select (select coalesce(sum(cantidad),0)::int from movimientos_credito where perfil_id = $1) libro,
          (select coalesce(sum(cantidad_disponible),0)::int from creditos where perfil_id = $1) lotes`, [p.id]))[0];

const { pagina } = await sesion("owner@ejemplo.invalid", `/admin?q=${encodeURIComponent(p.email)}`, 1200);
const abrir = async () => {
  await pagina.getByRole("button", { name: /quitar/i }).first().click();
  await pagina.waitForTimeout(300);
};
const llenar = async (n) => {
  await pagina.locator(`[id="quitar-cantidad-${p.id}"]`).fill(String(n));
  await pagina.locator(`[id="quitar-motivo-${p.id}"]`).fill("Prueba de revocar en staging");
};
const confirmar = () => pagina.locator("dialog[open]").getByRole("button", { name: /^quitar/i });
const inicial = await saldo();

console.log("\n1. Más de lo que hay");
await abrir();
await llenar(inicial + 1);
caso("el botón no se habilita", await confirmar().isDisabled(), true);
const r = await supabase.rpc("revocar_creditos", {
  p_perfil_id: p.id, p_cantidad: inicial + 1, p_motivo: "Prueba por la base", p_actor_user_id: (await sql(`select user_id from perfiles where rol='owner' limit 1`))[0].user_id,
});
console.log("    la base dice:", r.error?.message);
caso("la base también lo rechaza", r.error !== null, true);
caso("saldo intacto", await saldo(), inicial);

console.log("\n2. Menos de lo que hay");
await llenar(1);
await confirmar().click();
await pagina.waitForTimeout(3000);
caso("bajó en uno", await saldo(), inicial - 1);
let l = await libro();
caso("libro = lotes", l.libro, l.lotes);

console.log("\n3. Exactamente lo que hay");
await pagina.reload({ waitUntil: "networkidle" });
await abrir();
await llenar(inicial - 1);
await confirmar().click();
await pagina.waitForTimeout(3000);
caso("quedó en cero", await saldo(), 0);
l = await libro();
caso("libro = lotes", l.libro, l.lotes);
const m = await sql(`select tipo, cantidad, motivo from movimientos_credito where perfil_id = $1 and motivo = 'Prueba de revocar en staging' order by created_at`, [p.id]);
console.log("   ", JSON.stringify(m));
await pagina.reload({ waitUntil: "domcontentloaded" });
await pagina.waitForTimeout(1500);

console.log("\n4. Admin no ve el botón");
// Con alguien que tenga saldo: con cero el botón no sale para nadie y no probaría nada.
const CON_SALDO = "ana@ejemplo.invalid";
const dueno = await sesion("owner@ejemplo.invalid", `/admin?q=${CON_SALDO}`, 1200);
caso("owner sí lo ve", await dueno.pagina.getByRole("button", { name: /quitar/i }).count(), 1);
const adm = await sesion("admin@ejemplo.invalid", `/admin?q=${CON_SALDO}`, 1200);
caso("admin no lo ve", await adm.pagina.getByRole("button", { name: /quitar/i }).count(), 0);

console.log("\n5. Anular una compra con créditos vivos");
let fallo = null;
try { await sql(`update public.compras set deleted_at = now() where id = $1`, [COMPRA_VIVA]); }
catch (e) { fallo = e.message; }
console.log("    la base dice:", fallo);
caso("el candado la rechaza", fallo !== null, true);
caso("la compra sigue en pie", (await sql(`select deleted_at is null v from compras where id = $1`, [COMPRA_VIVA]))[0].v, true);
await fin();
