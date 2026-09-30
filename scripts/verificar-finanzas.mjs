/**
 * Contrasta `metricas_finanzas` y las funciones de egresos contra el juez de
 * la fase 0.2 del plan de PRD-0010 parte 2, calculado a mano ANTES del código.
 *
 * Igual que `verificar-metricas.mjs`: las funciones se llaman con `set local
 * role authenticated` y las claims del owner, así que corren con los grants
 * reales; lo derivado —caja, horas, costo, margen— se pide a
 * `lib/dominio/finanzas.ts`, que es el mismo código que usa la página.
 *
 * Además pregunta lo que no se puede leer en una política: cuántas filas de
 * `egresos` ve un admin (cero), qué pasa cuando falta un costo (null, no cero)
 * y qué rechaza `registrar_egreso`. Todo lo que escribe va dentro de una
 * transacción que se revierte.
 */
import { CL, EG, conectar } from "./staging.mjs";
import {
  cajaNeta,
  compararCaja,
  horasDeClase,
  margenClase,
  porCategoria,
  resumenMargen,
} from "../lib/dominio/finanzas.ts";
import { mesAnterior, mesEnCurso, nombreDelMes } from "../lib/dominio/periodo.ts";

const OWNER = "11111111-1111-4111-8111-000000000009";
const ADMIN = "11111111-1111-4111-8111-000000000008";

const cliente = await conectar();
const q = (sql, params) => cliente.query(sql, params);

let fallas = 0;
function fila(nombre, obtenido, esperado, nota = "") {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallas++;
  const e = JSON.stringify(esperado);
  const o = JSON.stringify(obtenido);
  console.log(`  ${ok ? "✓" : "✗"} ${nombre.padEnd(44)} ${o}${ok ? "" : `  (esperado ${e})`}${nota ? `  ${nota}` : ""}`);
}

