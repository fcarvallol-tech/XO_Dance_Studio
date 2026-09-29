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
  // Los ajustes 2 y 3 devolvieron dos bloques a la portada: los caminos en rosa
  // y las profesoras. La portada mínima de la fase 5 ya no es la que va.
  caso("y el bloque rosa de packs", true,
       portada.includes("Elige el pack que más te guste"));
  caso("y las profesoras", true, portada.includes("Quiénes te van a enseñar"));
  caso("y ya no el formulario de captación", false,
       portada.includes("Déjanos tus datos"));

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

  // --- ajuste 5: el calendario es una grilla con eje de tiempo ------------
  // Lo que no se ve leyendo el código: que la posición y el alto de cada clase
  // **sean** su hora y su duración. Se mide el bloque dibujado y se compara con
  // la hora que ese mismo bloque dice tener, contra el eje de la izquierda. Si
  // la grilla dibujara todo del mismo alto, o corriera media hora, esto lo caza.
  await esc.goto(`${SITIO}/calendario`, { waitUntil: "networkidle" });

  const grilla = await esc.evaluate(() => {
    const fila = 28; // 1.75rem
    // La grilla solo muestra los días que tienen clases: cuatro columnas una
    // semana y dos la siguiente. Eso es deliberado (ver GrillaCalendario).
    const encabezados = [...document.querySelectorAll("p.xo-eyebrow")]
      .map((p) => p.textContent?.trim() ?? "")
      .filter((t) => /^(lunes|martes|miércoles|jueves|viernes|sábado|domingo)$/i.test(t));

    const primeraHora = Number(
      document.body.textContent?.match(/(\d{2}):00/)?.[1] ?? -1,
    );

    const bloques = [];
    for (const a of document.querySelectorAll("a[style*='grid-row']")) {
      const m = a.getAttribute("style")?.match(/grid-row:\s*(\d+)\s*\/\s*span\s*(\d+)/);
      const hhmm = a.textContent?.match(/(\d{1,2}):(\d{2})/);
      if (!m || !hhmm) continue;
      const [, tramo, span] = m.map(Number);
      const caja = a.getBoundingClientRect();
      const columna = a.parentElement.getBoundingClientRect();
      bloques.push({
        // El alto dibujado contra los tramos que dice ocupar.
        altoOk: Math.abs(caja.height - span * fila) <= 1,
        // Y el borde de arriba contra el tramo en que dice empezar.
        arribaOk: Math.abs(caja.top - columna.top - (tramo - 1) * fila) <= 1,
        // Y la hora escrita contra la hora que le toca por su posición.
        horaOk:
          Number(hhmm[1]) * 60 + Number(hhmm[2]) ===
          primeraHora * 60 + (tramo - 1) * 30,
      });
    }
    return { dias: encabezados.length, bloques };
  });

  caso("el calendario dibuja una columna por día con clases", true, grilla.dias > 0);
  caso("hay clases dibujadas en la grilla", true, grilla.bloques.length > 0);
  caso("el alto de cada clase es su duración",
       String(grilla.bloques.length),
       String(grilla.bloques.filter((b) => b.altoOk).length));
  caso("y su posición es su hora de inicio",
       String(grilla.bloques.length),
       String(grilla.bloques.filter((b) => b.arribaOk).length));
  caso("y la hora escrita coincide con el eje (incluidas las y media)",
       String(grilla.bloques.length),
       String(grilla.bloques.filter((b) => b.horaOk).length));

  // --- ajuste 6: el buscador de profesoras --------------------------------
  await esc.goto(`${SITIO}/nuestras-profes`, { waitUntil: "networkidle" });
  caso("el título de profesoras es el nuevo", true,
       (await esc.locator("h1").textContent())?.includes(
         "Elige a cualquiera de nuestras excelentes profesoras",
       ));

  const tarjetas = esc.locator("ul li a h2");
  const todas = await tarjetas.count();
  caso("se ven todas las profesoras al entrar", true, todas > 1);

  // Buscar por nombre, sin tilde, en minúsculas: así escribe la gente.
  await esc.getByRole("searchbox", { name: /buscar/i }).fill("lina");
  await esc.waitForTimeout(200);
  caso('buscar "lina" deja una sola', "1", String(await tarjetas.count()));

  await esc.getByRole("searchbox", { name: /buscar/i }).fill("zzz");
  await esc.waitForTimeout(200);
  caso("un nombre que no existe no deja ninguna", "0", String(await tarjetas.count()));
  await esc.getByRole("button", { name: "Ver todas" }).click();
  await esc.waitForTimeout(200);
  caso('"Ver todas" devuelve el listado completo', String(todas),
       String(await tarjetas.count()));

  // El filtro por estilo: se toma el primer chip que no sea "Todos".
  const chips = esc.locator('button[aria-pressed]');
  const primerEstilo = (await chips.nth(1).textContent())?.trim() ?? "";
  await chips.nth(1).click();
  await esc.waitForTimeout(200);
  const filtradas = await tarjetas.count();
  caso(`filtrar por ${primerEstilo} deja menos que todas`, true,
       filtradas > 0 && filtradas < todas);
  await chips.first().click();
  await esc.waitForTimeout(200);
  caso('"Todos" vuelve a mostrarlas todas', String(todas),
       String(await tarjetas.count()));
} finally {
  await nav.close();
}

console.log("\nPRD-0022 — el sitio y sus ajustes, mirados con un navegador\n");
console.log("| Caso | Esperado | Obtenido | |");
console.log("|---|---|---|---|");
for (const x of r) console.log(`| ${x.n} | ${x.esperado || "(ninguna)"} | ${x.real || "(ninguna)"} | ${x.ok ? "✓" : "✗"} |`);
const fallas = r.filter((x) => !x.ok).length;
console.log(`\n${r.length - fallas}/${r.length} como se esperaba.`);
process.exitCode = fallas ? 1 : 0;
