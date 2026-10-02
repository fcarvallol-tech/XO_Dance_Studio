/**
 * PRD-0022: el sitio público, mirado con un navegador en todos sus quiebres.
 *
 * Lo que esto comprueba no se ve compilando: que el círculo del logo sobresalga
 * **sin tapar** el primer título de cada página, que el logo quepa dentro, que
 * a 375 px se pueda llegar a todos lados, y que ninguna página desborde a lo
 * ancho.
 *
 * **Los anchos son todos los quiebres de Tailwind y el píxel de antes de cada
 * uno**, más los extremos. Medía 375, 768 y 1280, y a 1024 la barra desbordaba
 * 142 px sin que nadie lo viera: el problema no fue el desborde, fue que ese
 * ancho no se medía. Un quiebre nuevo en el código es un ancho nuevo acá.
 *
 *   npm i --no-save playwright && npx playwright install chromium
 *   node scripts/verificar-sitio.mjs
 *   SITIO=http://localhost:3100 node scripts/verificar-sitio.mjs
 */
const S = process.env.SCRATCHPAD ?? process.cwd();
const pw = await import(`${S}/node_modules/playwright/index.js`);
const chromium = (pw.default ?? pw).chromium;

const SITIO = process.env.SITIO ?? "http://localhost:3000";
// sm 640 · md 768 · lg 1024 · xl 1280, cada uno con su píxel anterior.
const ANCHOS = [320, 375, 639, 640, 767, 768, 1023, 1024, 1279, 1280, 1440, 1920];
// Desde este ancho los seis caminos van en la barra; bajo él, el botón Menú.
const BARRA_COMPLETA = 1280;
// El círculo mínimo que contiene los píxeles de `logo-xo.png`, en fracciones
// del ancho y alto del logo. Medido del PNG; si el logo cambia, se remide.
const LOGO = { cx: 0.487, cy: 0.6, r: 0.52 };

const PAGINAS = [
  "/", "/calendario", "/nuestras-profes", "/comprar",
  "/clases-especiales", "/nosotros", "/ayuda", "/profesoras/carli",
];

const r = [];
const caso = (n, esperado, real) =>
  r.push({ n, esperado, real, ok: String(real) === String(esperado) });

