/**
 * PRD-0010 parte 2, fase 5: **probar el artefacto, no la función**, contra
 * STAGING y con clics de verdad.
 *
 * Se entra con el enlace que llegaría por correo (token_hash), se mira
 * `/owner/finanzas` y se contrastan en pantalla los valores del juez de la
 * fase 0.2; se registra un egreso **desde el formulario**, se lo ve bajar la
 * caja, se lo anula **desde el botón** y se comprueba en la base que la fila
 * sigue con `deleted_at`. Después, lo que un layout no cubre: un admin por URL
 * directa y por `/rest/v1/rpc` con su JWT, y `anon` sobre las tablas nuevas.
 *
 * CÓMO SE CORRE
 *
 *   1. Levantar el sitio contra staging (las llaves de staging en el entorno
 *      tapan las de .env.local; ver supabase/README.md):
 *        set -a; . ./.env.staging; set +a
 *        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
 *        NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build && npm run start
 *   2. Sembrar:  node scripts/sembrar-escenario.mjs
 *   3. Correr:   node scripts/verificar-finanzas-navegador.mjs
 *
 * Playwright no es dependencia del proyecto (PRD-0018 fase 6):
 *   npm i --no-save playwright && npx playwright install chromium
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { conectar, staging } from "./staging.mjs";

const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const OWNER = "owner@ejemplo.invalid";
const ADMIN = "admin@ejemplo.invalid";
const CLAVE = "escenario-prd-0010";

const supabase = createClient(staging.NEXT_PUBLIC_SUPABASE_URL, staging.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const db = await conectar();
const sql = async (q, p) => (await db.query(q, p)).rows;

let fallas = 0;
function caso(nombre, obtenido, esperado, nota = "") {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallas++;
  console.log(
    `  ${ok ? "✓" : "✗"} ${nombre.padEnd(52)} ${JSON.stringify(obtenido)}` +
      `${ok ? "" : `  (esperado ${JSON.stringify(esperado)})`}${nota ? `  ${nota}` : ""}`,
  );
}

/** El enlace tal como llegaría en el correo: token_hash + type, sin SDK. */
async function enlaceMagico(email, volver) {
  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`no se pudo generar el enlace de ${email}: ${error.message}`);
  return `${SITIO}/auth/confirmar?token_hash=${data.properties.hashed_token}&type=magiclink&volver=${encodeURIComponent(volver)}`;
}

const navegador = await chromium.launch();
async function sesion(email, volver, ancho = 390) {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: 900 } });
  const pagina = await contexto.newPage();
  pagina.on("pageerror", (e) => console.log(`  [error de página] ${e.message}`));
  await pagina.goto(await enlaceMagico(email, volver), { waitUntil: "networkidle" });
  return { contexto, pagina };
}

const DESCRIPCION = "Prueba desde el formulario";
async function limpiar() {
  await sql(`delete from public.egresos where descripcion = $1`, [DESCRIPCION]);
  await supabase.storage.from("comprobantes-egresos").remove(["verificacion.pdf"]).catch(() => {});
}
await limpiar();

