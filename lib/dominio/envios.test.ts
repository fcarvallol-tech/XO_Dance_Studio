/**
 * Tests de las reglas puras del correo transaccional (PRD-0019, fase 1).
 *
 * Escritos **antes** que el código, como PRD-0018: el corredor tiene que fallar
 * primero por módulo inexistente.
 *
 * Los números salen del PRD-0019 §8.3 y §8.4 y de las decisiones de Felipe del
 * 22/09/2026. Si un valor de acá no coincide con el PRD, manda el PRD.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  MAXIMO_REINTENTOS,
  aPurgar,
  caducaAt,
  caduco,
  claveDeEvento,
  debeReintentar,
  esCorreoReal,
  proximoIntento,
} from "./envios.ts";

const utc = (iso: string) => new Date(`${iso}Z`);
const AHORA = utc("2026-09-22T20:00:00");

/** Un envío recién encolado, para ir cambiándole lo que cada test necesita. */
const envio = (cambios: Partial<Parameters<typeof debeReintentar>[0]> = {}) => ({
  estado: "fallido" as const,
  intentos: 1,
  proximoIntentoAt: utc("2026-09-22T19:00:00"),
  caducaAt: null,
  creadoAt: utc("2026-09-22T18:00:00"),
  enviadoAt: null,
  tieneContenido: true,
  ...cambios,
});

// ---------------------------------------------------------------------------
// proximoIntento — el backoff
// ---------------------------------------------------------------------------

test("proximoIntento: sin intentos previos, se manda ya", () => {
  assert.equal(proximoIntento(0, AHORA)?.toISOString(), AHORA.toISOString());
});

test("proximoIntento: las cinco esperas del PRD, en orden", () => {
  const esperado = [
    "2026-09-22T20:05:00.000Z", // 5 min
    "2026-09-22T20:30:00.000Z", // 30 min
    "2026-09-22T22:00:00.000Z", // 2 h
    "2026-09-23T08:00:00.000Z", // 12 h
    "2026-09-23T20:00:00.000Z", // 24 h
  ];
  for (let intentos = 1; intentos <= 5; intentos++) {
    assert.equal(
      proximoIntento(intentos, AHORA)?.toISOString(),
      esperado[intentos - 1],
      `tras ${intentos} intento(s)`,
    );
  }
});

test("proximoIntento: agotados los reintentos devuelve null, no una fecha lejana", () => {
  assert.equal(proximoIntento(MAXIMO_REINTENTOS + 1, AHORA), null);
  assert.equal(MAXIMO_REINTENTOS, 5);
});

// ---------------------------------------------------------------------------
// caducaAt — la decisión 2: qué aviso deja de ser cierto, y cuándo
// ---------------------------------------------------------------------------

test("caducaAt: el pendiente de una especial caduca con el cupo, no con la clase", () => {
  const expira = utc("2026-09-23T21:00:00");
  assert.equal(
    caducaAt("especialPendiente", {
      expiraAt: expira,
      inicioClase: utc("2026-10-15T12:30:00"),
      encoladoAt: AHORA,
    })?.toISOString(),
    expira.toISOString(),
  );
});

test("caducaAt: los comprobantes de clase caducan cuando la clase empieza", () => {
  const inicio = utc("2026-10-15T12:30:00");
  for (const plantilla of ["reserva", "especialConfirmada"] as const) {
    assert.equal(
      caducaAt(plantilla, { expiraAt: null, inicioClase: inicio, encoladoAt: AHORA })?.toISOString(),
      inicio.toISOString(),
      plantilla,
    );
  }
});

test("caducaAt: lo que sigue siendo cierto no caduca nunca", () => {
  for (const plantilla of ["compraAprobada", "compraRechazada"] as const) {
    assert.equal(
      caducaAt(plantilla, { expiraAt: null, inicioClase: null, encoladoAt: AHORA }),
      null,
      plantilla,
    );
  }
});

test("caducaAt: el aviso a la academia caduca a las 24 h de encolarse", () => {
  assert.equal(
    caducaAt("transferenciaDeclarada", {
      expiraAt: null,
      inicioClase: null,
      encoladoAt: AHORA,
    })?.toISOString(),
    "2026-09-23T20:00:00.000Z",
  );
});

test("caducaAt: sin el dato con que caducar, no se inventa una fecha", () => {
  assert.equal(
    caducaAt("especialPendiente", { expiraAt: null, inicioClase: null, encoladoAt: AHORA }),
    null,
  );
});

// ---------------------------------------------------------------------------
// caduco — un aviso con plazo que llega tarde miente
// ---------------------------------------------------------------------------

