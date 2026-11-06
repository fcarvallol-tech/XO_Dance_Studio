import test from "node:test";
import assert from "node:assert/strict";

import { costoDeSalaEnClase } from "./salas.ts";

test("una hora cuesta el precio por hora", () => {
  assert.equal(costoDeSalaEnClase(17_000, 60), 17_000);
});

test("hora y media escala, y el resultado es un entero de pesos", () => {
  assert.equal(costoDeSalaEnClase(17_000, 90), 25_500);
  assert.equal(costoDeSalaEnClase(23_500, 50), 19_583);
});

test("una sala gratis cuesta cero", () => {
  assert.equal(costoDeSalaEnClase(0, 60), 0);
});
