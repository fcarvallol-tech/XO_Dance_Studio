import test from "node:test";
import assert from "node:assert/strict";
import { instanteEnSantiago, mesAnterior, mesEnCurso, nombreDelMes } from "./periodo.ts";

/** Qué hora de Santiago es un instante UTC, para leer los asertos. */
const enSantiago = (d: Date) =>
  d.toLocaleString("sv-SE", { timeZone: "America/Santiago" });

test("el mes parte a medianoche de Santiago, no de UTC", () => {
  const p = mesEnCurso(new Date("2026-09-15T12:00:00Z"));
  assert.equal(enSantiago(p.desde), "2026-09-01 00:00:00");
  assert.equal(enSantiago(p.hasta), "2026-10-01 00:00:00");
});

test("las últimas horas del mes en Santiago no se van al mes siguiente", () => {
  // 31 de agosto, 22:00 en Santiago = 1 de septiembre, 02:00 UTC. Con el corte
  // en UTC esta compra aparecería en septiembre.
  const compra = new Date("2026-09-01T02:00:00Z");
  assert.equal(enSantiago(compra), "2026-08-31 22:00:00");
  const agosto = mesEnCurso(new Date("2026-08-15T12:00:00Z"));
  assert.ok(compra >= agosto.desde && compra < agosto.hasta);
});

test("diciembre pasa a enero del año siguiente", () => {
  const p = mesEnCurso(new Date("2026-12-20T12:00:00Z"));
  assert.equal(enSantiago(p.desde), "2026-12-01 00:00:00");
  assert.equal(enSantiago(p.hasta), "2027-01-01 00:00:00");
});

test("el mes que empieza dentro del cambio de horario igual parte a medianoche", () => {
  // Chile cambia de hora en septiembre y en abril. Es el caso que obliga a
  // iterar el desfase en vez de calcularlo una sola vez.
  for (const mes of ["2026-04-15", "2026-09-20"]) {
    const p = mesEnCurso(new Date(`${mes}T12:00:00Z`));
    assert.match(enSantiago(p.desde), /-01 00:00:00$/);
    assert.match(enSantiago(p.hasta), /-01 00:00:00$/);
  }
});

test("el nombre del mes sale en español", () => {
  const p = mesEnCurso(new Date("2026-09-15T12:00:00Z"));
  assert.match(nombreDelMes(p), /septiembre/);
});

test("el mes anterior es el mes calendario, no 30 días antes", () => {
  // Septiembre dura 30 días: restarle 30 a su primer día da el 2 de agosto, y
  // la comparación quedaría contra un agosto al que le falta un día.
  const anterior = mesAnterior(mesEnCurso(new Date("2026-09-15T12:00:00Z")));
  assert.equal(enSantiago(anterior.desde), "2026-08-01 00:00:00");
  assert.equal(enSantiago(anterior.hasta), "2026-09-01 00:00:00");
});

test("el mes anterior a enero es diciembre del año pasado", () => {
  const anterior = mesAnterior(mesEnCurso(new Date("2027-01-10T12:00:00Z")));
  assert.equal(enSantiago(anterior.desde), "2026-12-01 00:00:00");
  assert.equal(enSantiago(anterior.hasta), "2027-01-01 00:00:00");
});

test("el mes anterior a marzo es febrero completo, con sus 28 días", () => {
  const anterior = mesAnterior(mesEnCurso(new Date("2026-03-10T12:00:00Z")));
  assert.equal(enSantiago(anterior.desde), "2026-02-01 00:00:00");
  assert.equal(enSantiago(anterior.hasta), "2026-03-01 00:00:00");
  const dias = (anterior.hasta.getTime() - anterior.desde.getTime()) / 864e5;
  assert.equal(dias, 28);
});

// ---------------------------------------------------------------------------
// instanteEnSantiago — la hora que alguien teclea en el formulario
// ---------------------------------------------------------------------------

test("instanteEnSantiago: en septiembre Chile está en -03:00", () => {
  // 2026 adelanta el reloj el primer sábado de septiembre.
  assert.equal(
    instanteEnSantiago("2026-09-20T20:00")?.toISOString(),
    "2026-09-20T23:00:00.000Z",
  );
});

test("instanteEnSantiago: en pleno invierno está en -04:00, y por eso no se puede fijar el desfase", () => {
  assert.equal(
    instanteEnSantiago("2026-07-15T20:00")?.toISOString(),
    "2026-07-16T00:00:00.000Z",
  );
});

test("instanteEnSantiago: acepta el formato con espacio y el texto roto devuelve null", () => {
  assert.equal(
    instanteEnSantiago("2026-09-20 20:00")?.toISOString(),
    "2026-09-20T23:00:00.000Z",
  );
  assert.equal(instanteEnSantiago("20 de septiembre"), null);
  assert.equal(instanteEnSantiago(""), null);
});
