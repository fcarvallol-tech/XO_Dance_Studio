/**
 * PRD-0023: regalar créditos, verificado contra STAGING.
 *
 * Dos partes:
 *
 * 1. **Permisos, preguntados a la base con la sesión de cada rol** —alumna,
 *    admin, owner y anónimo—, no leídos de las políticas (CLAUDE.md). Dentro de
 *    una transacción que se revierte. Se comprueba lo que cada uno puede hacer y
 *    también lo que **no**: que nadie con sesión llame a `regalar_creditos`
 *    directo, que la alumna no lea el motivo, que solo admin vea los regalos.
 *
 * 2. **El camino con navegador**: admin regala desde Personas a una alumna sin
 *    saldo; se miran el lote, el movimiento, el autor, el vencimiento, el correo
 *    y que un segundo regalo idéntico se rechace; la alumna lo ve sin el motivo
 *    y reserva con él. Las métricas se miden **antes y después**: ingresos,
 *    compras y créditos vendidos no pueden moverse.
 *
 * Deja un regalo en staging por corrida, con un motivo que lleva la hora.
 *
 *   SITIO=http://localhost:3400 node scripts/verificar-regalos.mjs
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { conectar } from "./staging.mjs";

const SITIO = process.env.SITIO ?? "http://localhost:3000";
const CAPTURAS = process.env.CAPTURAS ?? null;
const ADMIN = "admin@ejemplo.invalid";
const OWNER = "owner@ejemplo.invalid";
const OTRA_ALUMNA = "ana@ejemplo.invalid";
// Una alumna **nueva en cada corrida**, sin saldo: así la reserva tiene que
// salir del lote regalado, y el verificador no le cambia el saldo a una alumna
// que otro verificador usa como "sin créditos".
const DESTINO = `alumna.regalo.${Date.now()}@example.com`;
const MOTIVO = `Verificador PRD-0023 ${new Date().toISOString().slice(0, 16)}`;
const CANTIDAD = 3;

const env = Object.fromEntries(
  readFileSync(".env.staging", "utf8").split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const r = [];
const caso = (n, esperado, real) => r.push({ n, esperado, real, ok: String(real) === String(esperado) });

const sql = async (texto, p = []) => {
  const db = await conectar();
  try {
    return (await db.query(texto, p)).rows;
  } finally {
    await db.end().catch(() => {});
  }
};

/**
 * Corre `texto` con la sesión de un usuario (o como anon si `userId` es null),
 * en una transacción que se revierte. Devuelve las filas o `error <código>`.
 */
async function comoUsuario(userId, texto, p = []) {
  const db = await conectar();
  try {
    await db.query("begin");
    if (userId) {
      await db.query(
        `select set_config('request.jwt.claims',
           json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)`,
        [userId],
      );
      await db.query("set local role authenticated");
    } else {
      await db.query("set local role anon");
    }
    return (await db.query(texto, p)).rows;
  } catch (e) {
    return `error ${e.code}`;
  } finally {
    await db.query("rollback").catch(() => {});
    await db.end().catch(() => {});
  }
}

const perfilDe = async (email) => (await sql("select id, user_id from perfiles where email = $1", [email]))[0];

/** El resumen de métricas del mes, con la sesión de owner. */
async function metricas(ownerUid) {
  const filas = await comoUsuario(
    ownerUid,
    `select metricas_resumen(date_trunc('month', now()), date_trunc('month', now()) + interval '1 month',
       date_trunc('month', now()) - interval '1 month', date_trunc('month', now())) as m`,
  );
  if (typeof filas === "string") throw new Error(`metricas_resumen como owner: ${filas}`);
  return filas[0].m;
}

const saldoDe = async (perfilId) =>
  (await sql(
    "select coalesce(sum(cantidad_disponible),0)::int as s from creditos where perfil_id = $1 and fecha_vencimiento > now()",
    [perfilId],
  ))[0].s;

if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });
const nav = await chromium.launch();

async function sesion(email, volver, ancho = 1280) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  await p.goto(
    `${SITIO}/auth/confirmar?token_hash=${data.properties.hashed_token}&type=email&volver=${encodeURIComponent(volver)}`,
    { waitUntil: "networkidle" },
  );
  return p;
}

