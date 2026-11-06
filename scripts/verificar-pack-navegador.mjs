/** PRD-0026 desde la pantalla, en staging: el aviso, las dos compras y aprobar. */
import { caso, fin, sesion, sql, texto, SITIO, navegador } from "./verificar-staging-comun.mjs";

const COMPRADORA = "ana@ejemplo.invalid";
const AMIGA = "bea@ejemplo.invalid";
const [plan] = await sql(`select slug, nombre, precio_clp from planes where clases_para_invitada > 0 and activo limit 1`);
console.log("plan:", plan);

// Una corrida a medias deja la compra pendiente: se sigue con esa, no se compra otra.
const [pendiente] = await sql(
  `select c.id from compras c join perfiles p on p.id = c.perfil_id
   where p.email = $1 and c.estado = 'pendiente' and c.deleted_at is null`, [COMPRADORA]);
if (!pendiente) {
console.log("\n1. El aviso, antes de elegir el plan");
const anon = await (await navegador.newContext({ viewport: { width: 390, height: 900 } })).newPage();
await anon.goto(`${SITIO}/comprar`, { waitUntil: "networkidle" });
caso("/comprar dice que la amiga tiene que tener cuenta", (await texto(anon)).includes("Tu amiga tiene que tener cuenta en XO"), true);

console.log("\n2. Con un correo que no existe, no deja continuar");
const { pagina, contexto } = await sesion(COMPRADORA, `/comprar/${plan.slug}`);
caso("llega al plan", new URL(pagina.url()).pathname, `/comprar/${plan.slug}`);
caso("el aviso también en el plan", (await texto(pagina)).includes("Tu amiga tiene que tener cuenta en XO"), true);
await pagina.getByRole("link", { name: /comprar por/i }).click();
await pagina.waitForURL(/\/transferir\//);
await pagina.waitForLoadState("networkidle");
caso("no muestra a dónde transferir antes de comprobar", (await pagina.getByRole("button", { name: "Ya transferí" }).count()) > 0, false);
await pagina.locator("#correo_amiga").fill("nadie-existe@ejemplo.invalid");
await pagina.getByRole("button", { name: "Continuar" }).click();
await pagina.waitForTimeout(2500);
console.log("    pantalla:", (await texto(pagina)).slice(-230));
caso("sigue sin dejar transferir", await pagina.getByRole("button", { name: "Ya transferí" }).count(), 0);

console.log("\n3. Con una amiga que existe");
await pagina.locator("#correo_amiga").fill(AMIGA.toUpperCase());
await pagina.getByRole("button", { name: "Continuar" }).click();
await pagina.waitForTimeout(2500);
caso("ahora sí deja transferir", await pagina.getByRole("button", { name: "Ya transferí" }).count(), 1);
await pagina.getByRole("button", { name: "Ya transferí" }).click();
await pagina.waitForTimeout(3000);
caso("acuse", (await texto(pagina)).includes("Nos avisaste"), true);
await contexto.close();

}

const [compra] = await sql(
  `select c.id, c.estado, c.monto_clp from compras c join perfiles p on p.id = c.perfil_id
   where p.email = $1 order by c.created_at desc limit 1`, [COMPRADORA]);
console.log("compra:", compra);

console.log("\n4. Aprobar desde la bandeja");
const admin = await sesion("admin@ejemplo.invalid", "/admin/compras", 1200);
console.log("    bandeja:", (await texto(admin.pagina)).slice(0, 120));
const fila = admin.pagina.locator('xpath=//*[contains(., "$16.000") and .//button[normalize-space()="Aprobar"] and count(.//button[normalize-space()="Aprobar"])=1]').last();
console.log("    fila:", (await fila.innerText()).replace(/\s+/g, " ").slice(0, 260));
await fila.getByRole("button", { name: "Aprobar", exact: true }).click();
console.log("    diálogo:", (await admin.pagina.locator("dialog[open]").innerText()).replace(/\s+/g, " ").slice(0, 300));
await admin.pagina.getByRole("button", { name: /Aprobar y acreditar/ }).click();
await admin.pagina.waitForTimeout(4000);
await admin.contexto.close();

const lotes = await sql(
  `select p.email, c.cantidad_disponible, c.fecha_vencimiento::date::text vence
   from creditos c join perfiles p on p.id = c.perfil_id where c.compra_id = $1 order by p.email`, [compra.id]);
console.log(lotes);
caso("dos lotes, uno en cada cuenta", lotes.map((l) => l.email), [COMPRADORA, AMIGA]);
const [m] = await sql(`select count(*)::int n, count(distinct credito_id)::int lotes from movimientos_credito where credito_id in (select id from creditos where compra_id = $1) and tipo = 'compra'`, [compra.id]);
caso("los dos como vendidos: dos movimientos compra", m, { n: 2, lotes: 2 });
const [e] = await sql(`select estado from compras where id = $1`, [compra.id]);
caso("compra pagada", e.estado, "pagada");
console.log("compra_id", compra.id);
await fin();
