/**
 * Tests de las finanzas del tablero de owner: caja neta, costo y margen por
 * clase, egresos por categoría.
 *
 * **Los números no se inventan acá.** Salen del juez de la fase 0.2 del plan
 * de la parte 2 —`context/prds/0010-plan-de-implementacion-parte-2.md`—, que
 * se calculó a mano *antes* de que existiera este código, sobre el escenario
 * de PRD-0010 §11.4 más seis egresos. Si un valor no coincide con el plan, el
 * que manda es el plan.
 *
 * Corren con `npm test`. Sin dependencias: Node 24 trae el corredor y ejecuta
 * TypeScript sin transpilar.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  cajaNeta,
  compararCaja,
  costoClase,
  horasDeClase,
  ingresoClase,
  montoDesdeTexto,
  margenClase,
  porCategoria,
  resumenMargen,
} from "./finanzas.ts";

// ---------------------------------------------------------------------------
// Caja neta
// ---------------------------------------------------------------------------

test("cajaNeta: el escenario, este mes y el anterior", () => {
  assert.equal(cajaNeta({ ingresosClp: 112_500, egresosClp: 103_000 }).netoClp, 9_500);
  assert.equal(cajaNeta({ ingresosClp: 44_000, egresosClp: 50_000 }).netoClp, -6_000);
});

test("compararCaja: contra un anterior negativo hay diferencia en pesos y no hay porcentaje", () => {
  const c = compararCaja(9_500, -6_000);
  assert.equal(c.absoluta, 15_500);
  assert.equal(c.relativa, null);
});

test("compararCaja: contra cero tampoco hay porcentaje; sin anterior no hay nada", () => {
  assert.equal(compararCaja(9_500, 0).relativa, null);
  assert.equal(compararCaja(9_500, 0).absoluta, 9_500);
  assert.deepEqual(compararCaja(9_500, null), {
    actual: 9_500,
    anterior: null,
    absoluta: null,
    relativa: null,
  });
});

test("compararCaja: contra un anterior positivo sí hay porcentaje", () => {
  assert.equal(compararCaja(15_000, 10_000).relativa, 0.5);
});

// ---------------------------------------------------------------------------
// Costo de una clase
// ---------------------------------------------------------------------------

const costoLeones = {
  horas: 1,
  costoHoraSalaClp: 17_000,
  baseHoraProfesoraClp: 18_000,
  variableCreditoClp: 250,
  creditosConsumidos: 2,
};

test("costoClase: una hora en Los Leones con dos créditos consumidos", () => {
  assert.deepEqual(costoClase(costoLeones), {
    salaClp: 17_000,
    profesoraClp: 18_500,
    totalClp: 35_500,
  });
});

test("costoClase: Diaguitas cuesta cero de sala, no null", () => {
  assert.deepEqual(costoClase({ ...costoLeones, costoHoraSalaClp: 0 }), {
    salaClp: 0,
    profesoraClp: 18_500,
    totalClp: 18_500,
  });
});

test("costoClase: hora y media escala la sala y la base, no el variable", () => {
  assert.deepEqual(costoClase({ ...costoLeones, horas: 1.5 }), {
    salaClp: 25_500,
    profesoraClp: 27_500,
    totalClp: 53_000,
  });
});

test("costoClase: sin costo cargado devuelve null, nunca cero", () => {
  assert.equal(costoClase({ ...costoLeones, costoHoraSalaClp: null }), null);
  assert.equal(costoClase({ ...costoLeones, baseHoraProfesoraClp: null }), null);
  assert.equal(costoClase({ ...costoLeones, variableCreditoClp: null }), null);
  assert.equal(costoClase({ ...costoLeones, horas: 0 }), null);
});

test("costoClase: una clase vacía cuesta la base y la sala igual", () => {
  assert.equal(costoClase({ ...costoLeones, creditosConsumidos: 0 })?.totalClp, 35_000);
});

test("horasDeClase: sin fin dura una hora; con fin, lo que dure", () => {
  assert.equal(horasDeClase("2026-09-10T22:00:00Z", null), 1);
  assert.equal(horasDeClase("2026-09-10T22:00:00Z", "2026-09-10T23:30:00Z"), 1.5);
});

test("horasDeClase: un fin anterior o igual al inicio no es una duración", () => {
  assert.equal(horasDeClase("2026-09-10T22:00:00Z", "2026-09-10T22:00:00Z"), null);
  assert.equal(horasDeClase("2026-09-10T22:00:00Z", "2026-09-10T21:00:00Z"), null);
});

// ---------------------------------------------------------------------------
// Ingreso y margen de una clase
// ---------------------------------------------------------------------------

const ana = { montoCompraClp: 28_000, clasesCompra: 4, recuperoCredito: false, claseYaOcurrio: true };
const bea = { montoCompraClp: 16_000, clasesCompra: 2, recuperoCredito: false, claseYaOcurrio: true };
const cataRegalo = {
  montoCompraClp: null,
  clasesCompra: null,
  recuperoCredito: false,
  claseYaOcurrio: true,
};
const cataSuelta = { montoCompraClp: 8_500, clasesCompra: 1, recuperoCredito: false, claseYaOcurrio: true };

test("ingresoClase: CL1, CL2 y CL3 del escenario", () => {
  assert.equal(ingresoClase([ana, bea]), 15_000);
  assert.equal(ingresoClase([ana, cataRegalo]), 7_000);
  assert.equal(ingresoClase([ana, cataSuelta]), 15_500);
});

test("ingresoClase: acepta filas agrupadas con n", () => {
  assert.equal(ingresoClase([{ ...ana, n: 3 }]), 21_000);
});

test("margenClase: CL1 en Los Leones pierde plata con dos alumnas", () => {
  const m = margenClase([ana, bea], costoLeones);
  assert.equal(m.ingresoClp, 15_000);
  assert.equal(m.margenClp, 15_000 - 35_500);
});

test("margenClase: sin costo el margen es null aunque haya ingreso", () => {
  const m = margenClase([ana, bea], { ...costoLeones, baseHoraProfesoraClp: null });
  assert.equal(m.ingresoClp, 15_000);
  assert.equal(m.margenClp, null);
});

test("resumenMargen: suma solo las que tienen costo y cuenta las que no", () => {
  const conCosto = margenClase([ana, bea], costoLeones);
  const sinCosto = margenClase([ana], { ...costoLeones, costoHoraSalaClp: null });
  const r = resumenMargen([conCosto, sinCosto]);
  assert.equal(r.clases, 1);
  assert.equal(r.ingresoClp, 15_000);
  assert.equal(r.costoClp, 35_500);
  assert.equal(r.margenClp, -20_500);
  assert.equal(r.sinCosto, 1);
});

test("resumenMargen: sin clases da ceros y no NaN", () => {
  assert.deepEqual(resumenMargen([]), {
    clases: 0,
    ingresoClp: 0,
    costoClp: 0,
    margenClp: 0,
    sinCosto: 0,
  });
});

// ---------------------------------------------------------------------------
// Egresos
// ---------------------------------------------------------------------------

test("porCategoria: los egresos del escenario, de mayor a menor", () => {
  assert.deepEqual(
    porCategoria([
      { categoria: "arriendo_sala", montoClp: 68_000 },
      { categoria: "insumos", montoClp: 15_000 },
      { categoria: "marketing", montoClp: 20_000 },
    ]),
    [
      { categoria: "arriendo_sala", montoClp: 68_000 },
      { categoria: "marketing", montoClp: 20_000 },
      { categoria: "insumos", montoClp: 15_000 },
    ],
  );
});

test("porCategoria: dos egresos de la misma categoría se suman", () => {
  assert.deepEqual(
    porCategoria([
      { categoria: "insumos", montoClp: 5_000 },
      { categoria: "insumos", montoClp: 10_000 },
    ]),
    [{ categoria: "insumos", montoClp: 15_000 }],
  );
});

// ---------------------------------------------------------------------------
// montoDesdeTexto — lo que alguien teclea en el campo del monto
// ---------------------------------------------------------------------------

test("montoDesdeTexto: enteros, con o sin puntos de miles", () => {
  assert.equal(montoDesdeTexto("68000"), 68_000);
  assert.equal(montoDesdeTexto("68.000"), 68_000);
  assert.equal(montoDesdeTexto("1.234.567"), 1_234_567);
  assert.equal(montoDesdeTexto("  500 "), 500);
});

test("montoDesdeTexto: «12.5» no es 125, es un decimal mal escrito", () => {
  // Antes se quitaban los puntos sin mirar y 12.5 entraba como $125.
  assert.equal(montoDesdeTexto("12.5"), null);
  assert.equal(montoDesdeTexto("12.50"), null);
  assert.equal(montoDesdeTexto("1.2345"), null);
  assert.equal(montoDesdeTexto("12,5"), null);
});

test("montoDesdeTexto: vacío, negativo y letras dan null; el cero pasa y lo rechaza la base", () => {
  assert.equal(montoDesdeTexto(""), null);
  assert.equal(montoDesdeTexto("-5"), null);
  assert.equal(montoDesdeTexto("abc"), null);
  assert.equal(montoDesdeTexto("$1.000"), null);
  // Con su mensaje, "mayor que cero", que es más preciso que "no es un entero".
  assert.equal(montoDesdeTexto("0"), 0);
});

test("montoDesdeTexto: más que un int de Postgres da null y no 22003", () => {
  assert.equal(montoDesdeTexto("2147483647"), 2_147_483_647);
  assert.equal(montoDesdeTexto("2147483648"), null);
});
