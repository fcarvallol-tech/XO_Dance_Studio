/**
 * Tests de las reglas puras de las clases especiales (PRD-0018, fase 1).
 *
 * **Los números no se inventan acá.** Salen del PRD-0018 §8.2 (retención), del
 * PRD-0009 §8 (precio $12.000, sala Los Leones $17.000, base $18.000) y de
 * `CONTEXT.md` §5.b. Si un valor de acá no coincide con el PRD, manda el PRD.
 *
 * Corren con `npm test`. Sin dependencias: Node 24 trae el corredor y ejecuta
 * TypeScript sin transpilar.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  alumnasParaIgualarBase,
  codigoDeReel,
  cupoTomado,
  desdePrecio,
  expiraAt,
  montoAtribuible,
  puedePublicar,
  seSolapan,
  urlDeEmbed,
} from "./especiales.ts";

/** Un instante UTC, para no depender de la zona de la máquina que corre el test. */
function utc(iso: string): Date {
  return new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
}

const HORA = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// codigoDeReel
// ---------------------------------------------------------------------------

test("codigoDeReel: acepta instagram.com/reel/<código>/ y devuelve solo el código", () => {
  assert.equal(codigoDeReel("https://www.instagram.com/reel/C9xY_ab12-Q/"), "C9xY_ab12-Q");
});

test("codigoDeReel: acepta /p/<código> y sin www, con o sin barra final", () => {
  assert.equal(codigoDeReel("https://instagram.com/p/C9xY_ab12-Q"), "C9xY_ab12-Q");
  assert.equal(codigoDeReel("http://www.instagram.com/p/C9xY_ab12-Q/"), "C9xY_ab12-Q");
});

test("codigoDeReel: ignora parámetros de tracking y espacios alrededor", () => {
  assert.equal(
    codigoDeReel("  https://www.instagram.com/reel/C9xY_ab12-Q/?igsh=abc123&utm_source=ig_web  "),
    "C9xY_ab12-Q",
  );
});

test("codigoDeReel: rechaza todo lo que no sea un Reel o un post de Instagram", () => {
  assert.equal(codigoDeReel("https://www.instagram.com/xo.dancestudioo/"), null);
  assert.equal(codigoDeReel("https://www.instagram.com/stories/xo/123/"), null);
  assert.equal(codigoDeReel("https://www.instagram.com/reel/"), null);
  assert.equal(codigoDeReel("https://www.youtube.com/reel/C9xY_ab12-Q/"), null);
  assert.equal(codigoDeReel("https://www.instagram.com.evil.com/reel/C9xY_ab12-Q/"), null);
  assert.equal(codigoDeReel("C9xY_ab12-Q"), null);
  assert.equal(codigoDeReel(""), null);
});

test("codigoDeReel: rechaza un código con caracteres que no van en una URL de embed", () => {
  assert.equal(codigoDeReel("https://www.instagram.com/reel/C9xY%20ab/"), null);
  assert.equal(codigoDeReel("https://www.instagram.com/reel/../embed/"), null);
});

// ---------------------------------------------------------------------------
// urlDeEmbed
// ---------------------------------------------------------------------------

test("urlDeEmbed: arma la URL de /embed/ y nada más", () => {
  assert.equal(urlDeEmbed("C9xY_ab12-Q"), "https://www.instagram.com/reel/C9xY_ab12-Q/embed/");
});

test("urlDeEmbed: no acepta un código que no pasó por codigoDeReel", () => {
  assert.throws(() => urlDeEmbed("../x"));
  assert.throws(() => urlDeEmbed(""));
});

// ---------------------------------------------------------------------------
// seSolapan — bloques [inicio, fin)
// ---------------------------------------------------------------------------

test("seSolapan: 19:30–20:30 pisa 20:00–21:00 (la duración manda)", () => {
  const a = { inicio: utc("2026-09-17T22:30:00"), fin: utc("2026-09-17T23:30:00") };
  const b = { inicio: utc("2026-09-17T23:00:00"), fin: utc("2026-09-18T00:00:00") };
  assert.equal(seSolapan(a, b), true);
  assert.equal(seSolapan(b, a), true);
});

test("seSolapan: 19:00–20:00 no pisa 20:00–21:00 (el fin es abierto)", () => {
  const a = { inicio: utc("2026-09-17T22:00:00"), fin: utc("2026-09-17T23:00:00") };
  const b = { inicio: utc("2026-09-17T23:00:00"), fin: utc("2026-09-18T00:00:00") };
  assert.equal(seSolapan(a, b), false);
  assert.equal(seSolapan(b, a), false);
});

test("seSolapan: un bloque contenido en otro se solapa", () => {
  const largo = { inicio: utc("2026-09-17T22:00:00"), fin: utc("2026-09-18T00:00:00") };
  const corto = { inicio: utc("2026-09-17T22:30:00"), fin: utc("2026-09-17T23:00:00") };
  assert.equal(seSolapan(largo, corto), true);
});

// ---------------------------------------------------------------------------
// expiraAt — PRD-0018 §8.2
// ---------------------------------------------------------------------------

