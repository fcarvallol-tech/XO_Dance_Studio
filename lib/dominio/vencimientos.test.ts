/**
 * Tests del aviso de vencimiento (PRD-0032). Escritos antes que el código.
 *
 * Qué lotes se avisan lo decide la base (`avisos_de_vencimiento_pendientes`) y
 * se prueba en `scripts/base-local/escenario-vencimiento.mjs`. Acá va lo que
 * no toca la base: la clave, la fecha en palabras y el texto.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  asuntoDeVencimiento,
  claveDeVencimiento,
  fechaConDia,
  fechaCorta,
  fraseDeVencimiento,
  hoyEnSantiago,
  nombreDePila,
} from "./vencimientos.ts";

test("la clave es por persona y por fecha (§3.2, §8.3)", () => {
  assert.equal(claveDeVencimiento("p-1", "2026-12-03"), "vencimiento:p-1:2026-12-03");
  assert.notEqual(
    claveDeVencimiento("p-1", "2026-12-03"),
    claveDeVencimiento("p-1", "2026-12-06"),
  );
});

test("la fecha con el día de la semana sale del calendario, no de un ejemplo", () => {
  // El PRD decía "miércoles 3 de diciembre": el 3/12/2026 es jueves.
  assert.equal(fechaConDia("2026-12-03"), "jueves 3 de diciembre");
  assert.equal(fechaConDia("2026-12-06"), "domingo 6 de diciembre");
  assert.equal(fechaConDia("2027-01-01"), "viernes 1 de enero");
  assert.equal(fechaCorta("2026-12-03"), "3 de diciembre");
});

test("el asunto del §8.2, en plural y en singular", () => {
  assert.equal(
    asuntoDeVencimiento(3, "2026-12-03"),
    "Te quedan 3 clases en XO: vencen el 3 de diciembre",
  );
  assert.equal(
    asuntoDeVencimiento(1, "2026-12-03"),
    "Te queda 1 clase en XO: vence el 3 de diciembre",
  );
});

test("la frase del cuerpo (§3.3), con y sin nombre", () => {
  assert.equal(
    fraseDeVencimiento(3, "2026-12-03", "Camila"),
    "Camila, te quedan 3 clases. Vencen el jueves 3 de diciembre.",
  );
  assert.equal(
    fraseDeVencimiento(1, "2026-12-03", null),
    "Te queda 1 clase. Vence el jueves 3 de diciembre.",
  );
});

test("nombre de pila: la primera palabra, y nada si no hay", () => {
  assert.equal(nombreDePila("Camila Rojas Soto"), "Camila");
  assert.equal(nombreDePila("  Bea  "), "Bea");
  assert.equal(nombreDePila(""), null);
  assert.equal(nombreDePila(null), null);
});

test("hoy en Santiago, no en UTC", () => {
  // 23/11 a las 03:30 de Chile son las 06:30 UTC del mismo día.
  assert.equal(hoyEnSantiago(new Date("2026-11-23T06:30:00Z")), "2026-11-23");
  // 22/11 a las 22:00 de Chile ya es 23/11 en UTC.
  assert.equal(hoyEnSantiago(new Date("2026-11-23T01:00:00Z")), "2026-11-22");
});
