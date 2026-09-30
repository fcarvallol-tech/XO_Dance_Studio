/**
 * Tests de la grilla horaria (PRD-0022 ajuste 5).
 *
 * Lo que se fija acá es **dónde cae cada clase en la grilla**: en qué fila
 * empieza y cuántas ocupa. Es aritmética de media hora y es exactamente el tipo
 * de cálculo que se ve bien hasta que aparece una clase de 90 minutos o una que
 * empieza a y media.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  MINUTOS_POR_TRAMO,
  semanasDeLaGrilla,
  tramoDe,
  tramosQueOcupa,
  ventanaDeHoras,
} from "./grilla.ts";

const utc = (iso: string) => `${iso}Z`;
// Septiembre en Chile es −03:00.
const SEP_18_00 = utc("2026-09-11T21:00:00");
const SEP_19_30 = utc("2026-09-11T22:30:00");
const SEP_20_00 = utc("2026-09-11T23:00:00");

test("los tramos son de media hora", () => {
  assert.equal(MINUTOS_POR_TRAMO, 30);
});

test("tramoDe: las 18:00 con la grilla abriendo a las 9:00 caen en el tramo 18", () => {
  // (18 − 9) × 2 = 18 tramos de media hora.
  assert.equal(tramoDe(SEP_18_00, 9), 18);
});

test("tramoDe: una clase a y media cae en un tramo impar", () => {
  assert.equal(tramoDe(utc("2026-09-11T22:30:00"), 9), 21);
});

test("tramosQueOcupa: una hora son dos tramos", () => {
  assert.equal(tramosQueOcupa(SEP_18_00, SEP_19_00()), 2);
});
function SEP_19_00() {
  return utc("2026-09-11T22:00:00");
}

test("tramosQueOcupa: hora y media son tres", () => {
  assert.equal(tramosQueOcupa(SEP_18_00, SEP_19_30), 3);
});

test("tramosQueOcupa: sin hora de término se asume una hora, como la parrilla", () => {
  assert.equal(tramosQueOcupa(SEP_18_00, null), 2);
});

test("tramosQueOcupa: una duración que no calza en media hora se redondea hacia arriba", () => {
  // 45 minutos ocupan dos tramos: mostrar uno la haría parecer más corta y
  // dejaría un hueco donde en realidad hay una clase.
  assert.equal(tramosQueOcupa(SEP_18_00, utc("2026-09-11T21:45:00")), 2);
});

test("tramosQueOcupa: un fin anterior al inicio no da un negativo", () => {
  assert.equal(tramosQueOcupa(SEP_18_00, utc("2026-09-11T20:00:00")), 2);
});

test("ventanaDeHoras: abre una hora antes de la primera clase y cierra después de la última", () => {
  const v = ventanaDeHoras([
    { inicio: SEP_18_00, fin: SEP_19_30 },
    { inicio: SEP_20_00, fin: null },
  ]);
  assert.deepEqual(v, { desde: 17, hasta: 22 });
});

test("ventanaDeHoras: sin clases devuelve una ventana razonable y no un vacío", () => {
  assert.deepEqual(ventanaDeHoras([]), { desde: 9, hasta: 22 });
});

test("ventanaDeHoras: no se pasa de la medianoche ni baja de cero", () => {
  const v = ventanaDeHoras([{ inicio: utc("2026-09-11T03:30:00"), fin: null }]);
  assert.ok(v.desde >= 0 && v.hasta <= 24, `${v.desde}–${v.hasta}`);
});

// --- semanasDeLaGrilla ------------------------------------------------------

test("semanasDeLaGrilla: sin clases, igual ofrece la semana de hoy", () => {
  // Una grilla vacía sigue siendo una grilla: se dibujan los siete días y no
  // se muestra la nada.
  assert.deepEqual(semanasDeLaGrilla([], "2026-09-30"), ["2026-09-28"]);
});

test("semanasDeLaGrilla: clases de una misma semana dan un solo lunes", () => {
  assert.deepEqual(
    semanasDeLaGrilla(["2026-09-29", "2026-10-02", "2026-10-03"], "2026-09-30"),
    ["2026-09-28"],
  );
});

test("semanasDeLaGrilla: dos semanas seguidas dan sus dos lunes", () => {
  assert.deepEqual(
    semanasDeLaGrilla(["2026-09-29", "2026-10-06"], "2026-09-30"),
    ["2026-09-28", "2026-10-05"],
  );
});

test("semanasDeLaGrilla: una semana sin clases en medio NO se salta", () => {
  // Es la razón de que esto exista. Saltársela hace que "Después" avance dos
  // semanas de una, y quien navega no tiene cómo saber que se perdió una.
  assert.deepEqual(
    semanasDeLaGrilla(["2026-09-29", "2026-10-13"], "2026-09-30"),
    ["2026-09-28", "2026-10-05", "2026-10-12"],
  );
});

test("semanasDeLaGrilla: la primera semana es la de hoy aunque no tenga clases", () => {
  assert.deepEqual(
    semanasDeLaGrilla(["2026-10-07"], "2026-09-30"),
    ["2026-09-28", "2026-10-05"],
  );
});

test("semanasDeLaGrilla: el orden de las clases no cambia el resultado", () => {
  assert.deepEqual(
    semanasDeLaGrilla(["2026-10-13", "2026-09-29", "2026-10-06"], "2026-09-30"),
    ["2026-09-28", "2026-10-05", "2026-10-12"],
  );
});

test("semanasDeLaGrilla: una clase anterior a hoy arrastra el inicio hacia atrás", () => {
  // No debería llegar ninguna —el calendario pide las próximas—, pero si llega
  // vale más mostrarla que dejarla fuera del rango y que desaparezca.
  assert.deepEqual(
    semanasDeLaGrilla(["2026-09-21"], "2026-09-30"),
    ["2026-09-21", "2026-09-28"],
  );
});

test("semanasDeLaGrilla: el domingo pertenece a la semana que empezó el lunes", () => {
  // El domingo 4 es de la semana del lunes 28, no de la del 5.
  assert.deepEqual(semanasDeLaGrilla(["2026-10-04"], "2026-09-30"), ["2026-09-28"]);
});