test("expiraAt: declarada + retención cuando la clase está lejos", () => {
  const declarada = utc("2026-09-14T15:00:00");
  const inicio = utc("2026-09-17T22:30:00");
  assert.deepEqual(expiraAt(declarada, inicio, 24), utc("2026-09-15T15:00:00"));
});

test("expiraAt: inicio − 2 h cuando la clase es en menos de 26 h", () => {
  const inicio = utc("2026-09-17T22:30:00");
  const declarada = new Date(inicio.getTime() - 20 * HORA);
  assert.deepEqual(expiraAt(declarada, inicio, 24), utc("2026-09-17T20:30:00"));
});

test("expiraAt: justo en el borde de 26 h, las dos reglas coinciden", () => {
  const inicio = utc("2026-09-17T22:30:00");
  const declarada = new Date(inicio.getTime() - 26 * HORA);
  assert.deepEqual(expiraAt(declarada, inicio, 24), utc("2026-09-17T20:30:00"));
});

test("expiraAt: con la clase en menos de 2 h, expira antes de declarar; quien llama rechaza", () => {
  const inicio = utc("2026-09-17T22:30:00");
  const declarada = new Date(inicio.getTime() - 1 * HORA);
  const expira = expiraAt(declarada, inicio, 24);
  assert.ok(expira.getTime() < declarada.getTime());
});

test("expiraAt: la retención tiene que ser positiva", () => {
  const declarada = utc("2026-09-14T15:00:00");
  const inicio = utc("2026-09-17T22:30:00");
  assert.throws(() => expiraAt(declarada, inicio, 0));
  assert.throws(() => expiraAt(declarada, inicio, -1));
});

// ---------------------------------------------------------------------------
// cupoTomado — la función que los cinco lugares replican
// ---------------------------------------------------------------------------

test("cupoTomado: confirmadas y asistió cuentan; canceladas y no asistió no", () => {
  const ahora = utc("2026-09-15T12:00:00");
  const reservas = [
    { estado: "confirmada", expiraAt: null },
    { estado: "asistio", expiraAt: null },
    { estado: "cancelada", expiraAt: null },
    { estado: "no_asistio", expiraAt: null },
    { estado: "expirada", expiraAt: utc("2026-09-14T12:00:00") },
  ];
  assert.equal(cupoTomado(reservas, ahora), 2);
});

test("cupoTomado: una pendiente de pago vigente cuenta", () => {
  const ahora = utc("2026-09-15T12:00:00");
  const reservas = [{ estado: "pendiente_pago", expiraAt: utc("2026-09-15T12:00:01") }];
  assert.equal(cupoTomado(reservas, ahora), 1);
});

test("cupoTomado: una pendiente vencida hace un segundo ya no cuenta, aunque siga en la tabla", () => {
  const ahora = utc("2026-09-15T12:00:00");
  const reservas = [{ estado: "pendiente_pago", expiraAt: utc("2026-09-15T11:59:59") }];
  assert.equal(cupoTomado(reservas, ahora), 0);
});

test("cupoTomado: una pendiente que vence exactamente ahora ya no cuenta (expira_at > now)", () => {
  const ahora = utc("2026-09-15T12:00:00");
  const reservas = [{ estado: "pendiente_pago", expiraAt: ahora }];
  assert.equal(cupoTomado(reservas, ahora), 0);
});

test("cupoTomado: una pendiente sin expira_at es un dato roto y no cuenta", () => {
  const ahora = utc("2026-09-15T12:00:00");
  assert.equal(cupoTomado([{ estado: "pendiente_pago", expiraAt: null }], ahora), 0);
});

// ---------------------------------------------------------------------------
// desdePrecio — el "desde $X" de Planes
// ---------------------------------------------------------------------------

test("desdePrecio: el mínimo entre las publicadas futuras", () => {
  const ahora = utc("2026-09-15T12:00:00");
  const especiales = [
    { precioClp: 15_000, inicio: utc("2026-09-20T22:00:00"), publicadaAt: utc("2026-09-10T00:00:00"), cancelada: false },
    { precioClp: 12_000, inicio: utc("2026-09-25T22:00:00"), publicadaAt: utc("2026-09-10T00:00:00"), cancelada: false },
  ];
  assert.equal(desdePrecio(especiales, ahora), 12_000);
});

test("desdePrecio: un borrador más barato no cuenta", () => {
  const ahora = utc("2026-09-15T12:00:00");
  const especiales = [
    { precioClp: 15_000, inicio: utc("2026-09-20T22:00:00"), publicadaAt: utc("2026-09-10T00:00:00"), cancelada: false },
    { precioClp: 8_000, inicio: utc("2026-09-25T22:00:00"), publicadaAt: null, cancelada: false },
  ];
  assert.equal(desdePrecio(especiales, ahora), 15_000);
});

