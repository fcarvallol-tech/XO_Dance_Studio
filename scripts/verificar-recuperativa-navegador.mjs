/** PRD-0027 desde la pantalla, en staging. Recupera la clase futura que cancela verificar-devolucion-navegador. */
import { caso, fin, navegador, sesion, SITIO, sql, texto } from "./verificar-staging-comun.mjs";

const CAIDA = process.argv[2];
const [pau3] = await sql(`select cl.id from clases cl join profesoras p on p.id = cl.profesora_id where p.slug='pau' and cl.fecha='2026-11-03' and cl.estado='cancelada' limit 1`);

console.log("\n1. La lista y el enlace");
const { pagina } = await sesion("admin@ejemplo.invalid", "/admin/recuperativas", 390);
const lista = await texto(pagina);
console.log("    lista:", lista.slice(0, 520));
caso("dice 2 alumnas con reserva", lista.includes("2 alumnas con reserva"), true);
await pagina.locator(`a[href*="${CAIDA}"]`).click();
await pagina.waitForURL(/especiales\/nueva/);
await pagina.waitForLoadState("networkidle");
caso("categoría ya elegida", await pagina.locator("#categoria").inputValue(), "recuperativa");
caso("clase ya elegida", await pagina.locator("#original").inputValue(), CAIDA);
caso("sin campos de marketing", await pagina.locator('[name="cancion"],[name="dificultad"],[name="descripcion"],[name="reel_url"],[name="precio_clp"],[name="minimo_alumnas"]').count(), 0);
console.log("    pantalla:", (await texto(pagina)).slice(0, 520));

console.log("\n2. Los choques, en palabras");
await pagina.locator("#fecha").fill("2026-11-19");
await pagina.locator("#hora").fill("14:50");
await pagina.getByRole("button", { name: "Crear clase" }).click();
await pagina.waitForTimeout(2500);
const alerta = await pagina.locator('[role="alert"]').innerText().catch(() => "(sin alerta)");
console.log("    alerta:", alerta);
caso("explica el mismo día, sin error de base", /elige otra fecha/.test(alerta), true);

console.log("\n3. Con sala existente, a una hora rara");
await pagina.locator("#fecha").fill("2026-11-21");
await pagina.getByRole("button", { name: "Crear clase" }).click();
await pagina.waitForURL(/admin\/recuperativas\?/, { timeout: 15000 });
await pagina.waitForLoadState("networkidle");
console.log("    aviso:", await pagina.locator('[role="status"]').first().innerText());

console.log("\n4. Con otra sala");
await pagina.goto(`${SITIO}/admin/especiales/nueva`, { waitUntil: "networkidle" });
caso("categoría sin elegir", await pagina.locator("#categoria").inputValue(), "");
caso("sin formulario hasta elegir", await pagina.locator("#original, [name=titulo]").count(), 0);
await pagina.locator("#categoria").selectOption("recuperativa");
await pagina.locator("#original").selectOption(pau3.id);
await pagina.locator("#fecha").fill("2026-11-18");
await pagina.locator("#hora").fill("15:00");
await pagina.getByLabel("Sala", { exact: true }).selectOption("__otra");
const guardar = pagina.getByRole("button", { name: "Guardar sala" });
await pagina.getByLabel("Nombre de la sala *").fill("Manuel Montt");
await pagina.getByLabel("Dirección *").fill("Barros Borgoño 71 of. 101");
await pagina.getByLabel("Comuna *").fill("Providencia");
await pagina.getByLabel("Precio por hora *").fill("15000");
caso("sin capacidad no se puede guardar", await guardar.isDisabled(), true);
await pagina.getByLabel("Capacidad *").fill("12");
const costo = await texto(pagina);
caso("muestra lo que cuesta esa clase", costo.includes("de 60 minutos, costaría $15.000"), true);
await guardar.click();
await pagina.waitForTimeout(2500);
const oferta = await pagina.locator('[role="status"]').innerText();
console.log("    oferta:", oferta.replace(/\s+/g, " "));
caso("ofrece Studio 98 por la dirección", oferta.includes("Studio 98"), true);
await pagina.getByLabel("Nombre de la sala *").fill("Sala de prueba");
await pagina.getByLabel("Dirección *").fill("Irarrázaval 100, piso 2");
await pagina.getByLabel("Comuna *").fill("Ñuñoa");
await pagina.getByRole("button", { name: "Guardar sala" }).click();
await pagina.waitForTimeout(2500);
caso("cupo de la sala nueva", (await texto(pagina)).includes("12 lugares, los de la sala."), true);
await pagina.getByRole("button", { name: "Crear clase" }).click();
await pagina.waitForURL(/admin\/recuperativas\?/, { timeout: 15000 });
console.log("    aviso:", await pagina.locator('[role="status"]').first().innerText());

