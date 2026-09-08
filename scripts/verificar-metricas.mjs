/**
 * Contrasta las funciones de métricas contra los 22 valores esperados de
 * PRD-0010 §11.4, que se calcularon a mano ANTES de que existiera el código.
 *
 * Las llama con `set local role authenticated` y las claims del owner, así que
 * corren con RLS puesto y con los grants reales, no como superusuario. La
 * prueba con sesión de verdad por HTTP es la fase 5; esta es la capa de datos.
 *
 * Las cifras derivadas —tasas, promedios, variaciones, atribución— NO se
 * recalculan acá: se piden a `lib/dominio/metricas.ts`, que es el mismo código
 * que va a usar la página. Reimplementarlas en el verificador probaría que dos
 * copias coinciden, no que la que se usa está bien.
 */
import { conectar } from "./staging.mjs";
import {
  atribuir,
  brecha,
  comparar,
  conciliacion,
  ocupacionPromedio,
  planesMasVendidos,
  tasa,
  ticketPromedio,
} from "../lib/dominio/metricas.ts";
import { mesAnterior, mesEnCurso, nombreDelMes } from "../lib/dominio/periodo.ts";

const OWNER = "11111111-1111-4111-8111-000000000009";
const ADMIN = "11111111-1111-4111-8111-000000000008";

const cliente = await conectar();
const q = (sql, params) => cliente.query(sql, params);

async function comoUsuario(userId, sql, params) {
  await q("begin");
  try {
    await q(
      `select set_config('request.jwt.claims',
                json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)`,
      [userId],
    );
    await q("set local role authenticated");
    const { rows } = await q(sql, params);
    return rows;
  } finally {
    await q("rollback").catch(() => {});
  }
}

const pct = (t) => (t === null ? null : Math.round(t * 1000) / 10);

// El mismo período que pide la página, con el mismo código: si el verificador
// usara una ventana propia, los números que confirma no serían los que alguien
// va a ver en pantalla. El período anterior se pasa explícito porque el SQL ya
// no lo deduce del largo del actual — los meses no duran todos lo mismo.
const periodo = mesEnCurso();
const anterior = mesAnterior(periodo);
const { desde, hasta } = periodo;
const { desde: desdeAnt, hasta: hastaAnt } = anterior;
console.log(`\nPeríodo: ${nombreDelMes(periodo)} · contra ${nombreDelMes(anterior)}`);

const [{ metricas_resumen: R }] = await comoUsuario(
  OWNER,
  `select public.metricas_resumen($1, $2, $3, $4)`,
  [desde.toISOString(), hasta.toISOString(), desdeAnt.toISOString(), hastaAnt.toISOString()],
);
const [{ metricas_demanda: D }] = await comoUsuario(
  OWNER,
  `select public.metricas_demanda($1, $2)`,
  [desde.toISOString(), hasta.toISOString()],
);

// --- Derivaciones, con el código que usará la página -------------------------
const varIngresos = comparar(
  Number(R.venta.ingresos_clp),
  Number(R.venta_anterior.ingresos_clp),
);
const b = brecha({
  otorgadas: R.creditos.otorgadas_historico,
  consumidas: R.creditos.consumidas_historico,
  disponibles: R.creditos.disponibles,
  vencidas: R.creditos.vencidas_sin_usar,
});
const conc = conciliacion(R.conciliacion.libro, R.conciliacion.lotes);
const top = planesMasVendidos(
  R.venta.por_plan.map((p) => ({ slug: p.slug, nombre: p.nombre, compras: p.compras })),
);
const ocup = ocupacionPromedio(
  D.por_clase.filter((c) => c.dictada).map((c) => ({ reservas: c.reservas, cupo: c.cupo })),
);
const atrib = atribuir(
  D.por_profesora.flatMap((p) =>
    p.atribucion.map((a) => ({
      montoCompraClp: a.monto_compra_clp,
      clasesCompra: a.clases_compra,
      recuperoCredito: a.recupero_credito,
      claseYaOcurrio: a.clase_ya_ocurrio,
      n: a.n,
    })),
  ),
);