const nav = await chromium.launch();
try {
  // --- en cada ancho: sin desborde, y el círculo del logo en su lugar ------
  for (const ancho of ANCHOS) {
    const p = await (await nav.newContext({ viewport: { width: ancho, height: 900 } })).newPage();
    const desbordan = [];
    const tapados = [];
    for (const ruta of PAGINAS) {
      await p.goto(`${SITIO}${ruta}`, { waitUntil: "networkidle" });
      const m = await p.evaluate(() => ({
        desborda: document.documentElement.scrollWidth > window.innerWidth,
        circuloAbajo: document.querySelector("[data-circulo-logo]")?.getBoundingClientRect().bottom ?? 0,
        tituloArriba: document.querySelector("main h1, main h2")?.getBoundingClientRect().top ?? 0,
      }));
      if (m.desborda) desbordan.push(ruta);
      if (!(m.tituloArriba > m.circuloAbajo)) tapados.push(ruta);
    }
    caso(`a ${ancho}px ninguna página desborda a lo ancho`, "", desbordan.join(", "));
    caso(`a ${ancho}px el círculo no tapa el primer título`, "", tapados.join(", "));

    await p.goto(`${SITIO}/`, { waitUntil: "networkidle" });
    const c = await p.evaluate(({ LOGO }) => {
      const circulo = document.querySelector("[data-circulo-logo]");
      const cr = circulo.getBoundingClientRect();
      const lr = document.querySelector("header a[aria-label] img").getBoundingClientRect();
      const barra = document.querySelector("header").getBoundingClientRect();
      const R = cr.width / 2;
      const dentro = Math.hypot(
        lr.left + LOGO.cx * lr.width - (cr.left + R),
        lr.top + LOGO.cy * lr.height - (cr.top + R),
      ) + LOGO.r * lr.width;
      // Lo que se puede apretar en la barra, fuera del logo, que se vea.
      const visibles = [...document.querySelectorAll("header a, header button")]
        .filter((e) => !e.matches("a[aria-label]") && !e.closest("#menu-movil"))
        .map((e) => e.getBoundingClientRect())
        .filter((x) => x.width > 1 && x.height > 1);
      const miCuenta = [...document.querySelectorAll("header a")].find((e) => e.textContent.trim() === "Mi Cuenta");
      const mc = miCuenta.getBoundingClientRect();
      return {
        redondo: Math.abs(cr.width - cr.height) < 0.5 &&
          getComputedStyle(circulo.firstElementChild).borderRadius !== "0px",
        aire: cr.left,
        sobresale: cr.bottom > barra.bottom,
        cabe: dentro <= R,
        choca: visibles.some((x) => x.left < cr.right && x.top < cr.bottom),
        miCuenta: mc.width > 0 && mc.left >= 0 && mc.right <= window.innerWidth,
        caminosEnBarra: [...document.querySelectorAll('header nav[aria-label="Secciones"]:not(#menu-movil) a')]
          .filter((e) => e.getBoundingClientRect().width > 0).length,
        menu: [...document.querySelectorAll("header button")].some((e) => e.textContent.trim() === "Menú" && e.getBoundingClientRect().width > 0),
      };
    }, { LOGO });
    caso(`a ${ancho}px el logo va en un círculo`, true, c.redondo);
    caso(`a ${ancho}px el círculo tiene aire con el borde (≥ 12 px)`, true, c.aire >= 12);
    caso(`a ${ancho}px el círculo sobresale de la barra`, true, c.sobresale);
    caso(`a ${ancho}px el logo cabe dentro del círculo`, true, c.cabe);
    caso(`a ${ancho}px nada de la barra se mete en el círculo`, false, c.choca);
    caso(`a ${ancho}px Mi Cuenta se ve entero`, true, c.miCuenta);
    caso(
      `a ${ancho}px ${ancho >= BARRA_COMPLETA ? "los seis caminos van en la barra" : "los caminos van en el menú"}`,
      ancho >= BARRA_COMPLETA ? "6 · sin Menú" : "0 · con Menú",
      `${c.caminosEnBarra} · ${c.menu ? "con" : "sin"} Menú`,
    );
    await p.close();
  }

  const esc = await (await nav.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await esc.goto(`${SITIO}/ayuda`, { waitUntil: "networkidle" });

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
  // `isVisible` no ve lo que queda debajo de otra cosa: el círculo del logo
  // cuelga justo sobre el primer camino. Se pregunta qué recibe el toque.
  caso("y el círculo no le tapa el primer camino", true, await mov.evaluate(() => {
    const a = document.querySelector("#menu-movil a");
    const r = a.getBoundingClientRect();
    return a.contains(document.elementFromPoint(r.left + 20, r.top + r.height / 2));
  }));
  caso("y el menú abierto no le corta el logo", true, await mov.evaluate(() => {
    const img = document.querySelector("header a[aria-label] img");
    const r = img.getBoundingClientRect();
    // El punto más bajo del logo que cae sobre el menú.
    return img.closest("a").contains(document.elementFromPoint(r.left + r.width * 0.75, r.bottom - 2));
  }));

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
    // Los siete días siempre, tengan clases o no (Felipe, 29/09/2026), y el
    // encabezado es solo el nombre: la fecha va una vez, junto a los botones.
    const celdas = [...document.querySelectorAll("p.xo-eyebrow")].filter((p) =>
      /^(lunes|martes|miércoles|jueves|viernes|sábado|domingo)/i.test(p.textContent?.trim() ?? ""),
    );
    const encabezados = celdas.map((p) => p.textContent?.trim() ?? "");
    // Las líneas verticales: cada columna de día tiene su borde derecho.
    const conLinea = celdas.filter(
      (p) => parseFloat(getComputedStyle(p.parentElement).borderRightWidth) > 0,
    ).length;

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
    return { encabezados, conLinea, bloques };
  });

  caso("el calendario muestra los siete días, de lunes a domingo",
       "lunes martes miércoles jueves viernes sábado domingo",
       grilla.encabezados.join(" ").toLowerCase());
  caso("ningún encabezado lleva el número de la fecha", 0,
       grilla.encabezados.filter((t) => /\d/.test(t)).length);
  caso("hay una línea vertical entre cada día", 7, grilla.conLinea);
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

  // La navegación no se salta semanas: cada "Después" avanza exactamente siete
  // días, aunque la semana del medio no tenga clases. Se lee el rango impreso,
  // que es lo que ve la persona, y no el estado del componente.
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
    "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const inicioDelRango = async () => {
    const t = (await esc.locator("p", { hasText: /^Del \d/ }).first().textContent()) ?? "";
    const m = t.match(/Del (\d+)(?: de (\p{L}+))? al (\d+) de (\p{L}+)/u);
    if (!m) return null;
    const mes = MESES.indexOf(m[2] ?? m[4]);
    return Date.UTC(2026, mes, Number(m[1]));
  };
  const saltos = [];
  let previo = await inicioDelRango();
  caso("el rango de la semana se ve junto a los botones", true, previo !== null);
  const despues = esc.getByRole("button", { name: /Después/ });
  // Con tope: si la página no hidrata, el botón nunca se desactiva y el bucle
  // no terminaría. Un rango que no cambia al apretar cuenta como salto de 0.
  while (previo !== null && saltos.length < 20 && (await despues.isEnabled())) {
    await despues.click();
    await esc.waitForTimeout(150);
    const actual = await inicioDelRango();
    saltos.push(actual === null ? NaN : (actual - previo) / 86400000);
    previo = actual;
    if (saltos.at(-1) !== 7) break;
  }
  caso('cada "Después" avanza siete días, sin saltarse semanas',
       saltos.map(() => 7).join(","), saltos.join(","));

  // --- ajuste 5 en el teléfono: un día a la vez -----------------------------
  const tel = await (await nav.newContext({ viewport: { width: 375, height: 800 } })).newPage();
  await tel.goto(`${SITIO}/calendario`, { waitUntil: "networkidle" });
  const visibles = () =>
    tel.evaluate(() =>
      [...document.querySelectorAll("p.xo-eyebrow")]
        .filter((p) => /^(lunes|martes|miércoles|jueves|viernes|sábado|domingo)$/i
          .test(p.textContent?.trim() ?? ""))
        .filter((p) => p.offsetParent !== null)
        .map((p) => p.textContent?.trim().toLowerCase()),
    );
  const botonesDia = tel.getByRole("group", { name: "Día" }).getByRole("button");
  caso("a 375px hay siete botones de día", 7, await botonesDia.count());
  const alAbrir = await visibles();
  caso("a 375px se ve una sola columna", 1, alAbrir.length);
  const activo = await tel.getByRole("group", { name: "Día" })
    .locator('button[aria-pressed="true"]').getAttribute("aria-label");
  caso("y es la del botón marcado", activo, alAbrir[0]);
  // Se toca otro día y la columna cambia a ese.
  const otro = alAbrir[0] === "domingo" ? "lunes" : "domingo";
  await tel.getByRole("button", { name: otro, exact: true }).click();
  await tel.waitForTimeout(150);
  caso(`tocar "${otro}" muestra esa columna`, otro, (await visibles()).join(","));

  // Los lugares se ven en todos los bloques, incluidas las clases de una hora,
  // y en los tres anchos. Se mide si el texto queda dentro de la caja: con
  // `overflow: hidden` un texto cortado sigue estando en el DOM, así que
  // buscarlo por su contenido no probaría nada.
  for (const ancho of [375, 768, 1023, 1024, 1280]) {
    const p = await (await nav.newContext({ viewport: { width: ancho, height: 900 } })).newPage();
    await p.goto(`${SITIO}/calendario`, { waitUntil: "networkidle" });
    const cortados = await p.evaluate(() => {
      const malos = [];
      for (const a of document.querySelectorAll("a[style*='grid-row']")) {
        if (a.offsetParent === null) continue; // otro día, en el teléfono
        const caja = a.getBoundingClientRect();
        const lugares = [...a.querySelectorAll("span")].find((s) =>
          /^(\d+ lugar(es)?|Llena)$/.test(s.textContent?.trim() ?? ""));
        const r = lugares?.getBoundingClientRect();
        if (!r || r.bottom > caja.bottom - 1 || r.right > caja.right - 1) {
          malos.push(a.querySelector("p")?.textContent?.trim() ?? "?");
        }
      }
      return malos;
    });
    caso(`a ${ancho}px cada clase muestra sus lugares sin cortarlos`, "", cortados.join(", "));
  }

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
