/**
 * Tests de la liquidación de profesoras (PRD-0010 parte 3).
 *
 * Es la parte del sistema donde un error le cuesta plata a alguien: a la
 * academia si paga de más, a la profesora si paga de menos. Los montos
 * esperados están **calculados a mano** antes de correr nada, y cada uno dice
 * de dónde sale.
 *
 * Las reglas: CONTEXT.md §5.b —el umbral del variable (21/10/2026), las cinco
 * causas, la recuperación y el incentivo en dos tramos (04/11/2026)—.
 * Noviembre de 2026 en Santiago es UTC−3.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  INCENTIVO,
  PRIMER_MES_LIQUIDABLE,
  TARIFA_GENERAL as T,
  baseDeClase,
  efectoDeCausa,
  incentivoDeCurso,
  lineaDeClase,
  liquidar,
  mesEnSantiago,
  mesTerminado,
  noEntraEnEstePago,
  nombreDeMes,
  textoDeBloqueo,
  variableDeClase,
  type Causa,
  type ClaseLiquidable,
} from "./liquidacion.ts";

const P1 = "p1";
const P2 = "p2";
const DIC_1 = new Date("2026-12-01T12:00:00-03:00");

let n = 0;
/** Una clase de parrilla de una hora, dictada salvo que se diga otra cosa. */
function clase(dia: string, extra: Partial<ClaseLiquidable> = {}): ClaseLiquidable {
  return {
    id: `c${++n}`,
    profesoraId: P1,
    cursoId: "reggaeton",
    curso: "Reggaeton",
    sede: "Los Leones",
    inicio: `${dia}T19:00:00-03:00`,
    fin: null,
    tipo: "parrilla",
    estado: "programada",
    causa: null,
    profesoraSePresento: false,
    recuperada: false,
    recuperacionInicio: null,
    recuperaInicio: null,
    creditosConsumidos: 0,
    ...extra,
  };
}
const noDictada = (dia: string, causa: Causa, extra: Partial<ClaseLiquidable> = {}) =>
  clase(dia, { estado: "no_dictada", causa, ...extra });

// ---------------------------------------------------------------------------
// Las constantes son las de CONTEXT.md, no otras
// ---------------------------------------------------------------------------

test("la tarifa general es $18.000 la hora, $250 por crédito, desde el sexto", () => {
  assert.deepEqual(T, { baseHoraClp: 18_000, variableCreditoClp: 250, umbralVariable: 5 });
});

test("el incentivo: 4 mejores, mínimo 4 dictadas, tramos 14 → $7.500 y 22 → $7.500 más", () => {
  assert.equal(INCENTIVO.mejores, 4);
  assert.equal(INCENTIVO.minimoDictadas, 4);
  assert.deepEqual(
    INCENTIVO.tramos.map((t) => [t.desdePromedio, t.montoClp]),
    [[14, 7_500], [22, 7_500]],
  );
});

test("la liquidación arranca en noviembre de 2026: octubre no se carga", () => {
  assert.equal(PRIMER_MES_LIQUIDABLE, "2026-11");
  const octubre = liquidar({ profesoraId: P1, mes: "2026-10", clases: [clase("2026-10-20", { creditosConsumidos: 10 })], tarifa: T, ahora: DIC_1 });
  assert.ok(octubre.bloqueos.some((b) => b.tipo === "antes_de_noviembre"));
  assert.match(textoDeBloqueo({ tipo: "antes_de_noviembre" }), /se pagaron a mano/);
});

// ---------------------------------------------------------------------------
// El variable, con su umbral
// ---------------------------------------------------------------------------

test("variable: con 5 créditos o menos es $0", () => {
  for (const c of [0, 1, 4, 5]) assert.equal(variableDeClase(c, T), 0, `${c} créditos`);
});

test("variable: con 6 es $250, el primero que paga", () => {
  assert.equal(variableDeClase(6, T), 250);
});

test("variable: el ejemplo de Felipe, 15 alumnas → $2.500", () => {
  assert.equal(variableDeClase(15, T), 2_500);
});

test("variable: no escala con la duración (90 minutos con 6 créditos sigue siendo $250)", () => {
  const l = lineaDeClase(clase("2026-11-07", { fin: "2026-11-07T20:30:00-03:00", creditosConsumidos: 6 }), T, DIC_1);
  assert.equal(l.variableClp, 250);
  assert.equal(l.baseClp, 27_000);
});