test("desdePrecio: una que ya pasó o una cancelada no cuentan", () => {
  const ahora = utc("2026-09-15T12:00:00");
  const especiales = [
    { precioClp: 9_000, inicio: utc("2026-09-14T22:00:00"), publicadaAt: utc("2026-09-01T00:00:00"), cancelada: false },
    { precioClp: 10_000, inicio: utc("2026-09-20T22:00:00"), publicadaAt: utc("2026-09-01T00:00:00"), cancelada: true },
    { precioClp: 15_000, inicio: utc("2026-09-20T22:00:00"), publicadaAt: utc("2026-09-01T00:00:00"), cancelada: false },
  ];
  assert.equal(desdePrecio(especiales, ahora), 15_000);
});

test("desdePrecio: sin publicadas futuras devuelve null, y la fila de Planes no aparece", () => {
  const ahora = utc("2026-09-15T12:00:00");
  assert.equal(desdePrecio([], ahora), null);
  assert.equal(
    desdePrecio([{ precioClp: 12_000, inicio: utc("2026-09-25T22:00:00"), publicadaAt: null, cancelada: false }], ahora),
    null,
  );
});

// ---------------------------------------------------------------------------
// puedePublicar — devuelve qué falta, no un booleano
// ---------------------------------------------------------------------------

const completa = {
  reelCodigo: "C9xY_ab12-Q",
  portadaPath: "3f2a.jpg",
  profesoraId: "p1",
  sedeId: "s1",
  inicio: utc("2026-09-25T22:00:00"),
  precioClp: 12_000,
};

test("puedePublicar: con todo, no falta nada", () => {
  const ahora = utc("2026-09-15T12:00:00");
  assert.deepEqual(puedePublicar(completa, ahora), []);
});

test("puedePublicar: lista cada cosa que falta, en orden estable", () => {
  const ahora = utc("2026-09-15T12:00:00");
  const faltan = puedePublicar(
    { ...completa, reelCodigo: null, portadaPath: null, profesoraId: null, sedeId: null, precioClp: null },
    ahora,
  );
  assert.deepEqual(faltan, ["reel", "portada", "profesora", "sede", "precio"]);
});

test("puedePublicar: una fecha pasada, o sin fecha, es 'fecha'", () => {
  const ahora = utc("2026-09-15T12:00:00");
  assert.deepEqual(puedePublicar({ ...completa, inicio: utc("2026-09-15T11:00:00") }, ahora), ["fecha"]);
  assert.deepEqual(puedePublicar({ ...completa, inicio: null }, ahora), ["fecha"]);
});

test("puedePublicar: un precio de $0 es un precio (clase gratis); uno negativo no", () => {
  const ahora = utc("2026-09-15T12:00:00");
  assert.deepEqual(puedePublicar({ ...completa, precioClp: 0 }, ahora), []);
  assert.deepEqual(puedePublicar({ ...completa, precioClp: -1 }, ahora), ["precio"]);
});

// ---------------------------------------------------------------------------
// montoAtribuible — la rama nueva de PRD-0010 §7.1
// ---------------------------------------------------------------------------

test("montoAtribuible: una reserva con crédito sigue la regla de PRD-0010 §7.1", () => {
  const conCredito = {
    montoCompraClp: 48_000,
    clasesCompra: 8,
    recuperoCredito: false,
    claseYaOcurrio: true,
  };
  assert.equal(montoAtribuible(conCredito), 6_000);
  assert.equal(montoAtribuible({ ...conCredito, recuperoCredito: true }), 0);
});

test("montoAtribuible: una reserva con compra de clase atribuye el monto entero", () => {
  assert.equal(montoAtribuible({ montoClp: 12_000, reembolsoClp: null }), 12_000);
});

test("montoAtribuible: un reembolso descuenta, y nunca queda negativo", () => {
  assert.equal(montoAtribuible({ montoClp: 12_000, reembolsoClp: 12_000 }), 0);
  assert.equal(montoAtribuible({ montoClp: 12_000, reembolsoClp: 5_000 }), 7_000);
  assert.equal(montoAtribuible({ montoClp: 12_000, reembolsoClp: 20_000 }), 0);
});

// ---------------------------------------------------------------------------
// alumnasParaIgualarBase — la palanca de minimo_alumnas (PRD-0009 §8.3)
// ---------------------------------------------------------------------------

test("alumnasParaIgualarBase: a $12.000 en Los Leones (sala $17.000) iguala $18.000 desde 5", () => {
  assert.equal(alumnasParaIgualarBase(12_000, 17_000, 18_000), 5);
});

test("alumnasParaIgualarBase: a $12.000 en Diaguitas (sala $0) iguala desde 3, justo", () => {
  assert.equal(alumnasParaIgualarBase(12_000, 0, 18_000), 3);
});

test("alumnasParaIgualarBase: un precio más alto baja el mínimo", () => {
  assert.equal(alumnasParaIgualarBase(20_000, 17_000, 18_000), 3);
});

test("alumnasParaIgualarBase: sin precio no hay respuesta", () => {
  assert.equal(alumnasParaIgualarBase(0, 17_000, 18_000), null);
  assert.equal(alumnasParaIgualarBase(-5, 0, 18_000), null);
});