test("caduco: el que vence exactamente ahora ya no se manda", () => {
  assert.equal(caduco(envio({ caducaAt: AHORA }), AHORA), true);
});

test("caduco: el que vence en un segundo todavía se manda", () => {
  assert.equal(caduco(envio({ caducaAt: utc("2026-09-22T20:00:01") }), AHORA), false);
});

test("caduco: sin fecha de caducidad, nunca caduca", () => {
  assert.equal(caduco(envio({ caducaAt: null }), AHORA), false);
});

// ---------------------------------------------------------------------------
// debeReintentar
// ---------------------------------------------------------------------------

test("debeReintentar: un fallido con su hora cumplida, sí", () => {
  assert.equal(debeReintentar(envio(), AHORA), true);
});

test("debeReintentar: si todavía no le toca, no", () => {
  assert.equal(
    debeReintentar(envio({ proximoIntentoAt: utc("2026-09-22T20:00:01") }), AHORA),
    false,
  );
});

test("debeReintentar: caducado gana sobre fallido — se descarta, no se reintenta", () => {
  assert.equal(debeReintentar(envio({ caducaAt: utc("2026-09-22T19:30:00") }), AHORA), false);
});

test("debeReintentar: agotados los reintentos, no", () => {
  assert.equal(debeReintentar(envio({ intentos: MAXIMO_REINTENTOS + 1 }), AHORA), false);
});

test("debeReintentar: un enviado o un descartado no se tocan", () => {
  for (const estado of ["enviado", "descartado"] as const) {
    assert.equal(debeReintentar(envio({ estado }), AHORA), false, estado);
  }
});

test("debeReintentar: un pendiente colgado se trata como fallido", () => {
  // El proceso murió entre el insert y el envío: nadie lo marcó nunca.
  const colgado = envio({
    estado: "pendiente",
    intentos: 0,
    proximoIntentoAt: null,
    creadoAt: utc("2026-09-22T19:00:00"),
  });
  assert.equal(debeReintentar(colgado, AHORA), true);
});

test("debeReintentar: un pendiente recién encolado se deja en paz", () => {
  const recien = envio({
    estado: "pendiente",
    intentos: 0,
    proximoIntentoAt: null,
    creadoAt: utc("2026-09-22T19:59:00"),
  });
  assert.equal(debeReintentar(recien, AHORA), false);
});

// ---------------------------------------------------------------------------
// aPurgar — el contenido se borra, la fila queda
// ---------------------------------------------------------------------------

test("aPurgar: un enviado de hace 31 días pierde el contenido", () => {
  const viejo = envio({
    estado: "enviado",
    enviadoAt: utc("2026-08-22T20:00:00"),
  });
  assert.equal(aPurgar(viejo, AHORA), true);
});

test("aPurgar: uno de hace 29 días todavía no", () => {
  const reciente = envio({ estado: "enviado", enviadoAt: utc("2026-08-24T20:00:00") });
  assert.equal(aPurgar(reciente, AHORA), false);
});

test("aPurgar: uno ya purgado no se vuelve a purgar", () => {
  const purgado = envio({
    estado: "enviado",
    enviadoAt: utc("2026-08-22T20:00:00"),
    tieneContenido: false,
  });
  assert.equal(aPurgar(purgado, AHORA), false);
});

// ---------------------------------------------------------------------------
// claveDeEvento y esCorreoReal
// ---------------------------------------------------------------------------

test("claveDeEvento: dos veces el mismo hecho dan la misma clave", () => {
  const id = "3c0c2413-8cfa-457d-9555-2b7010473cd8";
  assert.equal(claveDeEvento("reserva", id), claveDeEvento("reserva", id));
  assert.equal(claveDeEvento("reserva", id), `reserva:${id}`);
});

test("claveDeEvento: hechos distintos sobre la misma fila no se pisan", () => {
  const id = "3c0c2413-8cfa-457d-9555-2b7010473cd8";
  assert.notEqual(claveDeEvento("compraAprobada", id), claveDeEvento("compraRechazada", id));
});

test("esCorreoReal: a las alumnas importadas sin correo no se les escribe", () => {
  assert.equal(esCorreoReal("ana@ejemplo.invalid"), false);
  assert.equal(esCorreoReal("ANA@EJEMPLO.INVALID"), false);
});

test("esCorreoReal: vacío o sin arroba no es un correo", () => {
  assert.equal(esCorreoReal(""), false);
  assert.equal(esCorreoReal("   "), false);
  assert.equal(esCorreoReal("ana"), false);
  assert.equal(esCorreoReal(null), false);
});

test("esCorreoReal: uno de verdad sí", () => {
  assert.equal(esCorreoReal(" ana@gmail.com "), true);
});