test("base: una hora $18.000; hora y media $27.000, redondeada al peso", () => {
  assert.equal(baseDeClase(1, T), 18_000);
  assert.equal(baseDeClase(1.5, T), 27_000);
  assert.equal(baseDeClase(50 / 60, T), 15_000);
});

// ---------------------------------------------------------------------------
// Las causas y la recuperación
// ---------------------------------------------------------------------------

const TODAS: readonly Causa[] = ["sala_no_disponible", "cambio_de_parrilla", "ausencia_profesora", "sin_alumnas", "asistencia_insuficiente"];

test("causas sin recuperar: sala → base; parrilla y ausencia → nada; sin alumnas y asistencia → base", () => {
  const ctx = { recuperada: false, profesoraSePresento: false };
  assert.equal(efectoDeCausa("sala_no_disponible", ctx), "base");
  assert.equal(efectoDeCausa("cambio_de_parrilla", ctx), "nada");
  assert.equal(efectoDeCausa("ausencia_profesora", ctx), "nada");
  assert.equal(efectoDeCausa("sin_alumnas", ctx), "base");
  assert.equal(efectoDeCausa("asistencia_insuficiente", ctx), "base");
});

test("recuperada y sin presentarse, por cualquier causa: nada en la original (se paga una vez, en la recuperación)", () => {
  for (const causa of TODAS) {
    assert.equal(efectoDeCausa(causa, { recuperada: true, profesoraSePresento: false }), "nada", causa);
  }
});

test("se presentó, en sala_no_disponible: la base, se recupere o no", () => {
  assert.equal(efectoDeCausa("sala_no_disponible", { recuperada: false, profesoraSePresento: true }), "base");
  assert.equal(efectoDeCausa("sala_no_disponible", { recuperada: true, profesoraSePresento: true }), "base");
});

test("se presentó, en las otras cuatro causas: el campo no cambia el pago", () => {
  for (const causa of TODAS.filter((c) => c !== "sala_no_disponible")) {
    for (const recuperada of [false, true]) {
      assert.equal(
        efectoDeCausa(causa, { recuperada, profesoraSePresento: true }),
        efectoDeCausa(causa, { recuperada, profesoraSePresento: false }),
        `${causa}, recuperada: ${recuperada}`,
      );
    }
  }
});

test("Pau del 03/11 con el campo prendido por error: sigue pagando una sola vez", () => {
  const pau = noDictada("2026-11-03", "asistencia_insuficiente", { estado: "cancelada", recuperada: true, profesoraSePresento: true });
  const l = lineaDeClase(pau, T, DIC_1);
  assert.equal(l.totalClp, 0);
  assert.match(l.explicacion, /una sola vez, en la recuperación/);
  assert.doesNotMatch(l.explicacion, /se presentó/);
});

test("sala sin disponibilidad: decide si ella fue, no si se recuperó", () => {
  const sala = noDictada("2026-11-12", "sala_no_disponible", { recuperada: true });
  // Le avisamos a tiempo y no fue: se paga una sola vez, en la recuperación.
  assert.equal(lineaDeClase(sala, T, DIC_1).totalClp, 0);
  // Llegó y no había sala: se le paga la base, y la recuperación aparte.
  const fue = lineaDeClase({ ...sala, profesoraSePresento: true }, T, DIC_1);
  assert.deepEqual([fue.baseClp, fue.variableClp, fue.totalClp], [18_000, 0, 18_000]);
  assert.match(fue.explicacion, /se presentó/);
  assert.match(fue.explicacion, /además de la recuperación/);
});

test("se presentó, en una de 90 minutos: la base escala con la duración y el variable sigue en cero", () => {
  const c = noDictada("2026-11-12", "sala_no_disponible", {
    fin: "2026-11-12T20:30:00-03:00",
    creditosConsumidos: 12,
    profesoraSePresento: true,
  });
  assert.deepEqual([lineaDeClase(c, T, DIC_1).baseClp, lineaDeClase(c, T, DIC_1).variableClp], [27_000, 0]);
});