/** Corre `sql` como esa persona, dentro de una transacción que se revierte. */
async function comoUsuario(userId, sql, params, antes = null) {
  await q("begin");
  try {
    if (antes) await q(antes.sql, antes.params);
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

/** Corre `sql` como la service role, que es como lo llama la Server Action. */
async function comoServicio(sql, params) {
  await q("begin");
  try {
    await q("set local role service_role");
    const { rows } = await q(sql, params);
    return rows;
  } finally {
    await q("rollback").catch(() => {});
  }
}

/** Espera que falle con ese código. Devuelve true si falló como se esperaba. */
async function debeFallar(nombre, codigo, fn) {
  try {
    await fn();
    fila(nombre, "pasó", `error ${codigo}`);
  } catch (e) {
    fila(nombre, e.code, codigo, e.message.slice(0, 50));
  }
}

const periodo = mesEnCurso();
const anterior = mesAnterior(periodo);
const P = [
  periodo.desde.toISOString(), periodo.hasta.toISOString(),
  anterior.desde.toISOString(), anterior.hasta.toISOString(),
];
console.log(`\nPeríodo: ${nombreDelMes(periodo)} · contra ${nombreDelMes(anterior)}`);

const [{ metricas_resumen: R }] = await comoUsuario(
  OWNER, `select public.metricas_resumen($1, $2, $3, $4)`, P,
);
const [{ metricas_finanzas: F }] = await comoUsuario(
  OWNER, `select public.metricas_finanzas($1, $2, $3, $4)`, P,
);

// --- Egresos -----------------------------------------------------------------
console.log("\nEgresos:");
fila("del mes", [Number(F.egresos.total_clp), F.egresos.n], [103_000, 3]);
fila(
  "por categoría",
  porCategoria(F.egresos.lista.map((e) => ({ categoria: e.categoria, montoClp: e.monto_clp }))),
  [
    { categoria: "arriendo_sala", montoClp: 68_000 },
    { categoria: "marketing", montoClp: 20_000 },
    { categoria: "insumos", montoClp: 15_000 },
  ],
);
fila("del mes anterior", [Number(F.egresos_anterior.total_clp), F.egresos_anterior.n], [50_000, 1]);
const ids = F.egresos.lista.map((e) => e.id);
fila("E4 (anulado) no está en la lista", ids.includes(EG.E4), false);
fila("E6 (viejo) no está en la lista", ids.includes(EG.E6), false);
fila("la lista suma lo mismo que el total",
  F.egresos.lista.reduce((s, e) => s + e.monto_clp, 0), Number(F.egresos.total_clp));
fila("desde siempre", [Number(F.desde_siempre.total_clp), F.desde_siempre.n], [183_000, 5]);
fila("categoría con nombre legible", F.egresos.lista[0]?.categoria_nombre !== undefined, true);

// --- Caja neta ---------------------------------------------------------------
console.log("\nCaja neta:");
const caja = cajaNeta({ ingresosClp: Number(R.venta.ingresos_clp), egresosClp: Number(F.egresos.total_clp) });
const cajaAnt = cajaNeta({
  ingresosClp: Number(R.venta_anterior.ingresos_clp),
  egresosClp: Number(F.egresos_anterior.total_clp),
});
fila("del mes", caja.netoClp, 9_500);
fila("del mes anterior", cajaAnt.netoClp, -6_000);
const cmp = compararCaja(caja.netoClp, cajaAnt.netoClp);
fila("variación", [cmp.absoluta, cmp.relativa], [15_500, null], "contra un negativo: solo pesos");

// --- Margen por clase --------------------------------------------------------
console.log("\nMargen por clase dictada:");
const { rows: sedesDe } = await q(
  `select cl.id, se.costo_hora_clp, se.nombre
   from public.clases cl join public.sedes se on se.id = cl.sede_id
   where cl.id = any($1)`,
  [[CL[1], CL[2], CL[3]]],
);
const salaDe = Object.fromEntries(sedesDe.map((s) => [s.id, s.costo_hora_clp]));

const conMargen = F.por_clase.map((c) => ({
  ...c,
  ...margenClase(
    c.atribucion.map((a) => ({
      montoCompraClp: a.monto_compra_clp,
      clasesCompra: a.clases_compra,
      recuperoCredito: a.recupero_credito,
      claseYaOcurrio: true,
      n: a.n,
    })),
    {
      horas: horasDeClase(c.inicio, c.fin) ?? 0,
      costoHoraSalaClp: c.costo_hora_sala_clp,
      baseHoraProfesoraClp: c.base_hora_profesora_clp,
      variableCreditoClp: c.variable_credito_clp,
      creditosConsumidos: c.creditos_consumidos,
    },
  ),
}));
const porId = Object.fromEntries(conMargen.map((c) => [c.clase_id, c]));

const esperadas = [
  [CL[1], "CL1", 15_000],
  [CL[2], "CL2", 7_000],
  [CL[3], "CL3", 15_500],
];
for (const [id, nombre, ingreso] of esperadas) {
  const c = porId[id];
  if (!c) { fila(`${nombre} está entre las dictadas`, false, true); continue; }
  const sala = salaDe[id];
  fila(`${nombre} créditos consumidos`, c.creditos_consumidos, 2);
  fila(`${nombre} ingreso`, c.ingresoClp, ingreso);
  fila(`${nombre} costo profesora`, c.costo?.profesoraClp ?? null, 18_500);
  fila(`${nombre} costo sala`, c.costo?.salaClp ?? null, sala, `sede a $${sala}/h`);
  fila(`${nombre} margen`, c.margenClp, ingreso - 18_500 - sala);
}
fila("CL4 (futura) no está", porId[CL[4]] === undefined, true);
fila("CL5 (cancelada) no está", porId[CL[5]] === undefined, true);

const resumen = resumenMargen(conMargen);
fila("clases sin costo cargado", resumen.sinCosto, 0);
fila(
  "el total es la suma de sus filas",
  resumen.margenClp,
  conMargen.filter((c) => c.margenClp !== null).reduce((s, c) => s + c.margenClp, 0),
  `${resumen.clases} clases, incluidas las reales de staging (PRD §11.5)`,
);

// --- Un costo que falta da null, no cero -------------------------------------
console.log("\nSin costo cargado (transacción revertida):");
{
  const { rows } = await q(`select profesora_id from public.clases where id = $1`, [CL[3]]);
  const [{ metricas_finanzas: F2 }] = await comoUsuario(
    OWNER, `select public.metricas_finanzas($1, $2, $3, $4)`, P,
    { sql: `delete from public.costos_profesoras where profesora_id = $1`, params: [rows[0].profesora_id] },
  );
  const c3 = F2.por_clase.find((c) => c.clase_id === CL[3]);
  fila("CL3 llega sin base", c3 === undefined ? "no está" : c3.base_hora_profesora_clp, null);
  const m = margenClase([], {
    horas: 1, costoHoraSalaClp: c3?.costo_hora_sala_clp ?? null,
    baseHoraProfesoraClp: c3?.base_hora_profesora_clp ?? null,
    variableCreditoClp: c3?.variable_credito_clp ?? null, creditosConsumidos: 2,
  });
  fila("CL3 margen", m.margenClp, null, "null, no cero");
  const r2 = resumenMargen(
    F2.por_clase.map((c) =>
      margenClase([], {
        horas: 1, costoHoraSalaClp: c.costo_hora_sala_clp,
        baseHoraProfesoraClp: c.base_hora_profesora_clp,
        variableCreditoClp: c.variable_credito_clp, creditosConsumidos: 0,
      }),
    ),
  );
  fila("clases sin costo, por profesora sin fila", r2.sinCosto >= 1, true, `${r2.sinCosto} de esa profesora`);
}

// --- registrar_egreso y anular_egreso, como la Server Action ------------------
console.log("\nregistrar_egreso (service role, transacciones revertidas):");
const hoy = "(now() at time zone 'America/Santiago')::date";
const reg = (actor, fecha, categoria, descripcion, monto) =>
  comoServicio(
    `select (public.registrar_egreso($1, ${fecha}, $2, $3, $4)).id`,
    [actor, categoria, descripcion, monto],
  );
await debeFallar("monto cero", "23514", () => reg(OWNER, hoy, "insumos", "x", 0));
await debeFallar("monto negativo", "23514", () => reg(OWNER, hoy, "insumos", "x", -5));
await debeFallar("fecha de mañana", "23514", () => reg(OWNER, `${hoy} + 1`, "insumos", "x", 1000));
await debeFallar("categoría inventada", "23514", () => reg(OWNER, hoy, "viajes", "x", 1000));
await debeFallar("descripción vacía", "23514", () => reg(OWNER, hoy, "insumos", "  ", 1000));
await debeFallar("actor admin", "42501", () => reg(ADMIN, hoy, "insumos", "x", 1000));
{
  await q("begin");
  try {
    await q("set local role service_role");
    const { rows: [e] } = await q(
      `select * from public.registrar_egreso($1, ${hoy}, 'insumos', '  Agua  ', 2500)`, [OWNER],
    );
    fila("una válida devuelve la fila", [e.descripcion, e.monto_clp, e.deleted_at], ["Agua", 2500, null]);
    try {
      await q(`select public.anular_egreso($1, $2, '')`, [OWNER, e.id]);
      fila("anular sin motivo", "pasó", "error 23514");
    } catch (err) {
      fila("anular sin motivo", err.code, "23514");
    }
  } finally {
    await q("rollback").catch(() => {});
  }
  await q("begin");
  try {
    await q("set local role service_role");
    const { rows: [e] } = await q(
      `select * from public.registrar_egreso($1, ${hoy}, 'insumos', 'Agua', 2500)`, [OWNER],
    );
    const { rows: [a] } = await q(
      `select * from public.anular_egreso($1, $2, 'Era de prueba')`, [OWNER, e.id],
    );
    fila("anular con motivo", [a.deleted_at !== null, a.motivo_anulacion], [true, "Era de prueba"]);
    try {
      await q(`select public.anular_egreso($1, $2, 'De nuevo')`, [OWNER, e.id]);
      fila("anular dos veces", "pasó", "error 22023");
    } catch (err) {
      fila("anular dos veces", err.code, "22023");
    }
  } finally {
    await q("rollback").catch(() => {});
  }
}
await debeFallar("registrar_egreso como authenticated (admin)", "42501", () =>
  comoUsuario(ADMIN, `select public.registrar_egreso($1, ${hoy}, 'insumos', 'x', 1000)`, [ADMIN]),
);

// --- RLS, preguntado con la sesión de cada rol ---------------------------------
console.log("\nRLS (filas que ve cada rol):");
const cuenta = async (userId, tabla) =>
  Number((await comoUsuario(userId, `select count(*)::int as n from public.${tabla}`))[0].n);
fila("egresos como owner", await cuenta(OWNER, "egresos"), 6, "la política no filtra deleted_at; la consulta sí");
fila("egresos como admin", await cuenta(ADMIN, "egresos"), 0);
fila("costos_profesoras como admin", await cuenta(ADMIN, "costos_profesoras"), 0);
fila("categorias_egreso como admin", await cuenta(ADMIN, "categorias_egreso"), 0);
fila("costos_profesoras como owner ≥ 4", (await cuenta(OWNER, "costos_profesoras")) >= 4, true);
for (const tabla of ["egresos", "costos_profesoras", "categorias_egreso"]) {
  await debeFallar(`${tabla} como anon`, "42501", async () => {
    await q("begin");
    try {
      await q("set local role anon");
      await q(`select count(*) from public.${tabla}`);
    } finally {
      await q("rollback").catch(() => {});
    }
  });
}

console.log("\nmetricas_finanzas por rol:");
await debeFallar("admin", "42501", () =>
  comoUsuario(ADMIN, `select public.metricas_finanzas($1, $2, $3, $4)`, P),
);
await debeFallar("anon", "42501", async () => {
  await q("begin");
  try {
    await q("set local role anon");
    await q(`select public.metricas_finanzas($1, $2, $3, $4)`, P);
  } finally {
    await q("rollback").catch(() => {});
  }
});

console.log(fallas ? `\n${fallas} ✗` : "\nTodo ✓");
await cliente.end();
process.exitCode = fallas ? 1 : 0;
