/**
 * Tests de lo que el calendario del portal de alumna muestra en cada clase
 * (PRD-0007 §8).
 *
 * No deciden nada sobre plata ni cupos: eso lo valida `reservar()` en la base.
 * Deciden **qué se le ofrece apretar**, y un error acá es dejarla intentar
 * algo que la base le va a rechazar, o esconderle algo que sí puede hacer.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { AVISO_CANCELACION, AVISO_FUERA_DE_PLAZO, cancelaATiempo, destaque, estadoParaAlumna } from "./reservas.ts";

const clase = (cambios = {}) => ({
  cupoMaximo: 22,
  tomados: 5,
  reservaId: null,
  especial: false,
  ...cambios,
});

test("estadoParaAlumna: con lugar y con saldo, se puede reservar", () => {
  assert.equal(estadoParaAlumna(clase(), 3), "reservable");
});

test("estadoParaAlumna: sin saldo no se ofrece reservar, aunque haya lugar", () => {
  assert.equal(estadoParaAlumna(clase(), 0), "sin-saldo");
});

test("estadoParaAlumna: llena gana sobre sin saldo", () => {
  // Decirle "compra clases" para una clase que no tiene lugar sería mandarla a
  // pagar por algo que igual no va a poder reservar.
  assert.equal(estadoParaAlumna(clase({ tomados: 22 }), 0), "llena");
  assert.equal(estadoParaAlumna(clase({ tomados: 22 }), 5), "llena");
});

test("estadoParaAlumna: la suya es suya aunque la clase se haya llenado o no tenga saldo", () => {
  // Es la que puede cancelar: si se viera como "llena" o "sin saldo" no
  // encontraría cómo hacerlo.
  assert.equal(estadoParaAlumna(clase({ tomados: 22, reservaId: "r1" }), 0), "reservada");
  assert.equal(estadoParaAlumna(clase({ reservaId: "r1" }), 4), "reservada");
});

test("estadoParaAlumna: una especial no se reserva con el pack, haya saldo o no", () => {
  // Se paga aparte (PRD-0018), y la base lo rechaza: "Las clases especiales se
  // pagan aparte, no con tus clases del pack". Ofrecer el botón era dejarla
  // apretar algo que iba a fallar.
  assert.equal(estadoParaAlumna(clase({ especial: true }), 4), "especial");
  assert.equal(estadoParaAlumna(clase({ especial: true }), 0), "especial");
  assert.equal(estadoParaAlumna(clase({ especial: true, tomados: 22 }), 4), "especial");
});

test("estadoParaAlumna: una especial que ya es suya sigue siendo suya", () => {
  assert.equal(estadoParaAlumna(clase({ especial: true, reservaId: "r1" }), 0), "reservada");
});

test("estadoParaAlumna: una pasada es pasada, aunque haya sido suya o tenga lugar", () => {
  // Ya empezó: no se reserva ni se cancela. Se ve, pero no se selecciona
  // (PRD-0006 §13).
  assert.equal(estadoParaAlumna(clase(), 4, true), "pasada");
  assert.equal(estadoParaAlumna(clase({ reservaId: "r1" }), 4, true), "pasada");
  assert.equal(estadoParaAlumna(clase({ especial: true }), 4, true), "pasada");
});

test("destaque: sin filtro, ninguna se destaca ni se atenúa", () => {
  assert.equal(destaque("pau", null), "normal");
});

test("destaque: con filtro, la elegida se destaca y el resto se atenúa", () => {
  assert.equal(destaque("pau", "pau"), "destacada");
  assert.equal(destaque("lina", "pau"), "atenuada");
});

// --- cancelaATiempo ---------------------------------------------------------
// Clase del martes 03/11/2026 a las 18:00 en Santiago (UTC−3).
const CLASE = "2026-11-03T21:00:00Z";

test("cancelaATiempo: 12 horas y un minuto antes, recupera la clase", () => {
  assert.equal(cancelaATiempo(CLASE, new Date("2026-11-03T08:59:00Z")), true);
});

test("cancelaATiempo: justo 12 horas antes ya no, igual que en la base", () => {
  // `now() < inicio - 12 h` es estricto: en el borde exacto, no.
  assert.equal(cancelaATiempo(CLASE, new Date("2026-11-03T09:00:00Z")), false);
});

test("cancelaATiempo: 30 minutos antes, que era el plazo viejo, ya no", () => {
  assert.equal(cancelaATiempo(CLASE, new Date("2026-11-03T20:30:00Z")), false);
});

test("AVISO_CANCELACION dice las mismas horas que la regla", () => {
  assert.match(AVISO_CANCELACION, /hasta 12 horas antes/);
});

test("AVISO_FUERA_DE_PLAZO dice las mismas horas que la regla", () => {
  assert.match(AVISO_FUERA_DE_PLAZO, /plazo de 12 horas/);
});