test("se presentó no la vuelve dictada: no suma al piso ni al promedio del incentivo", () => {
  const r = liquidar({
    profesoraId: P1, mes: "2026-11", tarifa: T, ahora: DIC_1,
    clases: [
      clase("2026-11-03", { creditosConsumidos: 20 }),
      clase("2026-11-10", { creditosConsumidos: 20 }),
      clase("2026-11-17", { creditosConsumidos: 20 }),
      noDictada("2026-11-24", "sala_no_disponible", { profesoraSePresento: true, creditosConsumidos: 20 }),
    ],
  });
  assert.equal(r.incentivos[0].dictadas, 3);
  assert.equal(r.incentivoClp, 0);
  assert.equal(r.baseClp, 72_000);
});

test("la original con la profesora presente y su recuperación: se pagan las dos, y el total lo dice", () => {
  const r = liquidar({
    profesoraId: P1, mes: "2026-11", tarifa: T, ahora: DIC_1,
    clases: [
      noDictada("2026-11-12", "sala_no_disponible", { recuperada: true, profesoraSePresento: true }), // 18.000
      clase("2026-11-19", { creditosConsumidos: 8 }),                                                  // 18.000 + 750
    ],
  });
  assert.equal(r.totalClp, 36_750);
});

test("una no dictada no paga variable aunque haya tenido reservas", () => {
  const l = lineaDeClase(noDictada("2026-11-12", "sala_no_disponible", { creditosConsumidos: 12 }), T, DIC_1);
  assert.deepEqual([l.baseClp, l.variableClp, l.totalClp], [18_000, 0, 18_000]);
});

test("el caso de Pau del 03/11: asistencia insuficiente, cancelada después de la hora", () => {
  const pau = noDictada("2026-11-03", "asistencia_insuficiente", { estado: "cancelada" });
  // Si se recupera: $0 en la original.
  assert.equal(lineaDeClase({ ...pau, recuperada: true }, T, DIC_1).totalClp, 0);
  // Si no se recupera: la base. Pau no faltó.
  assert.equal(lineaDeClase(pau, T, DIC_1).totalClp, 18_000);
});

test("cancelada o no dictada sin causa: no paga y queda marcada para bloquear el mes", () => {
  const l = lineaDeClase(clase("2026-11-12", { estado: "cancelada" }), T, DIC_1);
  assert.equal(l.tipo, "sin_causa");
  assert.equal(l.totalClp, 0);
});

test("una programada que todavía no empieza no entra", () => {
  const l = lineaDeClase(clase("2026-11-30"), T, new Date("2026-11-15T12:00:00-03:00"));
  assert.equal(l.tipo, "futura");
  assert.equal(l.totalClp, 0);
});

test("una pasada sin reservas se paga como dictada: la base (respuesta 1 del 04/11)", () => {
  assert.equal(lineaDeClase(clase("2026-11-12"), T, DIC_1).totalClp, 18_000);
});

// ---------------------------------------------------------------------------
// El incentivo
// ---------------------------------------------------------------------------

test("incentivo: con menos clases que el piso (3), nada aunque estén llenas", () => {
  const i = incentivoDeCurso("x", [30, 30, 30]);
  assert.equal(i.montoClp, 0);
  assert.equal(i.promedio, null);
  assert.match(i.explicacion, /hacen falta 4/);
});

test("incentivo: justo en el límite del primer tramo, promedio 14 exacto → $7.500", () => {
  assert.equal(incentivoDeCurso("x", [14, 14, 14, 14]).montoClp, 7_500);
  assert.equal(incentivoDeCurso("x", [20, 8, 14, 14]).montoClp, 7_500); // suma 56
});

test("incentivo: una alumna menos, promedio 13,75 → nada (no se redondea)", () => {
  const i = incentivoDeCurso("x", [14, 14, 14, 13]);
  assert.equal(i.montoClp, 0);
  assert.equal(i.promedio, 13.75);
});

test("incentivo: justo en el segundo tramo, promedio 22 exacto → los dos, $15.000", () => {
  const i = incentivoDeCurso("x", [22, 22, 22, 22]);
  assert.equal(i.montoClp, 15_000);
  assert.equal(i.tramos, 2);
});

test("incentivo: promedio 21,75 → solo el primer tramo, $7.500", () => {
  assert.equal(incentivoDeCurso("x", [22, 22, 22, 21]).montoClp, 7_500);
});

test("incentivo: los tramos se suman, con 25 cobra $15.000 y no $10.000 ni $7.500", () => {
  assert.equal(incentivoDeCurso("x", [25, 25, 25, 25]).montoClp, 15_000);
});

