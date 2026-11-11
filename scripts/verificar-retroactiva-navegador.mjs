// PRD-0030 en staging, desde la página: el owner registra una asistencia, el
// caso "no tenía crédito ese día", la clase le cuenta a la profesora, y una
// admin no entra. ⚠️ Escribe en staging: deja reservas retroactivas en la
// Reggaeton Antiguo de Isi del viernes 06/11 (Bea, del primer intento, Cata y
// Prueba 5). No se vuelve a correr igual: las tres ya quedan registradas.
//   node scripts/verificar-retroactiva-navegador.mjs
import { caso, fin, sesion, sql, texto } from "./verificar-staging-comun.mjs";

const [clase] = await sql(`select c.id, c.profesora_id from clases c join profesoras p on p.id = c.profesora_id
  where p.slug = 'isi' and (c.inicio at time zone 'America/Santiago') = '2026-11-06 17:00'`);
const URL_CLASE = `/owner/asistencias?clase=${clase.id}`;
const consumidos = async () => (await sql(
  `select creditos_consumidos n from insumos_del_mes('2026-11-01') where clase_id = $1`, [clase.id]))[0].n;
const antes = await consumidos();

console.log("\n1. Admin no entra");
{
  const { pagina, contexto } = await sesion("admin@ejemplo.invalid", "/owner/asistencias");
  await pagina.goto("http://localhost:3000/owner/asistencias", { waitUntil: "networkidle" });
  caso("admin termina fuera de /owner/asistencias", new URL(pagina.url()).pathname !== "/owner/asistencias", true);
  caso("no ve el título", (await texto(pagina)).includes("Asistencias pasadas"), false);
  await contexto.close();
}

const { pagina: p, contexto } = await sesion("owner@ejemplo.invalid", URL_CLASE, 390);
async function abrir(nombre) {
  await p.goto(`http://localhost:3000${URL_CLASE}&q=${encodeURIComponent(nombre)}`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Fue a esta clase" }).first().click();
  // Después de registrar el botón desaparece: el aviso se busca en la página.
  const fila = p.locator("[data-asistencia-registrada]");
  const d = p.getByRole("dialog");
  await d.getByRole("textbox").fill("Llegó sin reserva (prueba en staging)");
  return { fila, d };
}

console.log("\n2. Con crédito ese día: Cata");
{
  const { fila, d } = await abrir("Cata Prueba");
  await d.getByRole("button", { name: "Registrar" }).click();
  await fila.waitFor();
  caso("dice que se usó el crédito de ese día", (await fila.innerText()).includes("con el crédito que tenía ese día"), true);
}

console.log("\n3. Sin crédito ese día: Prueba 5");
{
  const { fila, d } = await abrir("Prueba 5");
  await d.getByRole("button", { name: "Registrar" }).click();
  await d.locator("[data-sin-credito-ese-dia]").waitFor();
  const t = await d.innerText();
  caso("avisa que no tenía crédito ese día", t.includes("No tenía crédito vigente el día de la clase"), true);
  caso("ofrece usar una de hoy y no registrar", (await d.getByRole("button", { name: "Usar una de hoy" }).count()) === 1
    && (await d.getByRole("button", { name: "No registrar" }).count()) === 1, true);
  await p.screenshot({ path: process.env.CAPTURA ?? "/dev/null", fullPage: true }).catch(() => {});
  await d.getByRole("button", { name: "Usar una de hoy" }).click();
  await fila.waitFor();
  caso("registrada con una de hoy", (await fila.innerText()).includes("con una de las clases que tiene hoy"), true);
}

console.log("\n4. La lista y la liquidación");
await p.goto(`http://localhost:3000${URL_CLASE}`, { waitUntil: "load" });
await p.waitForTimeout(1500);
const t = await texto(p);
caso("las tres en 'Registradas este mes'", ["Bea Prueba", "Cata Prueba", "Prueba 5"].every((n) => t.includes(n)), true);
caso(`la clase de Isi pasa de ${antes} a ${antes + 2} créditos en la liquidación`, await consumidos(), antes + 2);

await contexto.close();
await fin();
