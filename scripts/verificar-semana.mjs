/**
 * PRD-0006 §13: qué semana abre el calendario, las clases pasadas y la marca de
 * hoy — en el sitio público y en el portal de alumna, contra STAGING.
 *
 * **Simula un domingo, no lo espera.** La grilla toma la hora del navegador al
 * cargar, así que basta con fijar el reloj de Playwright: se elige el domingo
 * siguiente a hoy a las 21:30, para que su semana tenga clases ya ocurridas de
 * lunes a sábado. La consulta trae desde el lunes de la semana real, así que
 * ese domingo cae dentro de los datos.
 *
 * Lo que comprueba en cada calendario:
 * - abre en la primera semana con algo reservable, y la anterior —la del
 *   domingo simulado— no tenía nada que reservar;
 * - las pasadas se ven, dicen "Ya pasó" y no se pueden seleccionar;
 * - su texto se lee: el contraste se **mide** contra el fondo real (≥ 4,5:1);
 * - hoy está marcado con tono y línea, sin ningún número en el encabezado;
 * - a 375 px, el día que abre tiene algo que reservar;
 * - y sin simular nada, con la hora real, también abre en una semana con clases.
 *
 *   SITIO=http://localhost:3300 node scripts/verificar-semana.mjs
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const SITIO = process.env.SITIO ?? "http://localhost:3000";
const CAPTURAS = process.env.CAPTURAS ?? null;
const ALUMNA = "ana@ejemplo.invalid";

const env = Object.fromEntries(
  readFileSync(".env.staging", "utf8").split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]),
);
if (env.SUPABASE_PROJECT_REF !== "ybopuahlzbjkkwumkllk") throw new Error("Solo contra staging.");
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** El domingo siguiente a hoy, 21:30 en Santiago (UTC-3 en primavera). */
function proximoDomingo() {
  const hoy = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date()));
  const faltan = ((7 - hoy.getUTCDay()) % 7) || 7;
  const domingo = new Date(hoy.getTime() + faltan * 86400000).toISOString().slice(0, 10);
  return new Date(`${domingo}T21:30:00-03:00`);
}
const DOMINGO = proximoDomingo();

const r = [];
const caso = (n, esperado, real) => r.push({ n, esperado, real, ok: String(real) === String(esperado) });
if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });
const nav = await chromium.launch();

/** Una página, con o sin reloj simulado y con o sin sesión de alumna. */
async function abrir({ ruta, ancho, simulado, sesion }) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  if (simulado) await p.clock.install({ time: DOMINGO });
  let url = `${SITIO}${ruta}`;
  if (sesion) {
    const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email: sesion });
    if (error) throw error;
    url = `${SITIO}/auth/confirmar?token_hash=${data.properties.hashed_token}&type=email&volver=${encodeURIComponent(ruta)}`;
  }
  await p.goto(url, { waitUntil: "load" });
  if (simulado) await p.clock.runFor(1000); // que corra el efecto que toma la hora del navegador
  await p.waitForTimeout(600);
  return p;
}

const rango = (p) =>
  p.evaluate(() => [...document.querySelectorAll("main p")].find((x) => /^Del \d/.test(x.textContent.trim()))?.textContent.trim());

/** Cuántas clases visibles hay en la semana a la vista, por tipo. */
const conteo = (p) =>
  p.evaluate(() => {
    const visibles = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null);
    // Público: enlaces de clase vs. pasadas. Portal: bloques por estado.
    const pasadas = visibles("main [data-pasada='si'], main [data-estado='pasada']");
    const reservables = visibles("main a[style*='grid-'], main [data-estado]:not([data-estado='pasada'])");
    return {
      pasadas: pasadas.length,
      noPasadas: reservables.length,
      pasadasSeleccionables: pasadas.filter((e) => e.closest("a, button")).length,
      pasadasDicenYaPaso: pasadas.filter((e) => e.textContent.includes("Ya pasó")).length,
    };
  });

/** La razón de contraste más baja de los textos de las pasadas visibles. */
const contrastePasadas = (p) =>
  p.evaluate(() => {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const rgba = (css) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    };
    const fondoDe = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const c = rgba(getComputedStyle(e).backgroundColor);
        if (c[3] === 255) return c;
      }
      return [255, 255, 255, 255];
    };
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    let minimo = Infinity;
    let textos = 0;
    for (const b of document.querySelectorAll("main [data-pasada='si'], main [data-estado='pasada']")) {
      if (b.offsetParent === null) continue;
      const fondo = fondoDe(b);
      for (const t of b.querySelectorAll("p, span")) {
        if (!t.textContent.trim() || t.children.length) continue;
        let c = rgba(getComputedStyle(t).color);
        const a = c[3] / 255;
        c = c.map((v, i) => (i < 3 ? Math.round(v * a + fondo[i] * (1 - a)) : 255));
        const [l1, l2] = [lum(c), lum(fondo)].sort((x, y) => y - x);
        minimo = Math.min(minimo, (l1 + 0.05) / (l2 + 0.05));
        textos++;
      }
    }
    return { minimo, textos };
  });

