/**
 * Tests de lo que la ficha de una profesora dice de ella, derivado de sus
 * horarios y no de un texto suelto (05/10/2026).
 *
 * El defecto que los motiva: "Dónde" mostraba "Providencia y Las Condes" a
 * todas, y podía mandar a una alumna a la comuna equivocada.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { comunasDeProfesora, cuandoConMayuscula, enumerar, estiloDeProfesora } from "./catalogo.ts";

const sedes = [
  { slug: "seduccion-latina", nombre: "Seducción Latina", direccion: "", comuna: "Providencia", referencia: null, activa: true },
  { slug: "diaguitas", nombre: "Diaguitas", direccion: "", comuna: "Las Condes", referencia: null, activa: true },
  { slug: "studio-98", nombre: "Studio 98", direccion: "", comuna: "Providencia", referencia: null, activa: true },
];
const cursos = [
  { slug: "girly", nombre: "Girly" },
  { slug: "reggaeton-femme", nombre: "Reggaeton Femme" },
];
const h = (profesoraSlug: string, sedeSlug: string, cursoSlug: string, diaSemana = 1, hora = "18:00") =>
  ({ id: `${profesoraSlug}-${sedeSlug}-${cursoSlug}-${diaSemana}`, profesoraSlug, sedeSlug, cursoSlug, diaSemana, hora });
const horarios = [
  h("pau", "diaguitas", "girly", 2, "20:00"),
  h("pau", "diaguitas", "reggaeton-femme", 4, "19:30"),
  h("drimy", "seduccion-latina", "reggaeton-femme"),
  h("carli", "seduccion-latina", "girly", 5),
  h("carli", "studio-98", "girly", 6),
];

test("comunasDeProfesora: Pau solo dicta en Las Condes", () => {
  assert.deepEqual(comunasDeProfesora(horarios, sedes, "pau"), ["Las Condes"]);
});

test("comunasDeProfesora: Drimy solo en Providencia", () => {
  assert.deepEqual(comunasDeProfesora(horarios, sedes, "drimy"), ["Providencia"]);
});

test("comunasDeProfesora: dos sedes en la misma comuna dan una comuna", () => {
  assert.deepEqual(comunasDeProfesora(horarios, sedes, "carli"), ["Providencia"]);
});

test("comunasDeProfesora: sin horarios, ninguna", () => {
  assert.deepEqual(comunasDeProfesora(horarios, sedes, "nadie"), []);
});

test("estiloDeProfesora: los cursos que dicta, sin repetir", () => {
  assert.equal(estiloDeProfesora(horarios, cursos, { slug: "pau", estilo: "urbano teens" }), "Girly · Reggaeton Femme");
});

test("estiloDeProfesora: sin horarios, el texto que tenga guardado", () => {
  assert.equal(estiloDeProfesora(horarios, cursos, { slug: "nueva", estilo: "Salsa" }), "Salsa");
});

test("cuandoConMayuscula: el día va con mayúscula inicial", () => {
  assert.equal(cuandoConMayuscula(h("x", "diaguitas", "girly", 1, "18:00")), "Lunes 18:00");
  assert.equal(cuandoConMayuscula(h("x", "diaguitas", "girly", 3, "20:00")), "Miércoles 20:00");
});

test("enumerar: como se dice en castellano", () => {
  assert.equal(enumerar([]), "");
  assert.equal(enumerar(["Providencia"]), "Providencia");
  assert.equal(enumerar(["a", "b", "c"]), "a, b y c");
});