test("incentivo: con 5 clases se descarta la peor", () => {
  // Las 4 mejores son 22: los dos tramos. Con la peor adentro serían 17,6 → uno.
  const i = incentivoDeCurso("x", [22, 4, 22, 22, 22]);
  assert.deepEqual(i.mejores, [22, 22, 22, 22]);
  assert.equal(i.montoClp, 15_000);
});

test("incentivo: una no dictada no entra como cero ni cuenta para el piso", () => {
  const r = liquidar({
    profesoraId: P1,
    mes: "2026-11",
    tarifa: T,
    ahora: DIC_1,
    clases: [
      clase("2026-11-03", { creditosConsumidos: 15 }),
      clase("2026-11-10", { creditosConsumidos: 15 }),
      clase("2026-11-17", { creditosConsumidos: 15 }),
      noDictada("2026-11-24", "ausencia_profesora"),
    ],
  });
  assert.equal(r.incentivos[0].dictadas, 3);
  assert.equal(r.incentivoClp, 0);
});

test("incentivo: una profe con dos cursos gana en los dos ($7.500 + $15.000)", () => {
  const cursoA = [14, 14, 14, 14].map((c, i) => clase(`2026-11-0${i + 2}`, { cursoId: "a", creditosConsumidos: c }));
  const cursoB = [22, 23, 22, 24].map((c, i) => clase(`2026-11-1${i + 2}`, { cursoId: "b", creditosConsumidos: c }));
  const r = liquidar({ profesoraId: P1, mes: "2026-11", tarifa: T, ahora: DIC_1, clases: [...cursoA, ...cursoB] });
  assert.deepEqual(r.incentivos.map((i) => [i.cursoId, i.montoClp]), [["a", 7_500], ["b", 15_000]]);
  assert.equal(r.incentivoClp, 22_500);
});

test("incentivo: es por curso, no se juntan dos cursos para llegar al piso", () => {
  const r = liquidar({
    profesoraId: P1,
    mes: "2026-11",
    tarifa: T,
    ahora: DIC_1,
    clases: [
      clase("2026-11-03", { cursoId: "a", creditosConsumidos: 20 }),
      clase("2026-11-04", { cursoId: "a", creditosConsumidos: 20 }),
      clase("2026-11-05", { cursoId: "b", creditosConsumidos: 20 }),
      clase("2026-11-06", { cursoId: "b", creditosConsumidos: 20 }),
    ],
  });
  assert.equal(r.incentivoClp, 0);
});

// ---------------------------------------------------------------------------
// Un mes con una clase no dictada y su recuperación
// ---------------------------------------------------------------------------

test("no dictada + recuperación: la original paga $0, la recuperación se paga entera y llega al piso", () => {
  const r = liquidar({
    profesoraId: P1,
    mes: "2026-11",
    tarifa: T,
    ahora: DIC_1,
    clases: [
      clase("2026-11-03", { creditosConsumidos: 16 }),                                // 18.000 + 2.750
      clase("2026-11-10", { creditosConsumidos: 12 }),                                // 18.000 + 1.750
      noDictada("2026-11-17", "asistencia_insuficiente", { recuperada: true, creditosConsumidos: 9 }), // 0
      clase("2026-11-20", { creditosConsumidos: 14 }),                                // la recuperación: 18.000 + 2.250
      clase("2026-11-24", { creditosConsumidos: 14 }),                                // 18.000 + 2.250
    ],
  });
  assert.deepEqual(r.lineas.map((l) => l.totalClp), [20_750, 19_750, 0, 20_250, 20_250]);
  // Cuatro dictadas gracias a la recuperación; 16 + 14 + 14 + 12 = 56 → promedio 14.
  assert.equal(r.incentivos[0].dictadas, 4);
  assert.equal(r.incentivoClp, 7_500);
  assert.equal(r.totalClp, 81_000 + 7_500);
});

test("sin la recuperación, el mismo mes paga la base de la no dictada y no llega al piso", () => {
  const r = liquidar({
    profesoraId: P1,
    mes: "2026-11",
    tarifa: T,
    ahora: DIC_1,
    clases: [
      clase("2026-11-03", { creditosConsumidos: 16 }),
      clase("2026-11-10", { creditosConsumidos: 12 }),
      noDictada("2026-11-17", "asistencia_insuficiente"),
      clase("2026-11-24", { creditosConsumidos: 14 }),
    ],
  });
  assert.deepEqual(r.lineas.map((l) => l.totalClp), [20_750, 19_750, 18_000, 20_250]);
  assert.equal(r.incentivoClp, 0);
});

