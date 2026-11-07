/**
 * Tests de la búsqueda de Personas (PRD-0025).
 *
 * Lo que entra por `?q=` lo escribe cualquiera que tenga la URL, y termina
 * dentro de un filtro `or=(…)` de PostgREST. Lo que cuidan estos tests es que
 * ese texto se busque **como texto**: que una coma no abra una tercera
 * condición, que un paréntesis no cierre el `or`, y que `%` o `_` no hagan de
 * comodín.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  LARGO_MAXIMO_BUSQUEDA,
  filtroDePersonas,
  normalizarBusqueda,
  patronLike,
} from "./busqueda-personas.ts";

test("normalizarBusqueda: vacío, espacios o ausente es no buscar", () => {
  for (const valor of [undefined, null, "", "   ", "\t\n", ["", ""]]) {
    assert.equal(normalizarBusqueda(valor as never), null, JSON.stringify(valor));
  }
});

test("normalizarBusqueda: recorta los bordes y conserva el medio", () => {
  assert.equal(normalizarBusqueda("  María José  "), "María José");
});

test("normalizarBusqueda: si la URL repite ?q=, vale el primero", () => {
  assert.equal(normalizarBusqueda(["cami", "otra"]), "cami");
});

test("normalizarBusqueda: corta a 100 caracteres", () => {
  const largo = "a".repeat(250);
  assert.equal(normalizarBusqueda(largo)?.length, LARGO_MAXIMO_BUSQUEDA);
  assert.equal(LARGO_MAXIMO_BUSQUEDA, 100);
});

test("normalizarBusqueda: el asterisco se saca, porque PostgREST lo lee como comodín", () => {
  assert.equal(normalizarBusqueda("ca*mi"), "cami");
  assert.equal(normalizarBusqueda("***"), null);
});

test("patronLike: envuelve en % y escapa los comodines de LIKE", () => {
  assert.equal(patronLike("cami"), "%cami%");
  assert.equal(patronLike("50%"), "%50\\%%");
  assert.equal(patronLike("a_b"), "%a\\_b%");
  assert.equal(patronLike("a\\b"), "%a\\\\b%");
});

test("filtroDePersonas: nombre o correo, con el valor entre comillas", () => {
  assert.equal(filtroDePersonas("cami"), 'nombre.ilike."%cami%",email.ilike."%cami%"');
});

test("filtroDePersonas: comas y paréntesis quedan dentro de las comillas", () => {
  const f = filtroDePersonas("a,b)c(");
  assert.equal(f, 'nombre.ilike."%a,b)c(%",email.ilike."%a,b)c(%"');
});

test("filtroDePersonas: una comilla no cierra el valor", () => {
  assert.equal(filtroDePersonas('o"x'), 'nombre.ilike."%o\\"x%",email.ilike."%o\\"x%"');
});

test("filtroDePersonas: la barra invertida se escapa dos veces (LIKE y PostgREST)", () => {
  // LIKE necesita `\\` para una barra literal, y PostgREST, dentro de
  // comillas, necesita escapar cada una de esas dos.
  assert.equal(filtroDePersonas("a\\b"), 'nombre.ilike."%a\\\\\\\\b%",email.ilike."%a\\\\\\\\b%"');
});

test("filtroDePersonas: un intento de inyectar otra condición no sale de las comillas", () => {
  const f = filtroDePersonas('x",rol.eq.owner,nombre.ilike."y');
  // Exactamente dos condiciones: las comillas de adentro van escapadas.
  const sinEscapadas = f.replace(/\\./g, "");
  const fuera = sinEscapadas.replace(/"[^"]*"/g, "");
  assert.equal(fuera, "nombre.ilike.,email.ilike.");
});
