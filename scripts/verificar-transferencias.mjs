/**
 * PRD-0017 §19: el camino entero de una compra por transferencia, recorrido
 * con un navegador contra STAGING, como lo haría una alumna nueva y como lo
 * haría quien aprueba.
 *
 *   1. Aprieta "Comprar" en un pack, entra con el enlace y completa el perfil
 *   2-4. Vuelve **al pack**, ve los datos, declara con titular y nota
 *   5. Admin y owner entran y aterrizan en la bandeja, con el contador
 *   6. Aprobar abre el diálogo; "Volver" no aprueba; el de adentro sí
 *   7. Se acreditan los créditos con vencimiento y queda en el libro
 *   8. Reserva y se descuenta
 *   9. Cancela y se le devuelve
 *
 * Y en cada paso, **qué correo se encoló y para quién**. Staging no tiene
 * `RESEND_API_KEY`, así que ninguno sale: lo que se comprueba es la cola, no
 * la entrega.
 *
 * **El enlace de entrada se arma con lo que el formulario de verdad le pide a
 * Supabase**: se captura el `redirect_to` de la llamada a `/auth/v1/otp` y se
 * le pega el token que genera Supabase. Así, si el formulario pierde el
 * destino, esto lo pierde igual (CLAUDE.md: probar el artefacto, no la
 * función). El correo mismo no se prueba: el SMTP de staging no manda.
 *
 * Deja una alumna nueva en staging por corrida, con su compra aprobada y una
 * reserva cancelada. Staging está para eso.
 *
 *   npm i --no-save playwright && npx playwright install chromium
 *   SITIO=http://localhost:3300 node scripts/verificar-transferencias.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { conectar } from "./staging.mjs";

const S = process.env.SCRATCHPAD ?? process.cwd();
const pw = await import(`${S}/node_modules/playwright/index.js`);
const chromium = (pw.default ?? pw).chromium;

const SITIO = process.env.SITIO ?? "http://localhost:3000";
const EMAIL = `alumna.flujo.${Date.now()}@example.com`;
const OFERTA = "pack-4";

const env = Object.fromEntries(
  readFileSync(".env.staging", "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
// Una conexión por consulta, no una para toda la corrida: entre consulta y
// consulta el navegador puede tardar minutos, y el pooler de Supabase corta las
// conexiones que quedan quietas ("Connection terminated unexpectedly").
const sql = async (q, p = []) => {
  const db = await conectar();
  try {
    return (await db.query(q, p)).rows;
  } finally {
    await db.end().catch(() => {});
  }
};

const r = [];
const caso = (n, esperado, real) =>
  r.push({ n, esperado, real, ok: String(real) === String(esperado) });

/**
 * Entra como lo haría la persona: llena el formulario de `/entrar`, se queda
 * con el `redirect_to` que ese formulario le pidió a Supabase, y abre el enlace
 * con el token real. Devuelve la URL donde terminó.
 */
async function entrar(pagina, email) {
  let redirectTo = null;
  pagina.on("request", (req) => {
    if (req.url().includes("/auth/v1/otp")) {
      redirectTo = new URL(req.url()).searchParams.get("redirect_to");
    }
  });
  await pagina.locator("input[name=correo]").fill(email);
  await pagina.getByRole("button", { name: /mandarme un enlace/i }).click();
  await pagina.waitForTimeout(2500);
  if (!redirectTo) throw new Error("El formulario no llamó a /auth/v1/otp");

  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const enlace = new URL(redirectTo);
  enlace.searchParams.set("token_hash", data.properties.hashed_token);
  enlace.searchParams.set("type", "email");
  await pagina.goto(enlace.toString(), { waitUntil: "networkidle" });
  return { redirectTo, llego: pagina.url() };
}

const ruta = (p) => {
  const u = new URL(p.url());
  return u.pathname + u.search;
};
const enviosDe = (compraId) =>
  sql(
    `select plantilla, destinatario from envios_correo
     where compra_id = $1 order by created_at`,
    [compraId],
  );