const encabezadoDeHoy = (p) =>
  p.evaluate(() => {
    const h = document.querySelector("main [aria-current='date'][data-hoy='si']");
    if (!h) return null;
    const col = document.querySelectorAll("main [data-hoy='si']")[1];
    const otra = [...h.parentElement.children].find((e) => e !== h && e.querySelector("p"));
    return {
      dia: h.querySelector("p")?.textContent.trim().toLowerCase(),
      numeros: /\d/.test(h.textContent),
      linea: getComputedStyle(h.querySelector("span[aria-hidden]")).backgroundColor,
      tono: col ? getComputedStyle(col).backgroundColor !== getComputedStyle(otra).backgroundColor : false,
    };
  });

try {
  console.log(`Domingo simulado: ${DOMINGO.toISOString()} (21:30 en Santiago)\n`);

  for (const { nombre, ruta, sesion } of [
    { nombre: "público", ruta: "/calendario" },
    { nombre: "portal", ruta: "/reservar", sesion: ALUMNA },
  ]) {
    // --- un domingo, escritorio ---------------------------------------------
    const p = await abrir({ ruta, ancho: 1440, simulado: true, sesion });
    const abierta = await rango(p);
    const enLaAbierta = await conteo(p);
    caso(`${nombre}: el domingo abre en una semana con algo que reservar (${abierta})`, true, enLaAbierta.noPasadas > 0);
    if (CAPTURAS) await p.screenshot({ path: `${CAPTURAS}/${nombre}-domingo-semana-que-abre.png`, fullPage: true });

    await p.getByRole("button", { name: /Antes/ }).click();
    await p.waitForTimeout(300);
    const anterior = await conteo(p);
    caso(`${nombre}: la semana del domingo no tenía nada que reservar`, 0, anterior.noPasadas);
    caso(`${nombre}: pero sus clases se ven, como pasadas`, true, anterior.pasadas > 0);
    caso(`${nombre}: todas las pasadas dicen "Ya pasó"`, anterior.pasadas, anterior.pasadasDicenYaPaso);
    caso(`${nombre}: ninguna pasada se puede seleccionar`, 0, anterior.pasadasSeleccionables);

    const c = await contrastePasadas(p);
    caso(`${nombre}: el texto de las pasadas se lee (mínimo ${c.minimo.toFixed(2)}:1 en ${c.textos} textos, ≥ 4,5)`, true, c.minimo >= 4.5);

    const hoy = await encabezadoDeHoy(p);
    caso(`${nombre}: hoy está marcado, y es el domingo`, "domingo", hoy?.dia);
    caso(`${nombre}: el encabezado de hoy no lleva número`, false, hoy?.numeros);
    caso(`${nombre}: hoy lleva la línea rosa y el tono de columna`, "rgb(247, 173, 191) · true", `${hoy?.linea} · ${hoy?.tono}`);
    if (CAPTURAS) await p.screenshot({ path: `${CAPTURAS}/${nombre}-domingo-semana-pasada.png`, fullPage: true });

    // Tocar una pasada no hace nada: ni navega ni abre un detalle.
    const antes = p.url();
    await p.locator("main [data-pasada='si'], main [data-estado='pasada']").filter({ visible: true }).first().click({ force: true });
    await p.waitForTimeout(400);
    caso(`${nombre}: tocar una pasada no hace nada`, `${antes} · sin diálogo`,
      `${p.url()} · ${(await p.locator("dialog[open]").count()) ? "con diálogo" : "sin diálogo"}`);

    // --- un domingo, teléfono -----------------------------------------------
    const t = await abrir({ ruta, ancho: 375, simulado: true, sesion });
    const dia = await t.evaluate(() =>
      [...document.querySelectorAll("main p.xo-eyebrow")]
        .filter((x) => /^(lunes|martes|miércoles|jueves|viernes|sábado|domingo)$/i.test(x.textContent.trim()))
        .find((x) => x.offsetParent !== null)?.textContent.trim().toLowerCase());
    const delDia = await conteo(t);
    caso(`${nombre}: a 375 px el día que abre (${dia}) tiene algo que reservar`, true, delDia.noPasadas > 0);
    if (CAPTURAS) await t.screenshot({ path: `${CAPTURAS}/${nombre}-domingo-375.png`, fullPage: true });

    // --- la hora real, sin simular -----------------------------------------
    const real = await abrir({ ruta, ancho: 1440, simulado: false, sesion });
    caso(`${nombre}: con la hora real abre en una semana con clases (${await rango(real)})`, true,
      (await conteo(real)).noPasadas > 0);
  }
} catch (e) {
  console.error("\nSE CORTÓ:", e.message);
  r.push({ n: `se cortó: ${e.message.split("\n")[0]}`, esperado: "", real: "", ok: false });
} finally {
  await nav.close();
}

console.log("\nPRD-0006 §13 — qué semana abre, las pasadas y hoy\n");
console.log("| Caso | Esperado | Obtenido | |");
console.log("|---|---|---|---|");
for (const x of r) console.log(`| ${x.n} | ${x.esperado} | ${x.real} | ${x.ok ? "✓" : "✗"} |`);
const fallas = r.filter((x) => !x.ok).length;
console.log(`\n${r.length - fallas}/${r.length} como se esperaba.`);
process.exitCode = fallas ? 1 : 0;