test("la recuperación en el mes siguiente: noviembre paga $0 por la original, diciembre paga la recuperación", () => {
  const original = noDictada("2026-11-28", "sala_no_disponible", { recuperada: true });
  const recuperacion = clase("2026-12-03", { creditosConsumidos: 8 });
  const nov = liquidar({ profesoraId: P1, mes: "2026-11", tarifa: T, ahora: new Date("2027-01-02T12:00:00-03:00"), clases: [original, recuperacion] });
  const dic = liquidar({ profesoraId: P1, mes: "2026-12", tarifa: T, ahora: new Date("2027-01-02T12:00:00-03:00"), clases: [original, recuperacion] });
  assert.equal(nov.totalClp, 0);
  assert.equal(dic.totalClp, 18_000 + 750);
});

// ---------------------------------------------------------------------------
// El reemplazo
// ---------------------------------------------------------------------------

test("reemplazo: la clase se le paga a quien dictó, no a la titular", () => {
  const cubierta = clase("2026-11-26", { profesoraId: P2, creditosConsumidos: 22 }); // P2 dictó la clase de P1
  const clases = [clase("2026-11-05", { creditosConsumidos: 3 }), cubierta];
  const p1 = liquidar({ profesoraId: P1, mes: "2026-11", tarifa: T, ahora: DIC_1, clases });
  const p2 = liquidar({ profesoraId: P2, mes: "2026-11", tarifa: T, ahora: DIC_1, clases });
  assert.equal(p1.totalClp, 18_000);
  assert.equal(p2.totalClp, 18_000 + 17 * 250); // 22.250
  assert.ok(!p1.lineas.some((l) => l.claseId === cubierta.id));
});

// ---------------------------------------------------------------------------
// El mes completo, calculado a mano
// ---------------------------------------------------------------------------

test("un mes completo de P1: $187.750, línea por línea", () => {
  const r = liquidar({
    profesoraId: P1,
    mes: "2026-11",
    tarifa: T,
    ahora: DIC_1,
    clases: [
      // Reggaeton: 4 dictadas (una es la recuperación) y la original no dictada.
      clase("2026-11-03", { cursoId: "reggaeton", creditosConsumidos: 16 }), // 20.750
      clase("2026-11-10", { cursoId: "reggaeton", creditosConsumidos: 12 }), // 19.750
      noDictada("2026-11-17", "asistencia_insuficiente", { cursoId: "reggaeton", recuperada: true }), // 0
      clase("2026-11-20", { cursoId: "reggaeton", creditosConsumidos: 14 }), // 20.250
      clase("2026-11-24", { cursoId: "reggaeton", creditosConsumidos: 14 }), // 20.250 → incentivo 7.500
      // Heels: dos dictadas, una sin sala, una por cambio de parrilla, una sin alumnas no recuperada.
      clase("2026-11-05", { cursoId: "heels", creditosConsumidos: 3 }),      // 18.000
      clase("2026-11-12", { cursoId: "heels", creditosConsumidos: 5 }),      // 18.000
      noDictada("2026-11-19", "sala_no_disponible", { cursoId: "heels", estado: "cancelada" }), // 18.000
      noDictada("2026-11-26", "cambio_de_parrilla", { cursoId: "heels", estado: "cancelada" }), // 0
      clase("2026-11-28", { cursoId: "heels", estado: "cancelada", causa: "sin_alumnas" }), // 18.000
      // Una de 90 minutos.
      clase("2026-11-07", { cursoId: "intensivo", fin: "2026-11-07T20:30:00-03:00", creditosConsumidos: 6 }), // 27.250
      // Lo que no entra: una especial, una del mes siguiente, una de otra profesora.
      clase("2026-11-14", { tipo: "especial", creditosConsumidos: 20 }),
      clase("2026-12-01", { creditosConsumidos: 20 }),
      clase("2026-11-21", { profesoraId: P2, creditosConsumidos: 20 }),
    ],
  });

  assert.equal(r.baseClp, 72_000 + 72_000 + 27_000);           // 171.000
  assert.equal(r.variableClp, 2_750 + 1_750 + 2_250 + 2_250 + 250); // 9.250
  assert.equal(r.incentivoClp, 7_500);
  assert.equal(r.totalClp, 187_750);
  assert.equal(r.especiales, 1);
  assert.equal(r.lineas.length, 12); // 11 de parrilla del mes + la especial
  assert.deepEqual(r.bloqueos, []);
});

