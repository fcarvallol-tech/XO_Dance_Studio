/**
 * Tests del rango horario (PRD-0021, fase 1).
 *
 * Por qué es función pura y con tests: **el mismo texto se escribe en el
 * servidor y en el navegador**, y una diferencia entre los dos es un error de
 * hidratación. Este proyecto ya decidió formatear fechas a mano por eso mismo
 * (`lib/compras.ts`), así que la regla de "cuándo se muestra el rango" no puede
 * vivir suelta en un componente.
 *
 * Escritos antes que el código.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { duracionMin, horaEnSantiago, rangoHorario } from "./horarios.ts";

// 2026: Chile adelanta el reloj el primer sábado de septiembre, así que en
// septiembre está en −03:00 y en julio en −04:00.
const SEP_18_00 = "2026-09-11T21:00:00Z"; // viernes 11, 18:00 en Santiago
const SEP_19_30 = "2026-09-11T22:30:00Z";
const SEP_19_00 = "2026-09-11T22:00:00Z";

test("horaEnSantiago: el instante UTC se lee en hora de Santiago", () => {
  assert.equal(horaEnSantiago(SEP_18_00), "18:00");
});

test("horaEnSantiago: en invierno el desfase es otro, y no se fija a mano", () => {
  // 2026-07-15T22:00Z son las 18:00 en Santiago, con −04:00.
  assert.equal(horaEnSantiago("2026-07-15T22:00:00Z"), "18:00");
});

test("rangoHorario: una clase de una hora muestra solo la hora de inicio", () => {
  // Es el 95% de la parrilla: agregarle "–19:00" a todas vuelve la grilla más
  // difícil de barrer con la vista, sin decir nada que no se supiera.
  assert.equal(rangoHorario(SEP_18_00, SEP_19_00), "18:00");
});

test("rangoHorario: una de hora y media muestra los dos extremos", () => {
  assert.equal(rangoHorario(SEP_18_00, SEP_19_30), "18:00–19:30");
});

test("rangoHorario: una de 45 minutos también, porque tampoco se supone", () => {
  assert.equal(rangoHorario(SEP_18_00, "2026-09-11T21:45:00Z"), "18:00–18:45");
});

test("rangoHorario: sin hora de término muestra solo el inicio", () => {
  // Las clases de parrilla no tienen `fin`: se asumen de una hora.
  assert.equal(rangoHorario(SEP_18_00, null), "18:00");
});

test("rangoHorario: un fin anterior al inicio es un dato roto y se ignora", () => {
  // Antes que mostrar "18:00–17:00", que se lee como un error del sitio.
  assert.equal(rangoHorario(SEP_18_00, "2026-09-11T20:00:00Z"), "18:00");
});

test("rangoHorario: un fin igual al inicio tampoco muestra rango", () => {
  assert.equal(rangoHorario(SEP_18_00, SEP_18_00), "18:00");
});

test("rangoHorario: una clase que termina al otro día se muestra igual", () => {
  // No debería pasar, pero si pasa el texto tiene que ser legible.
  assert.equal(rangoHorario("2026-09-11T02:30:00Z", "2026-09-11T04:00:00Z"), "23:30–01:00");
});

test("duracionMin: los minutos entre los dos extremos", () => {
  assert.equal(duracionMin(SEP_18_00, SEP_19_30), 90);
  assert.equal(duracionMin(SEP_18_00, SEP_19_00), 60);
});

test("duracionMin: sin fin no hay duración que calcular", () => {
  assert.equal(duracionMin(SEP_18_00, null), null);
});

test("duracionMin: un fin anterior al inicio no devuelve un negativo", () => {
  assert.equal(duracionMin(SEP_18_00, "2026-09-11T20:00:00Z"), null);
});
