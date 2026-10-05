import test from "node:test";
import assert from "node:assert/strict";
import { conSedes, conVigencia } from "./ayuda.ts";

const sedes = [
  { nombre: "Seducción Latina Experience", comuna: "Providencia" },
  { nombre: "Centro Comunitario Diaguitas", comuna: "Las Condes" },
  { nombre: "EB Dance Studio", comuna: "Providencia" },
  { nombre: "Studio 98", comuna: "Providencia" },
];

test("conSedes: agrupa por comuna, en el orden de la tabla", () => {
  assert.equal(
    conSedes("{sedes} Las direcciones están en Nosotros.", sedes),
    "En Providencia: Seducción Latina Experience, EB Dance Studio y Studio 98. " +
      "En Las Condes: Centro Comunitario Diaguitas. Las direcciones están en Nosotros.",
  );
});

test("conSedes: sin sedes, la frase se omite y no queda el marcador", () => {
  assert.equal(conSedes("{sedes} Las direcciones están en Nosotros.", []), "Las direcciones están en Nosotros.");
});

test("conVigencia: los días que dice la base", () => {
  assert.equal(conVigencia("Packs. {vigencia}", 45), "Packs. Tienes 45 días para ocuparlas desde que te las acreditamos.");
  assert.equal(conVigencia("Packs. {vigencia}", null), "Packs.");
});
