/**
 * PRD-0022: el sitio público, mirado con un navegador en tres anchos.
 *
 * Lo que esto comprueba no se ve compilando: que el logo sobresalga **sin tapar**
 * el primer texto de cada página, que a 375 px se pueda llegar a todos lados, y
 * que ninguna página desborde a lo ancho.
 *
 *   npm i --no-save playwright && npx playwright install chromium
 *   node scripts/verificar-sitio.mjs
 */
const S = process.env.SCRATCHPAD ?? process.cwd();
const pw = await import(`${S}/node_modules/playwright/index.js`);
const chromium = (pw.default ?? pw).chromium;

const SITIO = "http://localhost:3000";
const PAGINAS = [
  "/", "/calendario", "/nuestras-profes", "/comprar",
  "/clases-especiales", "/nosotros", "/ayuda", "/profesoras/carli",
];

const r = [];
const caso = (n, esperado, real) =>
  r.push({ n, esperado, real, ok: String(real) === String(esperado) });

const nav = await chromium.launch();
try {
  // --- ninguna página desborda, en ningún ancho ---------------------------
  for (const ancho of [375, 768, 1280]) {
    const p = await (await nav.newContext({ viewport: { width: ancho, height: 900 } })).newPage();
    const desbordan = [];
    for (const ruta of PAGINAS) {
      await p.goto(`${SITIO}${ruta}`, { waitUntil: "networkidle" });
      if (await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
        desbordan.push(ruta);
      }
    }
    caso(`a ${ancho}px ninguna página desborda a lo ancho`, "", desbordan.join(", "));
  }

  // --- el logo sobresale y no tapa ---------------------------------------
  const esc = await (await nav.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await esc.goto(`${SITIO}/ayuda`, { waitUntil: "networkidle" });

  const medidas = await esc.evaluate(() => {
    const logo = document.querySelector("header a img");
    const barra = document.querySelector("header");
    const titulo = document.querySelector("h1");
    return {
      logo: logo?.getBoundingClientRect().height ?? 0,
      barra: barra?.getBoundingClientRect().height ?? 0,
      logoAbajo: logo?.getBoundingClientRect().bottom ?? 0,
      barraAbajo: barra?.getBoundingClientRect().bottom ?? 0,
      tituloArriba: titulo?.getBoundingClientRect().top ?? 0,
    };
  });

  caso("el logo es más alto que la barra", true, medidas.logo > medidas.barra);
  caso("y sobresale por abajo", true, medidas.logoAbajo > medidas.barraAbajo);
  caso("sin tapar el título de la página", true, medidas.tituloArriba > medidas.logoAbajo);

  // --- los seis caminos y Mi Cuenta ---------------------------------------
  const html = await esc.content();
  const caminos = ["Calendario", "Nuestras Profes", "Packs de clases",
                   "Clases Especiales", "Nosotros", "Ayuda"];
  caso("la barra tiene los seis caminos", "6",
       String(caminos.filter((c) => html.includes(c)).length));
  caso("y Mi Cuenta", true, html.includes("Mi Cuenta"));
  caso("y ya no el CTA viejo ni Entrar", false,
       html.includes(">Reservar clase<") || html.includes(">Entrar<"));

  // --- móvil: el menú abre y se llega a todo ------------------------------
  const mov = await (await nav.newContext({ viewport: { width: 375, height: 812 } })).newPage();
  await mov.goto(`${SITIO}/`, { waitUntil: "networkidle" });
  caso("a 375px Mi Cuenta se ve sin abrir nada", true,
       await mov.getByRole("link", { name: "Mi Cuenta" }).isVisible());
  await mov.getByRole("button", { name: "Menú" }).click();
  await mov.waitForTimeout(400);
  // El pie también lleva los caminos, así que hay que acotar la búsqueda al
  // menú: sin eso, el selector encuentra dos y no distingue cuál se abrió.
  caso("el menú abre y muestra los seis", true,
       await mov.locator("#menu-movil").getByRole("link", { name: "Nuestras Profes" }).isVisible());

  // --- la portada quedó mínima --------------------------------------------
  await esc.goto(`${SITIO}/`, { waitUntil: "networkidle" });
  const portada = await esc.content();
  caso("la portada tiene el eslogan", true, portada.includes("baila sola"));
  caso("y los packs", true, portada.includes("Compras clases, no un mes"));
  caso("y ya no las profesoras", false, portada.includes("Las profes de XO"));
  caso("ni el formulario de captación", false, portada.includes("Déjanos tus datos"));

  // --- las anclas viejas rescatan ----------------------------------------
  // **Cada una en una pestaña nueva**, que es como llegan de verdad: desde un
  // enlace de Instagram. Reusar una pestaña que ya está en `/` solo cambiaría
  // el hash, sin recargar, y probaría otra cosa.
  for (const [ancla, destino] of [
    ["#planes", "/comprar"],
    ["#profesoras", "/nuestras-profes"],
    ["#sedes", "/nosotros"],
  ]) {
    const nueva = await (await nav.newContext()).newPage();
    await nueva.goto(`${SITIO}/${ancla}`, { waitUntil: "networkidle" });
    await nueva.waitForTimeout(1500);
    caso(`/${ancla} rescata a ${destino}`, destino, new URL(nueva.url()).pathname);
    await nueva.close();
  }

  // Y el caso de cambiar el hash estando ya en la portada, sin recargar.
  await esc.goto(`${SITIO}/`, { waitUntil: "networkidle" });
  await esc.evaluate(() => { window.location.hash = "#planes"; });
  await esc.waitForTimeout(1500);
  caso("estando ya en la portada, el hash también rescata", "/comprar",
       new URL(esc.url()).pathname);
} finally {
  await nav.close();
}

console.log("\nPRD-0022 — el sitio, mirado con un navegador\n");
console.log("| Caso | Esperado | Obtenido | |");
console.log("|---|---|---|---|");
for (const x of r) console.log(`| ${x.n} | ${x.esperado || "(ninguna)"} | ${x.real || "(ninguna)"} | ${x.ok ? "✓" : "✗"} |`);
const fallas = r.filter((x) => !x.ok).length;
console.log(`\n${r.length - fallas}/${r.length} como se esperaba.`);
process.exitCode = fallas ? 1 : 0;