// ---------------------------------------------------------------------------
// Lo que impide pagar
// ---------------------------------------------------------------------------

test("el mes en curso se calcula pero no se puede pagar", () => {
  const r = liquidar({ profesoraId: P1, mes: "2026-11", tarifa: T, ahora: new Date("2026-11-30T23:00:00-03:00"), clases: [clase("2026-11-03", { creditosConsumidos: 10 })] });
  assert.equal(r.totalClp, 19_250);
  assert.deepEqual(r.bloqueos, [{ tipo: "mes_en_curso" }]);
});

test("sin tarifa cargada: bloqueada, no es un costo de cero", () => {
  const r = liquidar({ profesoraId: P1, mes: "2026-11", tarifa: null, ahora: DIC_1, clases: [clase("2026-11-03")] });
  assert.ok(r.bloqueos.some((b) => b.tipo === "sin_tarifa"));
});

test("una clase sin causa bloquea el mes, y dice cuántas", () => {
  const r = liquidar({
    profesoraId: P1, mes: "2026-11", tarifa: T, ahora: DIC_1,
    clases: [clase("2026-11-03", { estado: "cancelada" }), clase("2026-11-04", { estado: "no_dictada" }), clase("2026-11-05")],
  });
  assert.deepEqual(r.bloqueos, [{ tipo: "clases_sin_causa", cuantas: 2 }]);
  assert.match(textoDeBloqueo(r.bloqueos[0]), /^2 clases/);
});

// ---------------------------------------------------------------------------
// El mes, en Santiago
// ---------------------------------------------------------------------------

test("una clase del 30/11 a las 22:00 es de noviembre, aunque en UTC ya sea diciembre", () => {
  assert.equal(mesEnSantiago("2026-11-30T22:00:00-03:00"), "2026-11");
  const r = liquidar({ profesoraId: P1, mes: "2026-11", tarifa: T, ahora: DIC_1, clases: [clase("2026-11-30", { inicio: "2026-11-30T22:00:00-03:00" })] });
  assert.equal(r.lineas.length, 1);
});

test("el mes termina a medianoche de Santiago, no de UTC", () => {
  assert.equal(mesTerminado("2026-11", new Date("2026-11-30T23:30:00-03:00")), false);
  assert.equal(mesTerminado("2026-11", new Date("2026-12-01T00:30:00-03:00")), true);
});

// ---------------------------------------------------------------------------
// Bordes que se agregaron al final de la noche
// ---------------------------------------------------------------------------

test("una especial no suma al promedio ni al piso del incentivo", () => {
  const r = liquidar({
    profesoraId: P1, mes: "2026-11", tarifa: T, ahora: DIC_1,
    clases: [
      clase("2026-11-03", { creditosConsumidos: 20 }),
      clase("2026-11-10", { creditosConsumidos: 20 }),
      clase("2026-11-17", { creditosConsumidos: 20 }),
      clase("2026-11-24", { tipo: "especial", creditosConsumidos: 30 }),
    ],
  });
  assert.equal(r.incentivos[0].dictadas, 3);
  assert.equal(r.incentivoClp, 0);
  assert.equal(r.especiales, 1);
});

test("una futura del mes no cuenta para el piso: el incentivo se decide con el mes cerrado", () => {
  const r = liquidar({
    profesoraId: P1, mes: "2026-11", tarifa: T, ahora: new Date("2026-11-20T12:00:00-03:00"),
    clases: ["03", "10", "17", "24"].map((d) => clase(`2026-11-${d}`, { creditosConsumidos: 22 })),
  });
  assert.equal(r.incentivos[0].dictadas, 3);
  assert.equal(r.incentivoClp, 0);
  assert.ok(r.bloqueos.some((b) => b.tipo === "mes_en_curso"));
});

// ---------------------------------------------------------------------------
// Cuáles clases se promediaron, y lo que no se está pagando
// ---------------------------------------------------------------------------

