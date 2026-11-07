/**
 * El paso E desde la pantalla, en staging. Antes: sembrar-noviembre-liquidacion.mjs
 * y el sitio en :3000. Para ver el mes terminado, `hoy_santiago()` se reemplaza por
 * el 2 de diciembre y **se restaura al final**, pase lo que pase.
 *   node scripts/verificar-liquidacion-navegador.mjs <comprobante.png> <carpeta de capturas>
 */
import { caso, db, fin, sesion, sql, texto, SITIO } from "./verificar-staging-comun.mjs";

const [COMPROBANTE, CAPTURAS] = process.argv.slice(2);
const URL_MES = "/owner/liquidaciones?mes=2026-11";
const RESTAURAR = `create or replace function public.hoy_santiago() returns date language sql stable as $$
  select (now() at time zone 'America/Santiago')::date;
$$`;
const FIJAR = `create or replace function public.hoy_santiago() returns date language sql stable as $$ select date '2026-12-02' $$`;

const tarjeta = (p, nombre) => p.locator(`details[data-profesora="${nombre}"]`);
async function abrir(p, nombre) {
  await p.goto(`${SITIO}${URL_MES}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  await tarjeta(p, nombre).locator("summary").click();
  return tarjeta(p, nombre);
}
const resumen = async (p, nombre) => (await tarjeta(p, nombre).locator("summary").innerText()).replace(/\s+/g, " ");
const textoDe = async (t) => (await t.innerText()).replace(/\s+/g, " ");

async function clasificar(p, nombre, fecha, boton, causa, detalle, presente = false) {
  const t = await abrir(p, nombre);
  const candidata = t.locator("li", { hasText: fecha }).filter({ has: p.getByRole("button", { name: boton }) }).first();
  if ((await candidata.count()) === 0) return; // una corrida anterior ya la clasificó
  // Se marca: al apretar, el botón se va y la fila dejaría de calzar con el filtro.
  await candidata.evaluate((e) => e.setAttribute("data-en-curso", "1"));
  const fila = t.locator('li[data-en-curso="1"]');
  await fila.getByRole("button", { name: boton }).click();
  await fila.locator("select").selectOption(causa);
  await fila.locator('input:not([type="checkbox"])').fill(detalle);
  if (presente) await fila.locator('input[type="checkbox"]').check();
  await fila.getByRole("button", { name: "Guardar" }).click();
  await p.waitForTimeout(2200);
  const alerta = await fila.locator('[role="alert"]').count().catch(() => 0);
  if (alerta) console.log("    alerta:", await fila.locator('[role="alert"]').innerText());
}

const owner = await sesion("owner@ejemplo.invalid", URL_MES, 390);
const p = owner.pagina;

console.log("\n1. Con el reloj real: mes en curso");
await p.waitForTimeout(800);
caso("llega a la página", new URL(p.url()).pathname, "/owner/liquidaciones");
const [{ n: cerradas }] = await sql(`select count(*)::int n from liquidaciones_profesoras where mes = '2026-11-01' and deleted_at is null`);
if (cerradas === 0) {
  const t = await abrir(p, "Pau");
  caso("dice que el mes no termina", (await textoDe(t)).includes("El mes todavía no termina"), true);
  caso("el botón de cerrar no se habilita", await t.getByRole("button", { name: /^Cerrar/ }).isDisabled(), true);
}

console.log("\n2. La recuperación que cae en diciembre");
const [lina] = await sql(
  `select cl.id from clases cl join profesoras p on p.id = cl.profesora_id
   where p.slug = 'lina' and cl.estado = 'cancelada' and cl.inicio < '2026-12-01 03:00+00' order by cl.inicio desc limit 1`);
const [ya] = await sql(`select 1 from clases where recupera_clase_id = $1`, [lina.id]);
if (!ya) {
  await p.goto(`${SITIO}/admin/especiales/nueva?categoria=recuperativa&clase=${lina.id}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);
  await p.locator("#fecha").fill("2026-12-03");
  await p.locator("#hora").fill("16:00");
  await p.getByRole("button", { name: "Crear clase" }).click();
  await p.waitForURL(/admin\/recuperativas\?/, { timeout: 15000 });
}

