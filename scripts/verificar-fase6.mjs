/**
 * PRD-0018 fase 6: el camino entero **con clics de verdad**, contra STAGING.
 *
 * Por qué existe: todo lo demás de este proyecto se prueba con datos —funciones
 * puras con tests, escenarios por SQL— y eso no alcanza para lo que pide el
 * checkpoint: crear una especial desde el formulario, publicarla, reservarla
 * desde otra cuenta y aprobarla. Es la regla del magic link: si la prueba no
 * puede fallar por lo mismo que falla en producción, no es una prueba del flujo.
 *
 * Acá no se llama a ninguna función de la base para avanzar. Se abre **el
 * enlace que llegaría por correo** (token_hash, la forma que viaja entre
 * dispositivos), se llenan los campos que llena una persona y se aprietan los
 * botones que aprieta una persona. El SQL solo mira el resultado.
 *
 * CÓMO SE CORRE
 *
 *   1. Levantar el sitio contra staging, no contra producción:
 *        set -a; . ./.env.staging; set +a
 *        NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run dev
 *   2. Sembrar el escenario:  node scripts/sembrar-escenario.mjs
 *   3. Correr esto:           node scripts/verificar-fase6.mjs
 *
 * **Playwright no es dependencia del proyecto**, a propósito: son ~100 MB de
 * navegador que no tienen por qué bajar en cada `npm install`. Se instala
 * aparte cuando se va a verificar:
 *
 *   npm i --no-save playwright && npx playwright install chromium
 *
 * Lo que este script NO puede probar: que el correo **llegue**. Las cuentas del
 * escenario usan `@ejemplo.invalid` y el código, con razón, no les escribe. Que
 * ese correo salga y se pueda reintentar es PRD-0019, y es bloqueante antes de
 * publicar la primera especial de verdad.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import pg from "pg";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const RAIZ = "/Users/carlatati/Desktop/Proyectos de Felipi/XO_Dance_Studio";
const SITIO = "http://localhost:3000";
const STAGING_REF = "ybopuahlzbjkkwumkllk";
/**
 * Una portada de verdad, hecha al vuelo desde el logo: el Route Handler valida
 * tipo y tamaño en el servidor, así que mandarle un archivo inventado no
 * probaría nada. `sips` viene con macOS.
 */
const PORTADA = `${tmpdir()}/xo-portada-verificacion.jpg`;
execFileSync("sips", ["-s", "format", "jpeg", `${RAIZ}/public/logo-xo.png`, "--out", PORTADA], {
  stdio: "ignore",
});

