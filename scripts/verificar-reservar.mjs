/**
 * PRD-0007 §8: el calendario de reservar del portal de alumna, mirado con un
 * navegador contra STAGING.
 *
 * Lo que comprueba:
 * - que es la grilla (siete días, tramos) y no el listado de antes;
 * - el filtro: la profesora elegida con fondo rosa y texto negro, las demás
 *   atenuadas **y legibles**. El contraste se **mide**: se pinta cada color en
 *   un canvas, se lee el píxel y se calcula la razón WCAG contra el fondo real
 *   del bloque. No se estima desde el nombre del token;
 * - a 375 px, los siete botones de día y que tocar uno cambie la columna;
 * - una alumna con créditos reserva desde la grilla, y se le descuenta;
 * - una alumna sin créditos ve que no le quedan y **no tiene botón** de
 *   reservar.
 *
 * Reserva y después cancela, así que staging queda como estaba.
 *
 *   SITIO=http://localhost:3300 node scripts/verificar-reservar.mjs
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { conectar } from "./staging.mjs";

const SITIO = process.env.SITIO ?? "http://localhost:3000";
const CAPTURAS = process.env.CAPTURAS ?? null;
const CON_RESERVA = "ana@ejemplo.invalid"; // tiene una reserva: se ve "Reservada"
const CON_SALDO = "alumna.prueba.0210@example.com";
// Se busca al correr, no se fija: otros verificadores (PRD-0023) le regalan
// clases a alumnas de staging, y una "sin saldo" fija deja de serlo.
const SIN_SALDO = (
  await (async () => {
    const db = await conectar();
    try {
      return (await db.query(
        `select p.email from perfiles p
         where p.rol = 'alumna' and p.perfil_completo_at is not null and p.deleted_at is null
           and not exists (select 1 from creditos c where c.perfil_id = p.id
                           and c.cantidad_disponible > 0 and c.fecha_vencimiento > now())
         order by p.created_at limit 1`)).rows[0]?.email;
    } finally {
      await db.end().catch(() => {});
    }
  })()
) ?? "sin-alumna-sin-saldo";
const FILTRO = "Pau";

const env = Object.fromEntries(
  readFileSync(".env.staging", "utf8").split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const sql = async (q, p = []) => {
  const db = await conectar();
  try {
    return (await db.query(q, p)).rows;
  } finally {
    await db.end().catch(() => {});
  }
};
const saldo = async (email) =>
  (await sql(
    `select coalesce(sum(c.cantidad_disponible),0)::int as s from creditos c
     join perfiles p on p.id = c.perfil_id where p.email = $1 and c.fecha_vencimiento > now()`,
    [email],
  ))[0].s;

const r = [];
const caso = (n, esperado, real) =>
  r.push({ n, esperado, real, ok: String(real) === String(esperado) });

if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });
const nav = await chromium.launch();

async function sesion(email, ancho) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  await p.goto(
    `${SITIO}/auth/confirmar?token_hash=${data.properties.hashed_token}&type=email&volver=%2Freservar`,
    { waitUntil: "networkidle" },
  );
  return p;
}

/**
 * Avanza hasta la primera semana con clases que no hayan pasado. Desde
 * PRD-0006 §13 la grilla ya abre ahí sola; esto queda para cuando el
 * verificador vuelve atrás con "Antes".
 */
async function aSemanaConClases(p) {
  // Clases **no pasadas**: desde PRD-0006 §13 la semana de hoy muestra
  // también las que ya ocurrieron, y con esas no hay nada que probar.
  const hay = () =>
    p.locator("main [data-estado]:not([data-estado='pasada'])").evaluateAll((xs) => xs.length > 0);
  for (let i = 0; i < 9 && !(await hay()); i++) {
    await p.getByRole("button", { name: /Después/ }).click();
    await p.waitForTimeout(150);
  }
}

async function capturar(p, nombre) {
  if (!CAPTURAS) return;
  await p.addStyleTag({ content: "header{position:static!important}" });
  await p.screenshot({ path: `${CAPTURAS}/${nombre}.png`, fullPage: true });
}

/**
 * Contraste WCAG de cada texto de los bloques, contra el fondo del propio
 * bloque. Los colores se resuelven pintándolos en un canvas, así da igual en
 * qué formato los devuelva el navegador (Tailwind v4 usa oklch y color-mix).
 */