const nav = await chromium.launch();
try {
  // --- 1. Comprar → entrar → completar perfil ------------------------------
  const alumna = await (await nav.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await alumna.goto(`${SITIO}/comprar/${OFERTA}`, { waitUntil: "networkidle" });
  await Promise.all([
    alumna.waitForURL(/\/entrar/),
    alumna.getByRole("link", { name: /comprar por/i }).click(),
  ]);
  caso("1. Comprar sin sesión pide entrar, con el pack de destino",
       `/entrar?volver=${encodeURIComponent(`/transferir/${OFERTA}`)}`, ruta(alumna));

  const { redirectTo, llego } = await entrar(alumna, EMAIL);
  caso("1. el enlace que pide el formulario lleva el pack",
       `/transferir/${OFERTA}`, new URL(redirectTo).searchParams.get("volver"));
  caso("1. al abrirlo, completar perfil sin perder el pack",
       `/completar-perfil?volver=${encodeURIComponent(`/transferir/${OFERTA}`)}`,
       new URL(llego).pathname + new URL(llego).search);

  // Un error de validación tampoco lo pierde: el número con el 9 adelante.
  await alumna.locator("input[name=nombre]").fill("Alumna Flujo");
  await alumna.locator("input[name=telefono]").fill("912345678");
  await Promise.all([
    alumna.waitForURL(/error=telefono/),
    alumna.getByRole("button", { name: /guardar/i }).click(),
  ]);
  caso("1. un teléfono mal escrito no pierde el pack", true,
       ruta(alumna).includes(`volver=${encodeURIComponent(`/transferir/${OFERTA}`)}`));

  await alumna.locator("input[name=nombre]").fill("Alumna Flujo");
  await alumna.locator("input[name=telefono]").fill("12345678");
  await Promise.all([
    alumna.waitForURL(/\/transferir\//),
    alumna.getByRole("button", { name: /guardar/i }).click(),
  ]);
  caso("1. al guardar el perfil vuelve al pack que eligió", `/transferir/${OFERTA}`, ruta(alumna));

  // --- 2 a 4. Datos y declaración ------------------------------------------
  const pagTransferir = await alumna.locator("main").innerText();
  caso("3. ve el banco y el número de cuenta", true,
       pagTransferir.includes("Banco") && pagTransferir.includes("Cuenta"));
  caso("3. ve el monto", true, pagTransferir.includes("$28.000"));

  await alumna.locator("[name=titular]").fill("Mamá De La Alumna");
  await alumna.locator("[name=nota]").fill("Transferí a las 10:15 desde el BancoEstado");
  await alumna.getByRole("button", { name: /ya transferí/i }).click();
  await alumna.getByText("Nos avisaste. Ahora revisamos.").waitFor();
  caso("4. al declarar ve que quedó recibido", true, true);
  caso("4. y, sin Resend, el aviso gris de que el correo no salió", true,
       await alumna.getByText("No pudimos mandarte el correo con este aviso").isVisible());

  const [compra] = await sql(
    `select c.id, c.estado, c.titular_declarado, c.nota_alumna, p.id as perfil_id
     from compras c join perfiles p on p.id = c.perfil_id where p.email = $1`,
    [EMAIL],
  );
  caso("2. la compra queda pendiente", "pendiente", compra?.estado);
  caso("4. con el titular y la nota que escribió",
       "Mamá De La Alumna | Transferí a las 10:15 desde el BancoEstado",
       `${compra?.titular_declarado} | ${compra?.nota_alumna}`);
  caso("4. correos: aviso a la academia y acuse a ella",
       `transferenciaDeclarada→academia, transferenciaRecibida→${EMAIL}`,
       (await enviosDe(compra.id))
         .map((e) => `${e.plantilla}→${e.plantilla === "transferenciaDeclarada" ? "academia" : e.destinatario}`)
         .join(", "));

  await alumna.goto(`${SITIO}/mis-clases`, { waitUntil: "networkidle" });
  caso("4. en Mis reservas la ve esperando confirmación", true,
       (await alumna.locator("main").innerText()).includes("ESPERANDO CONFIRMACIÓN"));

  // --- 5. Quien aprueba se entera dentro del sitio --------------------------
  const [{ n: pendientes }] = await sql(
    "select count(*)::int as n from compras where estado = 'pendiente'",
  );
  const adminCtx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await adminCtx.newPage();
  await admin.goto(`${SITIO}/entrar`, { waitUntil: "networkidle" });
  await entrar(admin, "admin@ejemplo.invalid");
  caso("5. admin entra sin destino y, con pendientes, aterriza en la bandeja",
       "/admin/compras", new URL(admin.url()).pathname);
  caso("5. el menú cuenta las pendientes", `Transferencias (${pendientes})`,
       (await admin.locator('header a[href="/admin/compras"]').innerText()).trim().replace(/\s+/g, " ")
         .replace(/^TRANSFERENCIAS/, "Transferencias"));

  const owner = await (await nav.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await owner.goto(`${SITIO}/entrar`, { waitUntil: "networkidle" });
  await entrar(owner, "owner@ejemplo.invalid");
  caso("5. owner también aterriza en la bandeja", "/admin/compras", new URL(owner.url()).pathname);
  await owner.goto(`${SITIO}/owner/metricas`, { waitUntil: "networkidle" });
  caso("5. y en sus páginas el menú también cuenta", true,
       /Transferencias \(\d+\)/i.test(await owner.locator("header").innerText()));

  const fila = admin.locator("li", { hasText: "Alumna Flujo" }).filter({ hasText: EMAIL });
  const textoFila = await fila.innerText();
  caso("5. la fila muestra a nombre de quién transfirió", true, textoFila.includes("Mamá De La Alumna"));
  caso("5. y la nota", true, textoFila.includes("Transferí a las 10:15 desde el BancoEstado"));

  // --- 6. Aprobar en dos pasos ---------------------------------------------
  await fila.getByRole("button", { name: "Aprobar" }).click();
  const dialogo = admin.getByRole("dialog");
  await dialogo.waitFor();
  const textoDialogo = await dialogo.innerText();
  for (const [que, dato] of [
    ["el nombre", "Alumna Flujo"], ["el monto", "$28.000"], ["las clases", "4 clases"],
    ["el titular", "Mamá De La Alumna"], ["la nota", "Transferí a las 10:15"],
  ]) {
    caso(`6. el diálogo muestra ${que}`, true, textoDialogo.includes(dato));
  }
  caso("6. el foco entra en Volver, no en Aprobar", "Volver",
       await admin.evaluate(() => document.activeElement?.textContent?.trim()));

  await dialogo.getByRole("button", { name: "Volver" }).click();
  await admin.waitForTimeout(800);
  const [sigue] = await sql("select estado from compras where id = $1", [compra.id]);
  caso("6. Volver cierra sin aprobar", "cerrado · pendiente",
       `${(await dialogo.isVisible()) ? "abierto" : "cerrado"} · ${sigue.estado}`);

  await fila.getByRole("button", { name: "Aprobar" }).click();
  await dialogo.getByRole("button", { name: "Aprobar y acreditar 4 clases" }).click();
  await admin.waitForTimeout(4000);
  const [aprobada] = await sql("select estado from compras where id = $1", [compra.id]);
  caso("6. el botón de adentro aprueba", "pagada", aprobada.estado);
  await admin.reload({ waitUntil: "networkidle" });
  caso("6. el contador baja en uno", `Transferencias (${pendientes - 1})`,
       (await admin.locator('header a[href="/admin/compras"]').innerText()).trim()
         .replace(/^TRANSFERENCIAS/, "Transferencias").replace(/^Transferencias$/, "Transferencias (0)"));

  // --- 7. Créditos ---------------------------------------------------------
  const [lote] = await sql(
    `select cantidad_disponible, (fecha_vencimiento - now()) > interval '59 days' as sesenta
     from creditos where compra_id = $1`,
    [compra.id],
  );
  caso("7. 4 créditos que vencen en 60 días", "4 · true", `${lote?.cantidad_disponible} · ${lote?.sesenta}`);
  caso("7. correo de aprobada para ella", true,
       (await enviosDe(compra.id)).some((e) => e.plantilla === "compraAprobada" && e.destinatario === EMAIL));

  // --- 8. Reserva ----------------------------------------------------------
  // Desde PRD-0007 §8 es la grilla: se toca una clase reservable, se abre su
  // detalle y ahí se reserva. Si la semana de hoy ya no tiene clases —un
  // domingo—, se avanza a la siguiente.
  await alumna.goto(`${SITIO}/reservar`, { waitUntil: "networkidle" });
  const reservable = alumna.locator("main [data-estado='reservable']").filter({ visible: true });
  for (let i = 0; i < 9 && (await reservable.count()) === 0; i++) {
    await alumna.getByRole("button", { name: /Después/ }).click();
    await alumna.waitForTimeout(150);
  }
  await reservable.first().click();
  await alumna.getByRole("dialog").getByRole("button", { name: "Reservar esta clase" }).click();
  await alumna.waitForTimeout(3000);
  const [reserva] = await sql(
    "select id, estado from reservas where perfil_id = $1 order by created_at desc limit 1",
    [compra.perfil_id],
  );
  const saldo = async () =>
    (await sql("select sum(cantidad_disponible)::int as s from creditos where perfil_id = $1",
      [compra.perfil_id]))[0].s;
  caso("8. reserva confirmada y se descuenta una", "confirmada · 3", `${reserva?.estado} · ${await saldo()}`);
  const [{ n: compReserva }] = await sql(
    "select count(*)::int as n from envios_correo where reserva_id = $1 and plantilla = 'reserva'",
    [reserva.id],
  );
  caso("8. comprobante de reserva encolado para ella", 1, compReserva);

  // --- 9. Cancelación ------------------------------------------------------
  await alumna.goto(`${SITIO}/mis-clases`, { waitUntil: "networkidle" });
  await alumna.getByRole("button", { name: "Cancelar" }).first().click();
  await alumna.waitForTimeout(3000);
  const [cancelada] = await sql("select estado from reservas where id = $1", [reserva.id]);
  caso("9. cancela y se le devuelve", "cancelada · 4", `${cancelada.estado} · ${await saldo()}`);
  const libro = await sql(
    "select tipo from movimientos_credito where perfil_id = $1 order by created_at",
    [compra.perfil_id],
  );
  caso("7-9. el libro registra todo, sin editar nada", "compra, reserva, cancelacion",
       libro.map((m) => m.tipo).join(", "));
} catch (e) {
  console.error("\nSE CORTÓ:", e.message);
  r.push({ n: `se cortó: ${e.message.split("\n")[0]}`, esperado: "", real: "", ok: false });
} finally {
  await nav.close();
}

console.log(`\nPRD-0017 §19 — el camino de una transferencia, con ${EMAIL}\n`);
console.log("| Caso | Esperado | Obtenido | |");
console.log("|---|---|---|---|");
for (const x of r) console.log(`| ${x.n} | ${x.esperado} | ${x.real} | ${x.ok ? "✓" : "✗"} |`);
const fallas = r.filter((x) => !x.ok).length;
console.log(`\n${r.length - fallas}/${r.length} como se esperaba.`);
process.exitCode = fallas ? 1 : 0;