try {
  await db.query(FIJAR);
  console.log("\n3. Con hoy = 2 de diciembre: clasificar desde la pantalla");
  await clasificar(p, "Lina", "de noviembre", "Decir por qué", "asistencia_insuficiente", "No llegaron alumnas suficientes");
  await clasificar(p, "Pau", "12 de noviembre", "Decir por qué", "sala_no_disponible", "Llegó y la sala estaba ocupada", true);
  await clasificar(p, "Pau", "26 de noviembre", "Decir por qué", "sin_alumnas", "No hubo alumnas");
  await clasificar(p, "Pau", "17 de noviembre", "Decir por qué", "cambio_de_parrilla", "Salió de la parrilla");
  await clasificar(p, "Pau", "5 de noviembre", "No se dictó", "cambio_de_parrilla", "Salió de la parrilla");
  for (const f of ["2 de noviembre", "12 de noviembre", "16 de noviembre", "19 de noviembre", "26 de noviembre"]) {
    await clasificar(p, "Drimy", f, "Decir por qué", "cambio_de_parrilla", "Salió de la parrilla");
  }
  await clasificar(p, "Drimy", "5 de noviembre", "No se dictó", "cambio_de_parrilla", "Salió de la parrilla");

  console.log("\n4. Los montos en pantalla");
  let t = await abrir(p, "Pau");
  const pau = await resumen(p, "Pau");
  console.log("    Pau:", pau);
  caso("Pau $124.500", pau.includes("$124.500"), true);
  const tp = await textoDe(t);
  await p.screenshot({ path: `${CAPTURAS}/owner-pau.png`, fullPage: true });
  for (const [n, s] of [
    ["10/11 con base y variable", "16 créditos · base $18.000 · variable $2.750"],
    ["causa con pago", "$18.000"],
    ["la que no paga lo dice", "No paga"],
    ["el promedio", "Promedio 14 en sus 4 mejores: primer tramo"],
    ["las 4 del promedio", "12 créditos"],
    ["recuperada, una sola vez", "se paga una sola vez, en la recuperación"],
    ["sin fecha, avisa", "Sin fecha de recuperación"],
    ["recupera a otra", "Recupera la del"],
  ]) caso(n, tp.includes(s), true);
  console.log("    incentivo:", tp.match(/INCENTIVO.{0,300}/i)?.[0]);
  console.log("    no entra:", tp.match(/LO QUE NO ENTRA.{0,420}/i)?.[0]);
  t = await abrir(p, "Drimy");
  const dr = await resumen(p, "Drimy");
  console.log("    Drimy:", dr);
  caso("Drimy $18.750", dr.includes("$18.750"), true);
  caso("Drimy: por qué no hay incentivo", (await textoDe(t)).includes("hacen falta 4 para optar"), true);
  t = await abrir(p, "Lina");
  const tl = await textoDe(t);
  console.log("    Lina no entra:", tl.match(/LO QUE NO ENTRA.{0,300}/i)?.[0]);
  caso("la recuperación de diciembre se ve, con su fecha", tl.includes("Se paga en diciembre de 2026") && tl.includes("Se recupera el"), true);

  const [pauId] = await sql(`select id from profesoras where slug = 'pau'`);
  const [{ n: yaPagada }] = await sql(`select count(*)::int n from liquidaciones_profesoras where profesora_id = $1 and pagada_at is not null and deleted_at is null`, [pauId.id]);
  if (yaPagada === 0) {
  console.log("\n5. Cerrar dos veces no duplica");
  const otra = await owner.contexto.newPage();
  const t1 = await abrir(p, "Pau");
  const t2 = await abrir(otra, "Pau");
  await Promise.all([
    t1.getByRole("button", { name: /^Cerrar/ }).click(),
    t2.getByRole("button", { name: /^Cerrar/ }).click(),
  ]);
  await p.waitForTimeout(3500);
  const filas = await sql(`select id, monto_clp, pagada_at, egreso_id from liquidaciones_profesoras where profesora_id = $1 and mes = '2026-11-01' and deleted_at is null`, [pauId.id]);
  caso("una sola fila, $124.500, sin pago", filas.map((f) => [f.monto_clp, f.pagada_at, f.egreso_id]), [[124500, null, null]]);
  await otra.close();
  const [{ n: total }] = await sql(`select count(*)::int n from liquidaciones_profesoras where profesora_id = $1`, [pauId.id]);
  caso("tampoco una anulada de más", total, 1);

  console.log("\n6. Marcar pagada");
  t = await abrir(p, "Pau");
  caso("dice cerrada", (await resumen(p, "Pau")).includes("Cerrada, falta pagar"), true);
  caso("sin comprobante no paga", await (async () => {
    await t.getByRole("button", { name: "Marcar pagada" }).click();
    await p.waitForTimeout(600);
    return (await t.locator('[role="alert"]').innerText()).includes("Adjunta");
  })(), true);
  await t.locator('input[type="file"]').setInputFiles(COMPROBANTE);
  await t.getByRole("button", { name: "Marcar pagada" }).click();
  await p.waitForTimeout(4000);
  await abrir(p, "Pau");
  console.log("    Pau:", await resumen(p, "Pau"));
  const [pago] = await sql(
    `select l.monto_clp, l.pagada_at is not null pagada, e.categoria, e.monto_clp egreso from liquidaciones_profesoras l
     join egresos e on e.id = l.egreso_id where l.profesora_id = $1 and l.deleted_at is null`, [pauId.id]);
  caso("pagada, con su egreso igual", pago, { monto_clp: 124500, pagada: true, categoria: "sueldo_profesora", egreso: 124500 });

  }

  console.log("\n7. Anular se agrega, no corrige");
  t = await abrir(p, "Drimy");
  if ((await t.getByRole("button", { name: /^Cerrar/ }).count()) > 0) {
    await t.getByRole("button", { name: /^Cerrar/ }).click();
    await p.waitForTimeout(3000);
    t = await abrir(p, "Drimy");
  }
  await t.getByRole("button", { name: "Anular el cierre" }).click();
  await t.getByLabel("Por qué se anula").fill("Prueba de anular en staging");
  await t.getByRole("button", { name: "Anular", exact: true }).click();
  await p.waitForTimeout(3000);
  t = await abrir(p, "Drimy");
  await t.getByRole("button", { name: /^Cerrar/ }).click();
  await p.waitForTimeout(3000);
  const [dId] = await sql(`select id from profesoras where slug = 'drimy'`);
  const dFilas = await sql(`select monto_clp, deleted_at is not null anulada from liquidaciones_profesoras where profesora_id = $1 order by created_at`, [dId.id]);
  caso("dos filas: la anulada sigue ahí", dFilas, [{ monto_clp: 18750, anulada: true }, { monto_clp: 18750, anulada: false }]);

  console.log("\n8. Lo que ve la profesora");
  const contacto = await sql(`select email, nombre, telefono from perfiles where rol = 'alumna' and deleted_at is null`);
  for (const [email, total2, nombre] of [["profe.pau@ejemplo.invalid", "$124.500", "Pau"], ["profe.drimy@ejemplo.invalid", "$18.750", "Drimy"]]) {
    const s = await sesion(email, "/profesora/liquidacion?mes=2026-11", 390);
    caso(`${nombre}: llega`, new URL(s.pagina.url()).pathname, "/profesora/liquidacion");
    const vista = await texto(s.pagina);
    const html = await s.pagina.content();
    caso(`${nombre}: su total`, vista.includes(total2), true);
    console.log("    estado:", await s.pagina.locator('main [role="status"]').first().innerText());
    const fuga = contacto.filter((c) => [c.email, c.nombre, c.telefono].some((v) => v && v.length > 3 && html.includes(v)));
    caso(`${nombre}: ningún dato de alumna en el HTML`, fuga.map((c) => c.email), []);
    caso(`${nombre}: sin correos`, /[a-z0-9.]+@(?!ejemplo)[a-z]/i.test(vista), false);
    caso(`${nombre}: sin botones de owner`, await s.pagina.getByRole("button", { name: /Cerrar \$|Marcar pagada|Anular|No se dictó/ }).count(), 0);
    if (nombre === "Pau") await s.pagina.screenshot({ path: `${CAPTURAS}/profesora-pau.png`, fullPage: true });
    if (nombre === "Drimy") caso("Drimy no ve el total de Pau", vista.includes("$124.500"), false);
    await s.pagina.goto(`${SITIO}/owner/liquidaciones`, { waitUntil: "domcontentloaded" });
    caso(`${nombre}: no entra a la del owner`, new URL(s.pagina.url()).pathname === "/owner/liquidaciones", false);
    await s.contexto.close();
  }
  const adm = await sesion("admin@ejemplo.invalid", "/owner/liquidaciones", 390);
  caso("admin no entra", new URL(adm.pagina.url()).pathname === "/owner/liquidaciones", false);
} finally {
  await db.query(RESTAURAR);
  const [{ hoy }] = await sql(`select public.hoy_santiago()::text hoy`);
  console.log("\nhoy_santiago() restaurada:", hoy);
}
await fin();