const contrastes = (p, selector) =>
  p.evaluate((selector) => {
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
        if (c[3] > 0) return c;
      }
      return [255, 255, 255, 255];
    };
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const salida = [];
    for (const bloque of document.querySelectorAll(selector)) {
      if (bloque.offsetParent === null) continue;
      const fondo = fondoDe(bloque);
      for (const t of bloque.querySelectorAll("p, span")) {
        if (!t.textContent.trim() || t.children.length) continue;
        let c = rgba(getComputedStyle(t).color);
        // Un texto con alfa se mezcla con su fondo antes de medir.
        const a = c[3] / 255;
        c = c.map((v, i) => (i < 3 ? Math.round(v * a + fondo[i] * (1 - a)) : 255));
        const [l1, l2] = [lum(c), lum(fondo)].sort((x, y) => y - x);
        salida.push({ texto: t.textContent.trim().slice(0, 24), razon: (l1 + 0.05) / (l2 + 0.05) });
      }
    }
    return salida;
  }, selector);

try {
  // --- 1440: la grilla, sin filtro y con filtro ----------------------------
  const ana = await sesion(CON_RESERVA, 1440);
  caso("entra a /reservar", "/reservar", new URL(ana.url()).pathname);
  await aSemanaConClases(ana);
  caso("es la grilla: siete columnas de día", 7,
    await ana.locator("main p.xo-eyebrow").filter({ hasText: /^(lunes|martes|miércoles|jueves|viernes|sábado|domingo)$/i }).count());
  caso("ya no es el listado: ningún botón 'Reservar' suelto por clase", 0,
    await ana.getByRole("button", { name: "Reservar", exact: true }).count());
  caso("cada clase dice cuántos lugares quedan", true,
    (await ana.locator("main [data-estado='reservable']").first().innerText()).match(/\d+ lugar/) !== null);
  // La reserva de Ana puede no caer en la semana actual: se avanza hasta verla.
  for (let i = 0; i < 9 && (await ana.locator("main [data-estado='reservada']").count()) === 0; i++) {
    await ana.getByRole("button", { name: /Después/ }).click();
    await ana.waitForTimeout(150);
  }
  caso("la suya se distingue: dice Reservada", true,
    (await ana.locator("main [data-estado='reservada']").first().innerText()).includes("Reservada"));
  await capturar(ana, "reservar-1440-sin-filtro");

  for (let i = 0; i < 9 && (await ana.getByRole("button", { name: /Antes/ }).isEnabled()); i++) {
    await ana.getByRole("button", { name: /Antes/ }).click();
  }
  await aSemanaConClases(ana);
  await ana.locator("main").getByRole("button", { name: FILTRO, exact: true }).click();
  // Los bloques tienen `transition-colors`: medir antes de que termine da un
  // color a medio camino, y un contraste que no es el que se ve.
  await ana.waitForTimeout(600);
  const destacadas = ana.locator("main [data-resalte='destacada']");
  caso(`con ${FILTRO} elegida, sus clases se destacan`, true, (await destacadas.count()) > 0);
  caso("y todas las destacadas son de ella", true,
    (await destacadas.allInnerTexts()).every((t) => t.includes(FILTRO)));
  caso("las demás siguen visibles, atenuadas", true,
    (await ana.locator("main [data-resalte='atenuada']").count()) > 0);
  caso("la destacada tiene fondo rosa y texto negro", "rgb(247, 173, 191) · rgb(26, 26, 26)",
    await destacadas.first().evaluate((b) => {
      const ctx = document.createElement("canvas").getContext("2d");
      const pinta = (c) => { ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); const d = ctx.getImageData(0, 0, 1, 1).data; return `rgb(${d[0]}, ${d[1]}, ${d[2]})`; };
      return `${pinta(getComputedStyle(b).backgroundColor)} · ${pinta(getComputedStyle(b.querySelector("p")).color)}`;
    }));

  const atenuado = await contrastes(ana, "main [data-resalte='atenuada']");
  const minAt = Math.min(...atenuado.map((x) => x.razon));
  caso(`texto atenuado: el peor contraste medido es ≥ 4,5:1 (${atenuado.length} textos)`, true, minAt >= 4.5);
  const destacado = await contrastes(ana, "main [data-resalte='destacada']");
  const minDe = Math.min(...destacado.map((x) => x.razon));
  caso(`texto destacado: el peor contraste medido es ≥ 4,5:1 (${destacado.length} textos)`, true, minDe >= 4.5);
  console.log(`contraste medido · atenuado mínimo ${minAt.toFixed(2)}:1 · destacado mínimo ${minDe.toFixed(2)}:1`);
  await capturar(ana, "reservar-1440-con-filtro");

  // --- 375: un día a la vez -------------------------------------------------
  const tel = await sesion(CON_RESERVA, 375);
  await aSemanaConClases(tel);
  const botonesDia = tel.getByRole("group", { name: "Día" }).getByRole("button");
  caso("a 375 px hay siete botones de día", 7, await botonesDia.count());
  const columnasVisibles = () => tel.evaluate(() =>
    [...document.querySelectorAll("main p.xo-eyebrow")]
      .filter((p) => /^(lunes|martes|miércoles|jueves|viernes|sábado|domingo)$/i.test(p.textContent.trim()))
      .filter((p) => p.offsetParent !== null).map((p) => p.textContent.trim().toLowerCase()));
  caso("a 375 px se ve una sola columna", 1, (await columnasVisibles()).length);
  caso("a 375 px nada desborda a lo ancho", false,
    await tel.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  const anchoBloque = await tel.locator("main [data-estado]").first().evaluate((b) => b.getBoundingClientRect().width);
  caso("a 375 px un bloque es ancho y tocable (≥ 200 px)", true, anchoBloque >= 200);
  const actual = (await columnasVisibles())[0];
  const otro = actual === "domingo" ? "lunes" : "domingo";
  await tel.getByRole("button", { name: otro, exact: true }).click();
  caso(`tocar "${otro}" muestra esa columna`, otro, (await columnasVisibles()).join(","));
  await tel.getByRole("button", { name: actual, exact: true }).click();
  await capturar(tel, "reservar-375-sin-filtro");
  await tel.locator("main").getByRole("button", { name: FILTRO, exact: true }).click();
  await tel.waitForTimeout(400);
  // Con el filtro puesto, el punto de cada día dice si tiene clases **de ella**.
  // Se comprueba día por día: el punto marcado si y solo si al abrir ese día
  // aparece una clase destacada.
  const destacadasVisibles = () =>
    tel.locator("main [data-resalte='destacada']").evaluateAll((xs) => xs.filter((x) => x.offsetParent !== null).length);
  const discrepancias = [];
  let marcados = 0;
  let primerDiaDeElla = null;
  for (const b of await botonesDia.all()) {
    const marca = (await b.locator("[data-marca]").getAttribute("data-marca")) === "si";
    await b.click();
    const tiene = (await destacadasVisibles()) > 0;
    if (marca) marcados++;
    if (tiene && !primerDiaDeElla) primerDiaDeElla = b;
    if (marca !== tiene) discrepancias.push(`${await b.getAttribute("aria-label")}: punto ${marca ? "sí" : "no"}, clases de ella ${tiene ? "sí" : "no"}`);
  }
  caso(`con ${FILTRO} elegida, el punto marca solo los días con clases de ella`, "", discrepancias.join("; "));
  caso(`y marca al menos un día (${marcados})`, true, marcados > 0);
  // La captura, abierta en un día de ella y con las transiciones terminadas.
  if (primerDiaDeElla) await primerDiaDeElla.click();
  await tel.waitForTimeout(400);
  await capturar(tel, "reservar-375-con-filtro");

  // --- reservar con créditos -----------------------------------------------
  const conSaldo = await sesion(CON_SALDO, 390);
  await aSemanaConClases(conSaldo);
  const antes = await saldo(CON_SALDO);
  const bloque = conSaldo.locator("main [data-estado='reservable']").filter({ visible: true }).first();
  const nombreClase = (await bloque.locator("p").first().innerText()).trim();
  await bloque.click();
  const dialogo = conSaldo.getByRole("dialog");
  await dialogo.waitFor();
  caso("tocar una clase abre su detalle, no reserva", antes, await saldo(CON_SALDO));
  caso("el foco entra en Volver", "Volver",
    await conSaldo.evaluate(() => document.activeElement?.textContent?.trim()));
  await dialogo.getByRole("button", { name: "Reservar esta clase" }).click();
  await conSaldo.waitForTimeout(3500);
  caso(`reservar ${nombreClase} descuenta una clase`, antes - 1, await saldo(CON_SALDO));
  caso("y el bloque pasa a Reservada", true,
    (await conSaldo.locator("main [data-estado='reservada']").filter({ visible: true }).count()) > 0);
  // Se deshace, para dejar staging como estaba.
  await conSaldo.locator("main [data-estado='reservada']").filter({ visible: true }).first().click();
  await conSaldo.getByRole("dialog").getByRole("button", { name: "Cancelar mi reserva" }).click();
  await conSaldo.waitForTimeout(3500);
  caso("cancelarla desde el mismo calendario la devuelve", antes, await saldo(CON_SALDO));

  // --- una especial no se ofrece con el pack -------------------------------
  // Antes el calendario la mostraba como una clase más, con su botón de
  // reservar, y la base rechazaba la reserva (PRD-0018).
  const especiales = conSaldo.locator("main [data-estado='especial']");
  for (let i = 0; i < 9 && (await especiales.count()) === 0; i++) {
    await conSaldo.getByRole("button", { name: /Después/ }).click();
    await conSaldo.waitForTimeout(150);
  }
  if ((await especiales.count()) > 0) {
    const visible = especiales.filter({ visible: true });
    if ((await visible.count()) === 0) {
      // En el teléfono se ve un día a la vez: se busca el día de la especial.
      for (const b of await conSaldo.getByRole("group", { name: "Día" }).getByRole("button").all()) {
        await b.click();
        if ((await visible.count()) > 0) break;
      }
    }
    caso("una especial dice Especial, no lugares", true, (await visible.first().innerText()).includes("Especial"));
    await visible.first().click();
    const d3 = conSaldo.getByRole("dialog");
    await d3.waitFor();
    caso("su detalle no ofrece reservar con el pack", 0, await d3.getByRole("button", { name: /reservar/i }).count());
    caso("y lleva a su página", true,
      ((await d3.getByRole("link", { name: /ver la clase especial/i }).getAttribute("href")) ?? "").startsWith("/clases-especiales/"));
    await d3.getByRole("button", { name: "Volver" }).click();
  } else {
    caso("hay una especial publicada en staging para probar", true, false);
  }

  // --- sin créditos ----------------------------------------------------------
  const sinSaldo = await sesion(SIN_SALDO, 390);
  await aSemanaConClases(sinSaldo);
  caso("sin créditos: lo dice arriba", true,
    (await sinSaldo.locator("main").innerText()).includes("Te quedan\n0 clases") ||
    /Te quedan\s*0 clases/.test(await sinSaldo.locator("main").innerText()));
  caso("sin créditos: ninguna clase se ofrece como reservable", 0,
    await sinSaldo.locator("main [data-estado='reservable']").count());
  await sinSaldo.locator("main [data-estado='sin-saldo']").filter({ visible: true }).first().click();
  const d2 = sinSaldo.getByRole("dialog");
  await d2.waitFor();
  caso("sin créditos: el detalle no tiene botón de reservar", 0,
    await d2.getByRole("button", { name: /reservar/i }).count());
  caso("sin créditos: dice que no le quedan y ofrece comprar", true,
    (await d2.innerText()).includes("No te quedan clases") &&
    (await d2.getByRole("link", { name: /comprar clases/i }).count()) === 1);
  await capturar(sinSaldo, "reservar-375-sin-creditos-detalle");
} catch (e) {
  console.error("\nSE CORTÓ:", e.message);
  r.push({ n: `se cortó: ${e.message.split("\n")[0]}`, esperado: "", real: "", ok: false });
} finally {
  await nav.close();
}

console.log("\nPRD-0007 §8 — el calendario de reservar del portal de alumna\n");
console.log("| Caso | Esperado | Obtenido | |");
console.log("|---|---|---|---|");
for (const x of r) console.log(`| ${x.n} | ${x.esperado} | ${x.real} | ${x.ok ? "✓" : "✗"} |`);
const fallas = r.filter((x) => !x.ok).length;
console.log(`\n${r.length - fallas}/${r.length} como se esperaba.`);
process.exitCode = fallas ? 1 : 0;