const cfg = Object.fromEntries(
  readFileSync(`${RAIZ}/.env.staging`, "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
);
if (cfg.SUPABASE_PROJECT_REF !== STAGING_REF) throw new Error("esto solo corre contra staging");

const supabase = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const db = new pg.Client({
  host: "aws-0-sa-east-1.pooler.supabase.com",
  port: 5432,
  user: `postgres.${STAGING_REF}`,
  password: cfg.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await db.connect();
const sql = async (q, p) => (await db.query(q, p)).rows;

const resultados = [];
const caso = (nombre, esperado, real) =>
  resultados.push({ nombre, esperado, real, ok: String(real) === String(esperado) });

/** El enlace tal como llegaría en el correo: token_hash + type, sin SDK. */
async function enlaceMagico(email, volver) {
  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`no se pudo generar el enlace de ${email}: ${error.message}`);
  return `${SITIO}/auth/confirmar?token_hash=${data.properties.hashed_token}&type=magiclink&volver=${encodeURIComponent(volver)}`;
}

/** Los mismos campos que llenaría una persona. */
async function rellenar(pagina, titulo) {
  await pagina.fill('input[name="titulo"]', titulo);
  await pagina.fill('input[name="cancion"]', "Tema de prueba · Artista");
  await pagina.fill('textarea[name="descripcion"]', "Clase de verificación de la fase 6.");
  await pagina.selectOption('select[name="curso_id"]', { index: 1 });
  await pagina.selectOption('select[name="profesora_id"]', { index: 1 });
  await pagina.selectOption('select[name="sede_id"]', { index: 1 });
  await pagina.fill('input[name="inicio"]', "2026-10-15T09:30");
  await pagina.fill('input[name="cupo_maximo"]', "1");
  await pagina.fill('input[name="reel_url"]', "https://www.instagram.com/reel/FASE6VERIFICA/");
  await pagina.check('input[type="checkbox"]');
}

const navegador = await chromium.launch();
const sesion = async (email, volver) => {
  const contexto = await navegador.newContext({ viewport: { width: 420, height: 900 } });
  const pagina = await contexto.newPage();
  pagina.on("pageerror", (e) => console.log(`  [error de página] ${e.message}`));
  await pagina.goto(await enlaceMagico(email, volver), { waitUntil: "networkidle" });
  return { contexto, pagina };
};

let claseId = null;

// PRD-0017 deja los datos de transferencia vacíos a propósito, y con eso la
// pantalla de reserva se niega a pedir plata —bien hecho—. En staging se cargan
// con datos evidentemente falsos para poder recorrer el camino entero.
await sql(`
  insert into public.parametros (clave, valor, descripcion) values
    ('transferencia_banco', 'Banco de Prueba', 'Staging'),
    ('transferencia_tipo_cuenta', 'Cuenta Vista', 'Staging'),
    ('transferencia_numero', '000000000', 'Staging'),
    ('transferencia_rut', '11111111-1', 'Staging'),
    ('transferencia_titular', 'XO Dance Studio (staging)', 'Staging'),
    ('transferencia_correo', 'staging@ejemplo.invalid', 'Staging')
  on conflict (clave) do update set valor = excluded.valor
`);

try {
  // 1. Admin entra por el enlace del correo -----------------------------------
  const admin = await sesion("admin@ejemplo.invalid", "/admin/especiales/nueva");
  caso("admin abre el enlace del correo y cae en el formulario",
       `${SITIO}/admin/especiales/nueva`, admin.pagina.url());
  caso("a admin el precio le aparece bloqueado",
       "true", String(await admin.pagina.isDisabled('input[name="precio_clp"]')));

  // 2. Sin valor de arranque, admin no puede crear ----------------------------
  await sql(`delete from public.parametros where clave = 'especial_precio_default_clp'`);
  await admin.pagina.reload({ waitUntil: "networkidle" });
  const TITULO = `Coreo de la fase 6 ${Date.now().toString().slice(-5)}`;
  await rellenar(admin.pagina, TITULO);
  await admin.pagina.getByRole("button", { name: "Guardar borrador" }).click();
  await admin.pagina.waitForTimeout(2500);
  const sinDefault = (await admin.pagina.locator('[role="alert"]').first().textContent().catch(() => "")) ?? "";
  caso("sin el valor de arranque cargado, admin no puede crear",
       true, sinDefault.includes("Falta el precio por defecto"));

  // 3. Con el valor cargado —como queda tras la migración— sí crea ------------
  await sql(
    `insert into public.parametros (clave, valor, descripcion)
     values ('especial_precio_default_clp', '12000', 'Valor de arranque del formulario. PRD-0018 8.4.')
     on conflict (clave) do update set valor = excluded.valor`,
  );
  await admin.pagina.reload({ waitUntil: "networkidle" });
  await rellenar(admin.pagina, TITULO);
  await admin.pagina.getByRole("button", { name: "Guardar borrador" }).click();
  await admin.pagina.waitForURL(/\/admin\/especiales\/[0-9a-f-]{36}$/, { timeout: 20000 });

  claseId = admin.pagina.url().split("/").pop();
  const [creada] = await sql(
    `select titulo, precio_clp, cupo_maximo, publicada_at, slug,
            to_char(inicio at time zone 'America/Santiago', 'YYYY-MM-DD HH24:MI') as local
     from public.clases where id = $1`,
    [claseId],
  );
  caso("la clase se creó con el título del formulario", TITULO, creada.titulo);
  caso("la hora quedó donde se escribió, en hora de Santiago", "2026-10-15 09:30", creada.local);
  caso("admin no fija precio: queda el valor de arranque", "12000", String(creada.precio_clp));
  caso("nace como borrador", "sin publicar", creada.publicada_at ? "publicada" : "sin publicar");

  // 4. Portada y publicación --------------------------------------------------
  await admin.pagina.setInputFiles('input[type="file"]', PORTADA);
  await admin.pagina.getByRole("button", { name: "Subir portada" }).click();
  await admin.pagina.waitForTimeout(4000);
  const [conPortada] = await sql(`select portada_path from public.clases where id = $1`, [claseId]);
  caso("la portada queda en el bucket privado, nombrada por la clase",
       `${claseId}.jpg`, conPortada.portada_path);

  await admin.pagina.reload({ waitUntil: "networkidle" });
  await admin.pagina.getByRole("button", { name: "Publicar", exact: true }).click();
  await admin.pagina.waitForTimeout(4000);
  const [publicada] = await sql(`select publicada_at, slug from public.clases where id = $1`, [claseId]);
  caso("publicar la deja publicada", "publicada", publicada.publicada_at ? "publicada" : "sin publicar");
  const slug = publicada.slug;

  // 5. Sin sesión: la ficha pública y el Reel tras el toque -------------------
  const anonimo = await navegador.newContext({ viewport: { width: 420, height: 900 } });
  const publica = await anonimo.newPage();
  const pedidosInstagram = [];
  publica.on("request", (r) => {
    if (r.url().includes("instagram.com")) pedidosInstagram.push(r.url());
  });
  await publica.goto(`${SITIO}/clases-especiales/${slug}`, { waitUntil: "networkidle" });
  const htmlFicha = await publica.content();
  caso("la ficha pública muestra el título", true, htmlFicha.includes(TITULO));
  caso("y cuántos lugares quedan", true, htmlFicha.includes("Quedan 1 de 1"));
  caso("antes de tocar: cero peticiones a instagram.com", "0", String(pedidosInstagram.length));

  await publica.getByRole("button", { name: "Ver el Reel en Instagram" }).click();
  await publica.waitForTimeout(3000);
  caso("al tocar, recién ahí se habla con Instagram",
       true, pedidosInstagram.some((u) => u.includes("/embed")));

  // 6. Otra cuenta reserva ----------------------------------------------------
  const ana = await sesion("ana@ejemplo.invalid", `/clases-especiales/${slug}`);
  await ana.pagina.getByRole("link", { name: /Reservar por/ }).click();
  await ana.pagina.waitForURL(new RegExp(`/reservar-especial/${slug}$`), { timeout: 20000 });
  caso("el botón de reservar lleva a la pantalla de transferencia",
       `${SITIO}/reservar-especial/${slug}`, ana.pagina.url());

  await ana.pagina.fill('input[name="nota"]', "Reserva de la verificación de fase 6");
  await ana.pagina.getByRole("button", { name: /Ya transferí/ }).click();
  await ana.pagina.getByText("Te guardamos el lugar").waitFor({ timeout: 20000 });

  const [reserva] = await sql(
    `select r.estado as reserva, c.estado as compra, c.monto_clp, c.clase_id is not null as de_clase,
            public.cupo_tomado(r.clase_id) as tomados
     from public.reservas r join public.compras c on c.id = r.compra_id
     where r.clase_id = $1`,
    [claseId],
  );
  caso("la reserva nace pendiente de pago", "pendiente_pago", reserva.reserva);
  caso("con compra pendiente, de clase y por el precio de la clase",
       "pendiente/true/12000", `${reserva.compra}/${reserva.de_clase}/${reserva.monto_clp}`);
  caso("EL CUPO QUEDA TOMADO con la compra todavía sin aprobar", "1", String(reserva.tomados));

  await ana.pagina.goto(`${SITIO}/mis-clases`, { waitUntil: "networkidle" });
  const htmlAna = await ana.pagina.content();
  caso("en Mis clases ve hasta cuándo le guardan el cupo",
       true, htmlAna.includes("Te guardamos el cupo hasta"));
  caso("y el botón dice soltar el cupo, no cancelar", true, htmlAna.includes("Soltar el cupo"));

  // 7. Una segunda alumna se topa con la clase llena --------------------------
  const bea = await sesion("bea@ejemplo.invalid", `/reservar-especial/${slug}`);
  caso("la segunda alumna se topa con la clase llena",
       true, (await bea.pagina.content()).includes("Esta clase se llenó mientras mirabas"));

  // 8. Admin aprueba desde la bandeja ----------------------------------------
  await admin.pagina.goto(`${SITIO}/admin/compras`, { waitUntil: "networkidle" });
  caso("la bandeja dice de qué clase es la transferencia",
       true, (await admin.pagina.content()).includes(TITULO));

  await admin.pagina.locator("li", { hasText: TITULO }).first()
    .getByRole("button", { name: /Aprobar/ }).click();
  await admin.pagina.waitForTimeout(5000);

  const [aprobada] = await sql(
    `select r.estado as reserva, c.estado as compra,
            (select count(*) from public.creditos where compra_id = c.id) as lotes,
            public.cupo_tomado(r.clase_id) as tomados
     from public.reservas r join public.compras c on c.id = r.compra_id
     where r.clase_id = $1`,
    [claseId],
  );
  caso("aprobar confirma la reserva y paga la compra",
       "confirmada/pagada", `${aprobada.reserva}/${aprobada.compra}`);
  caso("una compra de clase no acredita ni un crédito", "0", String(aprobada.lotes));
  caso("el cupo sigue tomado, ahora confirmado", "1", String(aprobada.tomados));

  const publica2 = await anonimo.newPage();
  await publica2.goto(`${SITIO}/clases-especiales/${slug}`, { waitUntil: "networkidle" });
  caso("la ficha pública ya dice Llena", true, (await publica2.content()).includes("Llena"));
} catch (e) {
  console.error("\nSE CORTÓ:", e.message);
  resultados.push({ nombre: "el recorrido llegó al final", esperado: "sí", real: `cortado: ${e.message.split("\n")[0]}`, ok: false });
} finally {
  // La clase de la prueba no queda dando vueltas en staging.
  if (claseId) {
    await sql(
      `update public.clases set estado = 'cancelada', motivo_cancelacion = 'Verificación de fase 6' where id = $1`,
      [claseId],
    ).catch(() => {});
  }
  await navegador.close();
}

console.log("\n| Caso | Esperado | Obtenido | |");
console.log("|---|---|---|---|");
for (const r of resultados) console.log(`| ${r.nombre} | ${r.esperado} | ${r.real} | ${r.ok ? "✓" : "✗"} |`);
const fallas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - fallas}/${resultados.length} pasos como se esperaba.`);
await db.end();
process.exitCode = fallas ? 1 : 0;