console.log("\n5. La especial: cupo desde la sala");
await pagina.goto(`${SITIO}/admin/especiales/nueva?categoria=especial`, { waitUntil: "networkidle" });
caso("sí tiene los campos de marketing", await pagina.locator('[name="cancion"],[name="reel_url"],[name="precio_clp"]').count(), 3);
const [leones] = await sql(`select id from sedes where slug='seduccion-latina'`);
await pagina.getByLabel("Sala", { exact: true }).selectOption(leones.id);
caso("cupo prellenado, no 22", await pagina.locator('[name="cupo_maximo"]').inputValue(), "16");

console.log("\n6. Lo que quedó en la base");
const filas = await sql(
  `select n.tipo, n.horario_id = o.horario_id mismo_horario, n.recupera_clase_id = o.id ligada, n.titulo, n.slug, n.cupo_maximo,
     s.nombre sede, s.ocasional, (n.inicio at time zone 'America/Santiago')::text inicio, n.id
   from clases n join clases o on o.id = n.recupera_clase_id join sedes s on s.id = n.sede_id
   where n.estado='programada' order by n.inicio`);
console.log(filas);
caso("dos, parrilla, ligadas, sin título ni slug", filas.map((f) => [f.tipo, f.mismo_horario, f.ligada, f.titulo, f.slug]),
  [["parrilla", true, true, null, null], ["parrilla", true, true, null, null]]);
const [recup] = filas.filter((f) => f.sede !== "Sala de prueba");
const [otra] = filas.filter((f) => f.sede === "Sala de prueba");
caso("cupo de cada una", [recup.cupo_maximo, otra.cupo_maximo], [22, 12]);

console.log("\n7. El calendario, sin sesión");
const anon = await (await navegador.newContext({ viewport: { width: 375, height: 900 } })).newPage();
await anon.goto(`${SITIO}/calendario`, { waitUntil: "networkidle" });
const cal = await anon.content();
for (const f of [recup, otra]) caso(`la clase ${f.inicio} está`, cal.includes(f.id), true);
caso("no dice recuperativa", /recuperativ/i.test(await anon.locator("body").innerText()), false);
caso("dice el nombre del curso", cal.includes("Reggaeton Femme"), true);
caso("sale la dirección de la sala arrendada", cal.includes("Irarrázaval 100"), true);
await anon.screenshot({ path: process.argv[3] ?? "/dev/null", fullPage: true });
caso("el costo no está en la página", /costo_hora|15\.000/.test(cal), false);
await anon.goto(`${SITIO}/nosotros`, { waitUntil: "networkidle" });
caso("/nosotros no la muestra", (await anon.content()).includes("Sala de prueba"), false);

console.log("\n8. El correo");
const correos = await sql(
  `select destinatario, estado, plantilla from envios_correo where plantilla = 'recuperativa' order by created_at`).catch(async (e) => { console.log(e.message); return []; });
console.log(correos);
caso("dos, a las alumnas afectadas", correos.map((c) => c.destinatario).sort(), ["alumna.dos@ejemplo.invalid", "alumna.uno@ejemplo.invalid"]);

console.log("\n9. Reservar desde el botón del correo, y cupo primero que llegue");
for (const email of ["alumna.uno@ejemplo.invalid", "ana@ejemplo.invalid"]) {
  const s = await sesion(email, `/reservar/${recup.id}`);
  const t = await texto(s.pagina);
  caso(`${email}: no dice recuperativa`, /recuperativ/i.test(t), false);
  await s.pagina.getByRole("button", { name: "Reservar esta clase" }).click();
  await s.pagina.waitForTimeout(3000);
  caso(`${email}: reservó`, (await texto(s.pagina)).includes("Tu clase está reservada"), true);
  await s.contexto.close();
}
await fin();