/** Crea la alumna destino como lo hace el registro: usuario y perfil completo. */
async function crearDestino() {
  const { error } = await supabase.auth.admin.createUser({ email: DESTINO, email_confirm: true });
  if (error) throw error;
  for (let i = 0; i < 20; i++) {
    if (await perfilDe(DESTINO)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  await sql(
    `update perfiles set nombre = 'Alumna Regalo', telefono = '12345678', perfil_completo_at = now()
     where email = $1`, [DESTINO]);
}

try {
  await crearDestino();
  const [admin, owner, otra, destino] = await Promise.all([
    perfilDe(ADMIN), perfilDe(OWNER), perfilDe(OTRA_ALUMNA), perfilDe(DESTINO),
  ]);
  if (!destino) throw new Error(`No se creó el perfil de ${DESTINO}`);

  // --- 1. Permisos, con la sesión de cada rol -------------------------------
  const llamar = `select (regalar_creditos($1::uuid, 1, 'intento directo', $2::uuid)).id`;
  caso("alumna: no puede llamar a regalar_creditos directo", "error 42501",
    await comoUsuario(otra.user_id, llamar, [otra.id, otra.user_id]));
  caso("admin: tampoco directo con su sesión (solo por el servidor)", "error 42501",
    await comoUsuario(admin.user_id, llamar, [destino.id, admin.user_id]));
  caso("anónimo: tampoco", "error 42501", await comoUsuario(null, llamar, [destino.id, admin.user_id]));

  caso("alumna: no puede leer el motivo de sus movimientos", "error 42501",
    await comoUsuario(otra.user_id, "select motivo from movimientos_credito limit 1"));
  const ajenos = await comoUsuario(otra.user_id,
    "select count(*)::int as n from movimientos_credito where perfil_id <> $1", [otra.id]);
  caso("alumna: lee sus movimientos y ninguno ajeno", 0, typeof ajenos === "string" ? ajenos : ajenos[0].n);
  caso("alumna: no ve la lista de regalos", "error 42501",
    await comoUsuario(otra.user_id, "select * from regalos_recientes(5)"));
  caso("anónimo: no ve la lista de regalos", "error 42501",
    await comoUsuario(null, "select * from regalos_recientes(5)"));
  const deAdmin = await comoUsuario(admin.user_id, "select count(*)::int as n from regalos_recientes(5)");
  caso("admin: ve la lista de regalos", true, typeof deAdmin !== "string");
  const deOwner = await comoUsuario(owner.user_id, "select count(*)::int as n from regalos_recientes(5)");
  caso("owner: también, por jerarquía", true, typeof deOwner !== "string");
  const lotesAjenos = await comoUsuario(admin.user_id,
    "select count(*)::int as n from creditos where perfil_id <> $1", [admin.id]);
  caso("admin: lee los lotes de todas (para el saldo de Personas)", true,
    typeof lotesAjenos !== "string" && lotesAjenos[0].n > 0);
  const lotesAjenosAlumna = await comoUsuario(otra.user_id,
    "select count(*)::int as n from creditos where perfil_id <> $1", [otra.id]);
  caso("alumna: no lee lotes ajenos", 0, typeof lotesAjenosAlumna === "string" ? lotesAjenosAlumna : lotesAjenosAlumna[0].n);

  // --- 2. Antes ----------------------------------------------------------------
  const antes = await metricas(owner.user_id);
  const saldoAntes = await saldoDe(destino.id);

  // --- 3. Admin regala desde Personas ------------------------------------------
  const pAdmin = await sesion(ADMIN, "/admin");
  const fila = pAdmin.locator("tr", { hasText: DESTINO });
  await fila.getByRole("button", { name: "Regalar" }).click();
  const dialogo = pAdmin.getByRole("dialog");
  await dialogo.waitFor();
  const boton = dialogo.getByRole("button", { name: /^Regalar \d+ clases?$/ });
  caso("sin motivo, el botón de regalar no se activa", true, await boton.isDisabled());
  await dialogo.getByLabel(/Cuántas clases/).fill(String(CANTIDAD));
  await dialogo.getByLabel(/Por qué/).fill(MOTIVO);
  caso("el botón dice la cantidad", `Regalar ${CANTIDAD} clases`, (await boton.innerText()).trim().replace(/^REGALAR/, "Regalar").replace("CLASES", "clases"));
  if (CAPTURAS) await pAdmin.screenshot({ path: `${CAPTURAS}/admin-dialogo-1280.png` });
  await boton.click();
  await pAdmin.getByText(/^Regalaste \d+ clases?\./).waitFor({ timeout: 15000 });
  caso("al regalar, dice cuántas tiene ahora", true,
    (await pAdmin.getByText(/^Regalaste/).innerText()).includes(`Ahora tiene ${saldoAntes + CANTIDAD}`));

  // La vigencia se lee del parámetro, no se supone: pasó de 60 a 45 días el
  // 05/10/2026, y un verificador con el número fijo da por malo lo correcto.
  const [{ dias }] = await sql("select valor::int as dias from parametros where clave = 'regalo_vigencia_dias'");
  const [lote] = await sql(
    `select c.id, c.compra_id, c.cantidad_inicial, c.cantidad_disponible,
            abs(extract(epoch from (c.fecha_vencimiento - (now() + make_interval(days => $2))))) < 600 as vence_bien
     from creditos c where c.perfil_id = $1 order by c.created_at desc limit 1`, [destino.id, dias]);
  caso("crea un lote sin compra, de la cantidad pedida", `null · ${CANTIDAD} · ${CANTIDAD}`,
    `${lote.compra_id} · ${lote.cantidad_inicial} · ${lote.cantidad_disponible}`);
  caso(`que vence a los ${dias} días, como un pack`, true, lote.vence_bien);
  const [mov] = await sql(
    "select tipo, cantidad, saldo_resultante, motivo, creado_por from movimientos_credito where credito_id = $1", [lote.id]);
  caso("el movimiento es regalo, con su cantidad y el saldo resultante",
    `regalo · ${CANTIDAD} · ${saldoAntes + CANTIDAD}`, `${mov.tipo} · ${mov.cantidad} · ${mov.saldo_resultante}`);
  caso("con el motivo y quien lo hizo", `${MOTIVO} · ${admin.id}`, `${mov.motivo} · ${mov.creado_por}`);
  const envios = await sql("select plantilla, estado from envios_correo where clave_idempotencia = $1", [`regalo:${lote.id}`]);
  caso("el aviso a la alumna queda en la cola", "regalo", envios.map((e) => e.plantilla).join(","));

  // Un segundo regalo idéntico: el formulario se puede reenviar sin el botón.
  await pAdmin.reload({ waitUntil: "networkidle" });
  await fila.getByRole("button", { name: "Regalar" }).click();
  await dialogo.getByLabel(/Cuántas clases/).fill(String(CANTIDAD));
  await dialogo.getByLabel(/Por qué/).fill(MOTIVO);
  await boton.click();
  await dialogo.getByRole("alert").waitFor({ timeout: 15000 });
  caso("un regalo idéntico enseguida se rechaza", true,
    (await dialogo.getByRole("alert").innerText()).includes("Ya regalaste esto"));
  caso("y no crea un segundo lote", saldoAntes + CANTIDAD, await saldoDe(destino.id));
  await dialogo.getByRole("button", { name: "Volver" }).click();

  const lista = await pAdmin.locator("[data-regalos] li").first().innerText();
  caso("aparece primero en Regalos recientes, con motivo y autor", true,
    lista.includes(MOTIVO) && lista.includes("Admin de Prueba"));
  if (CAPTURAS) await pAdmin.screenshot({ path: `${CAPTURAS}/admin-personas-1280.png`, fullPage: true });

  // --- 4. Después: no es venta ---------------------------------------------------
  const despues = await metricas(owner.user_id);
  caso("ingresos del mes: no cambian", antes.venta.ingresos_clp, despues.venta.ingresos_clp);
  caso("compras del mes: no cambian", antes.venta.compras, despues.venta.compras);
  caso("créditos vendidos del mes: no cambian", antes.creditos.vendidas, despues.creditos.vendidas);
  caso("ingresos históricos: no cambian", antes.desde_siempre.ingresos_clp, despues.desde_siempre.ingresos_clp);
  caso(`regaladas del mes: suben ${CANTIDAD}`, antes.creditos.regaladas + CANTIDAD, despues.creditos.regaladas);
  caso("pasivo vendido: no cambia", antes.creditos.vigentes_vendidas, despues.creditos.vigentes_vendidas);
  caso(`pasivo regalado: sube ${CANTIDAD}`, antes.creditos.vigentes_regaladas + CANTIDAD, despues.creditos.vigentes_regaladas);
  caso("vendidas + regaladas = pasivo total medido", despues.creditos.disponibles - despues.creditos.vencidas_sin_usar,
    despues.creditos.vigentes_vendidas + despues.creditos.vigentes_regaladas);
  caso("el libro sigue conciliando con los lotes", despues.conciliacion.lotes, despues.conciliacion.libro);

  // --- 5. La alumna --------------------------------------------------------------
  const pAlumna = await sesion(DESTINO, "/mis-clases", 390);
  const misRegalos = await pAlumna.locator("[data-mis-regalos]").innerText();
  caso("la alumna ve sus clases de regalo", true, misRegalos.includes(`${CANTIDAD} clases de regalo`));
  caso("y no ve el motivo, en ninguna parte de la página", false, (await pAlumna.content()).includes(MOTIVO));
  if (CAPTURAS) await pAlumna.screenshot({ path: `${CAPTURAS}/alumna-mis-reservas-390.png`, fullPage: true });

  await pAlumna.goto(`${SITIO}/reservar`, { waitUntil: "networkidle" });
  const reservable = pAlumna.locator("main [data-estado='reservable']").filter({ visible: true });
  for (let i = 0; i < 9 && (await reservable.count()) === 0; i++) {
    await pAlumna.getByRole("button", { name: /Después/ }).click();
    await pAlumna.waitForTimeout(150);
  }
  await reservable.first().click();
  await pAlumna.getByRole("dialog").getByRole("button", { name: "Reservar esta clase" }).click();
  await pAlumna.waitForTimeout(3000);
  const [usado] = await sql("select cantidad_disponible from creditos where id = $1", [lote.id]);
  caso("reserva con el crédito regalado y se descuenta del lote", CANTIDAD - 1, usado.cantidad_disponible);
  // Se deshace la reserva, para no dejar un cupo tomado en staging.
  await pAlumna.goto(`${SITIO}/mis-clases`, { waitUntil: "networkidle" });
  await pAlumna.getByRole("button", { name: "Cancelar" }).first().click();
  await pAlumna.waitForTimeout(3000);
  const [devuelto] = await sql("select cantidad_disponible from creditos where id = $1", [lote.id]);
  caso("y al cancelar vuelve al mismo lote", CANTIDAD, devuelto.cantidad_disponible);

  // --- 6. El tablero de owner muestra el pasivo partido -------------------------
  const pOwner = await sesion(OWNER, "/owner/metricas");
  const tablero = await pOwner.locator("main").innerText();
  caso("el tablero muestra vendidas y regaladas sin usar, por separado", true,
    /VENDIDAS SIN USAR/i.test(tablero) && /REGALADAS SIN USAR/i.test(tablero));
  if (CAPTURAS) await pOwner.screenshot({ path: `${CAPTURAS}/owner-metricas-1280.png`, fullPage: true });

  // --- 7. El diálogo en el teléfono -----------------------------------------------
  const pTel = await sesion(ADMIN, "/admin", 375);
  await pTel.locator("tr", { hasText: DESTINO }).getByRole("button", { name: "Regalar" }).click();
  const dTel = pTel.getByRole("dialog");
  await dTel.waitFor();
  const cabe = await dTel.evaluate((d) => {
    const r = d.getBoundingClientRect();
    return r.left >= 0 && r.right <= window.innerWidth;
  });
  caso("a 375 px el diálogo cabe en la pantalla", true, cabe);
  if (CAPTURAS) await pTel.screenshot({ path: `${CAPTURAS}/admin-dialogo-375.png` });
} catch (e) {
  console.error("\nSE CORTÓ:", e.message);
  r.push({ n: `se cortó: ${e.message.split("\n")[0]}`, esperado: "", real: "", ok: false });
} finally {
  await nav.close();
}

console.log("\nPRD-0023 — regalar créditos\n");
console.log("| Caso | Esperado | Obtenido | |");
console.log("|---|---|---|---|");
for (const x of r) console.log(`| ${x.n} | ${x.esperado} | ${x.real} | ${x.ok ? "✓" : "✗"} |`);
const fallas = r.filter((x) => !x.ok).length;
console.log(`\n${r.length - fallas}/${r.length} como se esperaba.`);
process.exitCode = fallas ? 1 : 0;