const casos = [
  ["Ingresos del período", 112500, Number(R.venta.ingresos_clp)],
  ["Compras pagadas", 4, R.venta.compras],
  ["Ticket promedio", 28125, ticketPromedio(Number(R.venta.ingresos_clp), R.venta.compras)],
  ["Plan más vendido", "pack-4 · 2 de 4", `${top.map((p) => p.slug).join("+")} · ${top[0]?.compras} de ${R.venta.compras}`],
  ["Ingresos período anterior", 44000, Number(R.venta_anterior.ingresos_clp)],
  ["Variación absoluta", 68500, varIngresos.absoluta],
  ["Variación relativa", 155.7, pct(varIngresos.relativa)],
  ["Clases vendidas (período)", 17, R.creditos.vendidas],
  ["Clases regaladas (período)", 2, R.creditos.regaladas],
  ["Clases consumidas (neto)", 7, R.creditos.consumidas],
  ["Vencidas sin usar", 2, R.creditos.vencidas_sin_usar],
  ["Brecha / pasivo vigente", 18, b.pasivoVigente],
  ["Por vencer en 30 días", 1, R.creditos.por_vencer_30d],
  ["Utilización acumulada", "25.9% · 7 de 27", `${pct(b.utilizacion)}% · ${b.consumidas} de ${b.otorgadas}`],
  ["Conciliación libro == lotes", "20 == 20 · cuadra", `${conc.libro} == ${conc.lotes} · ${conc.cuadra ? "cuadra" : "NO CUADRA"}`],
  ["Ocupación promedio dictadas", "7.6% · 5 de 66", `${pct(ocup.tasa)}% · ${ocup.reservas} de ${ocup.cupos}`],
  ["Ingreso atribuido — dictado", 37500, atrib.dictado],
  ["Ingreso atribuido — comprometido", 7000, atrib.comprometido],
  ["Cancelaciones", 3, R.operacion.cancelaciones],
  ["  · con devolución", 2, R.operacion.con_devolucion],
  ["  · sin devolución", 1, R.operacion.sin_devolucion],
  ["Alumnas activas", "4 de 5", `${R.alumnas.activas} de ${R.alumnas.cuentas}`],
  ["Tasa de recompra", "50% · 2 de 4", `${pct(tasa(R.alumnas.con_recompra, R.alumnas.con_compra))}% · ${R.alumnas.con_recompra} de ${R.alumnas.con_compra}`],
  ["En riesgo", 1, R.alumnas.en_riesgo],
  ["Embudo", "5 → 4 → 3 → 2", `${R.alumnas.cuentas} → ${R.alumnas.con_compra} → ${R.alumnas.con_reserva} → ${R.alumnas.con_recompra}`],
];

const ancho = Math.max(...casos.map((c) => c[0].length));
let fallas = 0;
console.log("");
console.log(`${"INDICADOR".padEnd(ancho)}  ${"ESPERADO".padStart(17)}  ${"OBTENIDO".padStart(17)}   `);
console.log("─".repeat(ancho + 42));
for (const [nombre, esperado, obtenido] of casos) {
  const ok = String(esperado) === String(obtenido);
  if (!ok) fallas++;
  console.log(
    `${nombre.padEnd(ancho)}  ${String(esperado).padStart(17)}  ${String(obtenido).padStart(17)}  ${ok ? "✓" : "✗"}`,
  );
}
console.log("─".repeat(ancho + 42));
console.log(`${casos.length - fallas} de ${casos.length} coinciden.`);

// --- Control de acceso -------------------------------------------------------
console.log("\nControl de acceso:");
for (const [quien, id] of [["admin", ADMIN], ["owner", OWNER]]) {
  try {
    await comoUsuario(id, `select public.metricas_resumen($1, $2, $3, $4)`, [
      desde.toISOString(), hasta.toISOString(),
      desdeAnt.toISOString(), hastaAnt.toISOString(),
    ]);
    console.log(`  ${quien.padEnd(6)} → pasa${quien === "admin" ? "  ✗ NO DEBERÍA" : "  ✓"}`);
  } catch (e) {
    const ok = quien === "admin" && e.code === "42501";
    console.log(`  ${quien.padEnd(6)} → ${e.code} ${e.message}  ${ok ? "✓" : "✗"}`);
    if (!ok) fallas++;
  }
}
try {
  await q("begin");
  await q("set local role anon");
  await q(`select public.metricas_resumen($1, $2, $3, $4)`, [
    desde.toISOString(), hasta.toISOString(),
    desdeAnt.toISOString(), hastaAnt.toISOString(),
  ]);
  console.log("  anon   → pasa  ✗ NO DEBERÍA");
  fallas++;
} catch (e) {
  console.log(`  anon   → ${e.code} ${e.message.slice(0, 60)}  ${e.code === "42501" ? "✓" : "✗"}`);
} finally {
  await q("rollback").catch(() => {});
}

// --- El período anterior es el que se manda, no uno deducido -----------------
// Este caso habría cazado el defecto que arregló la migración 20260908120000:
// con un mes de 30 días, deducir "el mismo largo pegado antes" daba el 2 de
// agosto en vez del 1.
{
  const sep = { desde: "2026-09-01T03:00:00Z", hasta: "2026-10-01T03:00:00Z" };
  const ago = { desde: "2026-08-01T04:00:00Z", hasta: "2026-09-01T03:00:00Z" };
  const [{ metricas_resumen: M }] = await comoUsuario(
    OWNER,
    `select public.metricas_resumen($1, $2, $3, $4)`,
    [sep.desde, sep.hasta, ago.desde, ago.hasta],
  );
  const devuelto = new Date(M.meta.desde_anterior).toISOString();
  const ok = devuelto === new Date(ago.desde).toISOString();
  console.log("\nPeríodo anterior:");
  console.log(`  mandado  ${new Date(ago.desde).toISOString()}`);
  console.log(`  usado    ${devuelto}  ${ok ? "✓" : "✗ lo dedujo por su cuenta"}`);
  if (!ok) fallas++;
}

await cliente.end();
process.exitCode = fallas ? 1 : 0;