test("el incentivo dice cuáles 4 clases usó, de mayor a menor, y deja afuera la peor", () => {
  const cs = [
    clase("2026-11-03", { creditosConsumidos: 9 }),
    clase("2026-11-10", { creditosConsumidos: 16 }),
    clase("2026-11-17", { creditosConsumidos: 12 }),
    clase("2026-11-24", { creditosConsumidos: 14 }),
    clase("2026-11-26", { creditosConsumidos: 14 }),
  ];
  const r = liquidar({ profesoraId: P1, mes: "2026-11", tarifa: T, ahora: DIC_1, clases: cs });
  const usadas = r.incentivos[0].clasesDelPromedio;
  assert.deepEqual(usadas.map((c) => c.creditos), r.incentivos[0].mejores);
  assert.deepEqual(usadas.map((c) => c.claseId), [cs[1].id, cs[3].id, cs[4].id, cs[2].id]);
  assert.equal(r.incentivos[0].promedio, 14);
  assert.equal(r.incentivos[0].curso, "Reggaeton");
});

test("menos de 4 dictadas: no hay clases del promedio y dice por qué", () => {
  const r = liquidar({ profesoraId: P1, mes: "2026-11", tarifa: T, ahora: DIC_1, clases: [clase("2026-11-03", { creditosConsumidos: 20 })] });
  assert.deepEqual(r.incentivos[0].clasesDelPromedio, []);
  assert.match(r.incentivos[0].explicacion, /hacen falta 4/);
});

const noEntra = (cs: ClaseLiquidable[]) =>
  noEntraEnEstePago(liquidar({ profesoraId: P1, mes: "2026-11", tarifa: T, ahora: DIC_1, clases: cs }).lineas, "2026-11");

test("la del 27/11 recuperada el 3/12: dice que se paga en diciembre y cuándo cae", () => {
  const cae = "2026-12-03T19:00:00-03:00";
  const [f] = noEntra([noDictada("2026-11-27", "asistencia_insuficiente", { recuperada: true, recuperacionInicio: cae })]);
  assert.deepEqual([f.razon, f.cae], ["se_paga_otro_mes", cae]);
  assert.match(f.explicacion, /Se paga en diciembre de 2026/);
});

test("recuperada dentro del mes: se paga en la recuperación", () => {
  const [f] = noEntra([noDictada("2026-11-03", "sin_alumnas", { recuperada: true, recuperacionInicio: "2026-11-20T19:00:00-03:00" })]);
  assert.equal(f.razon, "se_paga_en_la_recuperacion");
});

test("sin fecha y pagando la base: avisa que después no se puede recuperar", () => {
  const [f] = noEntra([noDictada("2026-11-27", "sin_alumnas")]);
  assert.equal(f.razon, "sin_fecha");
  assert.match(f.explicacion, /ya no se puede recuperar/);
});

test("ausencia sin fecha: no paga nada y sigue pendiente de recuperar", () => {
  const [f] = noEntra([noDictada("2026-11-27", "ausencia_profesora")]);
  assert.equal(f.razon, "sin_fecha");
  assert.match(f.explicacion, /no paga nada/);
});

test("cambio de parrilla: no paga y no queda pendiente de recuperar", () => {
  const [f] = noEntra([noDictada("2026-11-27", "cambio_de_parrilla")]);
  assert.equal(f.razon, "no_paga");
});

test("sala con la profesora presente y recuperada: paga, así que no está en lo no pagado", () => {
  assert.deepEqual(noEntra([noDictada("2026-11-12", "sala_no_disponible", {
    recuperada: true, profesoraSePresento: true, recuperacionInicio: "2026-11-20T19:00:00-03:00",
  })]), []);
});

test("sin causa, futura y especial también se ven", () => {
  const futura = clase("2026-11-30");
  const fs = noEntraEnEstePago(
    liquidar({ profesoraId: P1, mes: "2026-11", tarifa: T, ahora: new Date("2026-11-20T12:00:00-03:00"), clases: [
      clase("2026-11-03", { estado: "cancelada" }), futura, clase("2026-11-05", { tipo: "especial" }),
    ] }).lineas, "2026-11");
  assert.deepEqual(fs.map((f) => f.razon).sort(), ["especial", "futura", "sin_causa"]);
});

test("una dictada no está en lo no pagado", () => {
  assert.deepEqual(noEntra([clase("2026-11-03")]), []);
});

test("nombreDeMes", () => {
  assert.equal(nombreDeMes("2026-12"), "diciembre de 2026");
});
