import test from "node:test";
import assert from "node:assert/strict";

import { conCreditoVencido, porRecuperar } from "./recuperativas.ts";

const caida = (id: string, causa: Parameters<typeof porRecuperar>[0][number]["causa"]) => ({ id, causa });

test("una caída sin recuperativa en pie se ofrece", () => {
  assert.deepEqual(porRecuperar([caida("a", "asistencia_insuficiente")], []).map((c) => c.id), ["a"]);
});

test("la que ya tiene recuperativa en pie sale de la lista", () => {
  const r = porRecuperar([caida("a", "sin_alumnas"), caida("b", "sin_alumnas")], [{ recuperaClaseId: "a" }]);
  assert.deepEqual(r.map((c) => c.id), ["b"]);
});

test("cambio de parrilla no se ofrece: esa clase nunca estuvo en su semana", () => {
  assert.deepEqual(porRecuperar([caida("a", "cambio_de_parrilla")], []), []);
});

test("una sin causa se ofrece: todavía no se sabe por qué cayó", () => {
  assert.equal(porRecuperar([caida("a", null)], []).length, 1);
});

test("crédito vencido: cuenta el que ya venció hoy, no el que vence antes de la clase", () => {
  const ahora = new Date("2026-11-20T12:00:00-03:00");
  assert.equal(conCreditoVencido([{ vence: "2026-12-03T12:00:00-03:00" }], ahora), 0);
  assert.equal(conCreditoVencido([{ vence: "2026-11-20T11:00:00-03:00" }], ahora), 1);
  assert.equal(conCreditoVencido([{ vence: "2026-11-20T12:00:00-03:00" }], ahora), 1);
});
