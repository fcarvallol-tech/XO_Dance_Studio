import test from "node:test";
import assert from "node:assert/strict";
import { conSedes, conVigencia } from "./ayuda.ts";

const sedes = [
  { direccion: "Av. Nueva Providencia 2260, local 130", comuna: "Providencia" },
  { direccion: "Diaguitas 911", comuna: "Las Condes" },
  { direccion: "Barros Borgoño 71, oficina 101", comuna: "Providencia" },
];

test("conSedes: las direcciones, no los nombres de las salas, en el orden de la tabla", () => {
  assert.equal(
    conSedes("{sedes} Cada clase dice en cuál es.", sedes),
    "Son en Av. Nueva Providencia 2260, local 130, Providencia; Diaguitas 911, Las Condes; " +
      "y Barros Borgoño 71, oficina 101, Providencia. Cada clase dice en cuál es.",
  );
});

test("conSedes: una sola sede, sin punto y coma", () => {
  assert.equal(conSedes("{sedes}", sedes.slice(1, 2)), "Son en Diaguitas 911, Las Condes.");
});

test("conSedes: sin sedes, la frase se omite y no queda el marcador", () => {
  assert.equal(conSedes("{sedes} Cada clase dice en cuál es.", []), "Cada clase dice en cuál es.");
});

test("conVigencia: los días que dice la base", () => {
  assert.equal(conVigencia("Packs. {vigencia}", 30), "Packs. Tienes 30 días para ocuparlas desde que te las acreditamos.");
  assert.equal(conVigencia("Packs. {vigencia}", null), "Packs.");
});