try {
  // -------------------------------------------------------------------------
  // 1. El owner mira la página, a 390 px
  // -------------------------------------------------------------------------
  console.log("\n1. /owner/finanzas con sesión owner:");
  const { pagina } = await sesion(OWNER, "/owner/finanzas");
  caso("llega a la página", new URL(pagina.url()).pathname, "/owner/finanzas");
  const texto = await pagina.locator("main").innerText();
  const tiene = (s) => texto.includes(s);
  caso("caja neta $9.500", tiene("$9.500"), true);
  caso("denominador de la caja", tiene("$112.500 que entraron menos $103.000 que salieron"), true);
  caso("variación +$15.500 en pesos", tiene("+$15.500"), true);
  caso("el mes anterior cerró en -$6.000", tiene("cerró en -$6.000"), true);
  caso("nunca «$-»", texto.includes("$-"), false);
  caso("3 egresos registrados", tiene("3 egresos registrados"), true);
  caso("egreso E1 en la lista", tiene("Arriendo de sala, 4 clases"), true);
  caso("E4 (anulado) no aparece", tiene("Cobro duplicado"), false);
  caso("por categoría: arriendo $68.000", tiene("Arriendo de sala") && tiene("$68.000"), true);
  caso("margen: fila con -$20.500 (CL1)", tiene("-$20.500"), true);
  caso("margen: fila con -$11.500 (CL2)", tiene("-$11.500"), true);
  caso("nada dice «sin costo cargado»", tiene("sin costo cargado"), false);
  caso("singular/plural bien", texto.includes("1 egresos") || texto.includes("1 clases"), false);
  const desborde = await pagina.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  caso("sin scroll horizontal a 390 px", desborde, false);

  // -------------------------------------------------------------------------
  // 2. Registrar desde el formulario, anular desde el botón
  // -------------------------------------------------------------------------
  console.log("\n2. Registrar y anular desde la interfaz:");
  await pagina.click('a[href="/owner/finanzas/nuevo-egreso"]');
  await pagina.waitForURL("**/owner/finanzas/nuevo-egreso");
  await pagina.selectOption('select[name="categoria"]', "insumos");
  await pagina.fill('input[name="descripcion"]', DESCRIPCION);
  await pagina.fill('input[name="monto_clp"]', "1.234");
  // Por nombre y no por `button[type="submit"]`: el primero de la página es
  // «Salir», en la cabecera del portal.
  await pagina.getByRole("button", { name: "Registrar egreso" }).click();
  await pagina.waitForURL("**/owner/finanzas", { timeout: 20000 });
  await pagina.waitForLoadState("networkidle");
  let t2 = await pagina.locator("main").innerText();
  caso("aparece en la lista", t2.includes(DESCRIPCION) && t2.includes("$1.234"), true);
  caso("la caja bajó a $8.266", t2.includes("$8.266"), true);
  caso("ahora son 4 egresos", t2.includes("4 egresos registrados"), true);
  const [fila] = await sql(
    `select id, monto_clp, deleted_at, categoria from public.egresos where descripcion = $1`,
    [DESCRIPCION],
  );
  caso("en la base: $1.234, insumos, vigente", [fila?.monto_clp, fila?.categoria, fila?.deleted_at], [1234, "insumos", null]);

  // Anular: el botón de la fila, el motivo y la confirmación.
  const item = pagina.locator("li", { hasText: DESCRIPCION });
  await item.getByRole("button", { name: "Anular" }).click();
  await item.locator('input[placeholder="Se registró dos veces"]').fill("Era una prueba");
  await item.getByRole("button", { name: "Confirmar anulación" }).click();
  await pagina.waitForFunction(
    (d) => !document.querySelector("main")?.innerText.includes(d),
    DESCRIPCION,
    { timeout: 20000 },
  );
  t2 = await pagina.locator("main").innerText();
  caso("desaparece de la lista", t2.includes(DESCRIPCION), false);
  caso("la caja vuelve a $9.500", t2.includes("$9.500"), true);
  const [anulada] = await sql(
    `select deleted_at is not null as anulado, motivo_anulacion, anulado_por is not null as con_autor
     from public.egresos where id = $1`,
    [fila.id],
  );
  caso("en la base sigue, anulada con motivo y autor", [anulada?.anulado, anulada?.motivo_anulacion, anulada?.con_autor], [true, "Era una prueba", true]);

  // -------------------------------------------------------------------------
  // 3. Los rechazos, con el mensaje de la función y no «Algo falló»
  // -------------------------------------------------------------------------
  console.log("\n3. Rechazos desde el formulario:");
  await pagina.goto(`${SITIO}/owner/finanzas/nuevo-egreso`, { waitUntil: "networkidle" });
  // El navegador bloquea el 0 y la fecha futura por `pattern` y `max`; se le
  // quitan para probar que la función rechaza igual.
  await pagina.evaluate(() => {
    document.querySelector('input[name="monto_clp"]')?.removeAttribute("pattern");
    document.querySelector('input[name="fecha"]')?.removeAttribute("max");
  });
  await pagina.selectOption('select[name="categoria"]', "insumos");
  await pagina.fill('input[name="descripcion"]', DESCRIPCION);
  await pagina.fill('input[name="monto_clp"]', "0");
  // Por nombre y no por `button[type="submit"]`: el primero de la página es
  // «Salir», en la cabecera del portal.
  await pagina.getByRole("button", { name: "Registrar egreso" }).click();
  await pagina.waitForSelector('p[role="alert"]', { timeout: 15000 });
  caso("monto 0 → mensaje de la función", await pagina.locator('p[role="alert"]').innerText(), "El monto tiene que ser mayor que cero");
  await pagina.fill('input[name="monto_clp"]', "1000");
  await pagina.fill('input[name="fecha"]', "2099-01-01");
  // Por nombre y no por `button[type="submit"]`: el primero de la página es
  // «Salir», en la cabecera del portal.
  await pagina.getByRole("button", { name: "Registrar egreso" }).click();
  await pagina.waitForFunction(
    () => document.querySelector('p[role="alert"]')?.innerText.includes("futura"),
    null,
    { timeout: 15000 },
  );
  caso("fecha futura → mensaje de la función", (await pagina.locator('p[role="alert"]').innerText()).startsWith("La fecha no puede ser futura"), true);
  caso("nada quedó registrado", (await sql(`select count(*)::int as n from public.egresos where descripcion = $1 and deleted_at is null`, [DESCRIPCION]))[0].n, 0);

  // -------------------------------------------------------------------------
  // 4. El comprobante: subir un PDF y verlo por la URL firmada
  // -------------------------------------------------------------------------
  console.log("\n4. Comprobante:");
  // Página fresca: la fecha por defecto es hoy en Santiago, calculada en el
  // servidor; escribirla acá con la hora UTC podría caer en mañana.
  await pagina.goto(`${SITIO}/owner/finanzas/nuevo-egreso`, { waitUntil: "networkidle" });
  await pagina.selectOption('select[name="categoria"]', "insumos");
  await pagina.fill('input[name="descripcion"]', DESCRIPCION);
  await pagina.fill('input[name="monto_clp"]', "500");
  // Por nombre y no por `button[type="submit"]`: el primero de la página es
  // «Salir», en la cabecera del portal.
  await pagina.getByRole("button", { name: "Registrar egreso" }).click();
  await pagina.waitForURL("**/owner/finanzas", { timeout: 20000 });
  await pagina.waitForLoadState("networkidle");
  const conEgreso = pagina.locator("li", { hasText: DESCRIPCION });
  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n160\n%%EOF\n",
  );
  await conEgreso.locator('input[type="file"]').setInputFiles({ name: "verificacion.pdf", mimeType: "application/pdf", buffer: pdf });
  await conEgreso.getByRole("link", { name: "Ver comprobante" }).waitFor({ timeout: 20000 });
  caso("aparece «Ver comprobante»", true, true);
  const [conPath] = await sql(`select comprobante_path from public.egresos where descripcion = $1 and deleted_at is null`, [DESCRIPCION]);
  caso("la columna la escribió la función", conPath?.comprobante_path?.endsWith(".pdf"), true);
  const verUrl = await conEgreso.getByRole("link", { name: "Ver comprobante" }).getAttribute("href");
  const respuestaVer = await pagina.context().request.get(`${SITIO}${verUrl}`, { maxRedirects: 0 });
  caso("GET del comprobante redirige a una URL firmada", [respuestaVer.status(), (respuestaVer.headers().location ?? "").includes("/storage/v1/object/sign/")], [302, true]);
  const firmado = await fetch(respuestaVer.headers().location);
  caso("la URL firmada entrega el PDF", [firmado.status, firmado.headers.get("content-type")], [200, "application/pdf"]);
  await supabase.storage.from("comprobantes-egresos").remove([conPath.comprobante_path]);
  await sql(`delete from public.egresos where descripcion = $1`, [DESCRIPCION]);

  // -------------------------------------------------------------------------
  // 5. Un admin: por URL directa, por REST con su JWT; anon sobre las tablas
  // -------------------------------------------------------------------------
  console.log("\n5. Lo que un layout no cubre:");
  const { pagina: pAdmin } = await sesion(ADMIN, "/owner/finanzas");
  caso("admin por URL directa rebota", new URL(pAdmin.url()).pathname, "/admin");

  const cliente = createClient(staging.NEXT_PUBLIC_SUPABASE_URL, staging.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: login, error: errLogin } = await cliente.auth.signInWithPassword({ email: ADMIN, password: CLAVE });
  if (errLogin) throw new Error(`login admin: ${errLogin.message}`);
  const jwt = login.session.access_token;
  const rest = (ruta, init = {}) =>
    fetch(`${staging.NEXT_PUBLIC_SUPABASE_URL}/rest/v1${ruta}`, {
      ...init,
      headers: {
        apikey: staging.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  const periodo = { p_desde: "2026-09-01T03:00:00Z", p_hasta: "2026-10-01T03:00:00Z", p_desde_ant: "2026-08-01T04:00:00Z", p_hasta_ant: "2026-09-01T03:00:00Z" };
  const rpc = await rest("/rpc/metricas_finanzas", { method: "POST", body: JSON.stringify(periodo) });
  caso("admin → rpc metricas_finanzas", [rpc.status, (await rpc.json()).code], [403, "42501"]);
  const reg = await rest("/rpc/registrar_egreso", { method: "POST", body: JSON.stringify({ p_actor_user_id: login.user.id, p_fecha: "2026-09-10", p_categoria: "insumos", p_descripcion: "x", p_monto_clp: 1000 }) });
  caso("admin → rpc registrar_egreso (sin grant)", [reg.status, (await reg.json()).code], [403, "42501"]);
  const filas = await rest("/egresos?select=id");
  caso("admin → GET /egresos", [filas.status, await filas.json()], [200, []]);
  const costos = await rest("/costos_profesoras?select=profesora_id");
  caso("admin → GET /costos_profesoras", [costos.status, await costos.json()], [200, []]);

  const anon = (ruta) => fetch(`${staging.NEXT_PUBLIC_SUPABASE_URL}/rest/v1${ruta}`, { headers: { apikey: staging.NEXT_PUBLIC_SUPABASE_ANON_KEY } });
  for (const tabla of ["egresos", "costos_profesoras", "categorias_egreso"]) {
    const r = await anon(`/${tabla}?select=*`);
    caso(`anon → GET /${tabla}`, [r.status, (await r.json()).code], [401, "42501"]);
  }
  // `GET /rest/v1/` (el OpenAPI) responde 401 en staging: está apagado en el
  // proyecto. La auditoría de "qué expone la API" se hace ruta por ruta, que
  // es lo que importa de verdad: cada función de escritura, con la sesión de
  // un admin, tiene que no existir para él.
  const nadie = "00000000-0000-4000-8000-000000000000";
  const sondas = {
    anular_egreso: { p_actor_user_id: login.user.id, p_egreso_id: nadie, p_motivo: "x" },
    adjuntar_comprobante_egreso: { p_actor_user_id: login.user.id, p_egreso_id: nadie, p_path: "x" },
  };
  for (const [fn, cuerpo] of Object.entries(sondas)) {
    const r = await rest(`/rpc/${fn}`, { method: "POST", body: JSON.stringify(cuerpo) });
    caso(`admin → rpc ${fn} (sin grant)`, [r.status, (await r.json()).code], [403, "42501"]);
  }
  const anonRpc = await fetch(`${staging.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/metricas_finanzas`, {
    method: "POST",
    headers: { apikey: staging.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(periodo),
  });
  caso("anon → rpc metricas_finanzas", [anonRpc.status, (await anonRpc.json()).code], [401, "42501"]);
} finally {
  await limpiar();
  await navegador.close();
  await db.end();
}

console.log(fallas ? `\n${fallas} ✗` : "\nTodo ✓");
process.exitCode = fallas ? 1 : 0;
