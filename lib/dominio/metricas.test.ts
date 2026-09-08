/**
 * Tests de las métricas del tablero de owner.
 *
 * **Los números no se inventan acá.** Salen del escenario de PRD-0010 §11.4,
 * que se calculó a mano y se escribió en el PRD *antes* de que existiera este
 * código, justamente para que el tablero no defina cuál es la respuesta
 * correcta. Si un valor de acá no coincide con el PRD, el que manda es el PRD.
 *
 * Corren con `npm test`. Sin dependencias: Node 24 trae el corredor y ejecuta
 * TypeScript sin transpilar.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  atribuir,
  brecha,
  comparar,
  conciliacion,
  ocupacionPromedio,
  planesMasVendidos,
  tasa,
  ticketPromedio,
  valorReserva,
  type ReservaAtribuible,
} from "./metricas.ts";

/** Un porcentaje con un decimal, que es como lo muestra la tarjeta. */
function pct(t: number | null): number | null {
  return t === null ? null : Math.round(t * 1000) / 10;
}

// ---------------------------------------------------------------------------
// tasa
// ---------------------------------------------------------------------------

test("tasa: divide cuando hay denominador", () => {
  assert.equal(tasa(7, 27), 7 / 27);
  assert.equal(pct(tasa(7, 27)), 25.9);
});

test("tasa: sin denominador devuelve null, nunca NaN ni 0", () => {
  assert.equal(tasa(0, 0), null);
  assert.equal(tasa(5, 0), null);
  assert.equal(tasa(3, -2), null);
});

test("tasa: cero legítimo sigue siendo cero, no null", () => {
  // Nadie usó sus créditos NO es lo mismo que todavía no hay créditos.
  assert.equal(tasa(0, 27), 0);
});

// ---------------------------------------------------------------------------
// comparar
// ---------------------------------------------------------------------------

test("comparar: ingresos del escenario contra el período anterior", () => {
  const c = comparar(112_500, 44_000);
  assert.equal(c.absoluta, 68_500);
  assert.equal(pct(c.relativa), 155.7);
});

test("comparar: sin período anterior no hay diferencia ni porcentaje", () => {
  const c = comparar(112_500, null);
  assert.equal(c.anterior, null);
  assert.equal(c.absoluta, null);
  assert.equal(c.relativa, null);
});

test("comparar: período anterior en cero da absoluta pero no porcentaje", () => {
  // Crecer desde cero no es "+100%": es una división por cero disfrazada.
  const c = comparar(112_500, 0);
  assert.equal(c.absoluta, 112_500);
  assert.equal(c.relativa, null);
});

test("comparar: una caída se reporta negativa", () => {
  const c = comparar(44_000, 112_500);
  assert.equal(c.absoluta, -68_500);
  assert.equal(pct(c.relativa), -60.9);
});

// ---------------------------------------------------------------------------
// brecha y conciliación
// ---------------------------------------------------------------------------

test("brecha: las tres partes del escenario", () => {
  const b = brecha({ otorgadas: 27, consumidas: 7, disponibles: 20, vencidas: 2 });
  assert.equal(b.pasivoVigente, 18);
  assert.equal(b.vencidas, 2);
  assert.equal(pct(b.utilizacion), 25.9);
});

test("brecha: un crédito vencido sale del pasivo, no se suma a él", () => {
  const sinVencer = brecha({ otorgadas: 27, consumidas: 7, disponibles: 20, vencidas: 0 });
  const conVencidos = brecha({ otorgadas: 27, consumidas: 7, disponibles: 20, vencidas: 2 });
  assert.equal(sinVencer.pasivoVigente - conVencidos.pasivoVigente, 2);
});

test("brecha: el pasivo se mide, no se deduce restando el consumo", () => {
  // Un movimiento de `ajuste` de +3 no es venta ni consumo: la resta daría 15
  // y los lotes dicen 18. Manda la medición.
  const b = brecha({ otorgadas: 27, consumidas: 7, disponibles: 20, vencidas: 2 });
  assert.equal(b.pasivoVigente, 18);
  assert.notEqual(b.pasivoVigente, b.otorgadas - b.consumidas - b.vencidas - 3);
});

test("brecha: sin créditos otorgados la utilización es null", () => {
  const b = brecha({ otorgadas: 0, consumidas: 0, disponibles: 0, vencidas: 0 });
  assert.equal(b.utilizacion, null);
  assert.equal(b.pasivoVigente, 0);
});

test("conciliación: el escenario cuadra en 20", () => {
  // Libro: 27 otorgados − 9 reservas + 2 devoluciones = 20.
  // Lotes: 2 + 0 + 8 + 1 + 4 + 0 + 1 + 4 = 20.
  const c = conciliacion(27 - 9 + 2, 2 + 0 + 8 + 1 + 4 + 0 + 1 + 4);
  assert.equal(c.libro, 20);
  assert.equal(c.lotes, 20);
  assert.equal(c.cuadra, true);
  assert.equal(c.diferencia, 0);
});

test("conciliación: si no cuadra lo dice y con cuánto", () => {
  const c = conciliacion(20, 19);
  assert.equal(c.cuadra, false);
  assert.equal(c.diferencia, 1);
});

// ---------------------------------------------------------------------------
// Venta
// ---------------------------------------------------------------------------

test("ticket promedio: el del escenario y el del período anterior", () => {
  assert.equal(ticketPromedio(112_500, 4), 28_125);
  assert.equal(ticketPromedio(44_000, 2), 22_000);
});

test("ticket promedio: redondea a entero CLP", () => {
  assert.equal(ticketPromedio(8_500, 3), 2_833);
});

test("ticket promedio: sin compras es null, no cero", () => {
  assert.equal(ticketPromedio(0, 0), null);
});

test("plan más vendido: el del escenario es pack-4 con 2", () => {
  const top = planesMasVendidos([
    { slug: "suelta", nombre: "1 clase", compras: 1 },
    { slug: "pack-2", nombre: "2 clases", compras: 0 },
    { slug: "pack-4", nombre: "4 clases", compras: 2 },
    { slug: "pack-8", nombre: "8 clases", compras: 1 },
  ]);
  assert.equal(top.length, 1);
  assert.equal(top[0].slug, "pack-4");
});

test("plan más vendido: un empate devuelve a todos los empatados", () => {
  const top = planesMasVendidos([
    { slug: "pack-4", nombre: "4 clases", compras: 2 },
    { slug: "pack-8", nombre: "8 clases", compras: 2 },
    { slug: "suelta", nombre: "1 clase", compras: 1 },
  ]);
  assert.deepEqual(top.map((p) => p.slug), ["pack-4", "pack-8"]);
});

test("plan más vendido: sin ventas, lista vacía", () => {
  assert.deepEqual(planesMasVendidos([{ slug: "pack-4", nombre: "4", compras: 0 }]), []);
});

// ---------------------------------------------------------------------------
// Demanda
// ---------------------------------------------------------------------------

test("ocupación: el promedio de las tres clases dictadas del escenario", () => {
  const o = ocupacionPromedio([
    { reservas: 2, cupo: 22 }, // CL1
    { reservas: 1, cupo: 22 }, // CL2
    { reservas: 2, cupo: 22 }, // CL3
  ]);
  assert.equal(o.reservas, 5);
  assert.equal(o.cupos, 66);
  assert.equal(o.clases, 3);
  assert.equal(pct(o.tasa), 7.6);
});

test("ocupación: sin clases dictadas es null, no 0%", () => {
  const o = ocupacionPromedio([]);
  assert.equal(o.tasa, null);
  assert.equal(o.clases, 0);
});

// ---------------------------------------------------------------------------
// Atribución a la profesora — PRD-0010 §7.1
// ---------------------------------------------------------------------------

/** Los cinco lotes del escenario, con su precio unitario. */
const C1 = { montoCompraClp: 28_000, clasesCompra: 4 }; // $7.000
const C2 = { montoCompraClp: 16_000, clasesCompra: 2 }; // $8.000
const C3 = { montoCompraClp: 48_000, clasesCompra: 8 }; // $6.000
const C5 = { montoCompraClp: 8_500, clasesCompra: 1 }; // $8.500
const REGALO = { montoCompraClp: null, clasesCompra: null }; // $0

test("valor de una reserva: el precio unitario del lote que la pagó", () => {
  const base = { recuperoCredito: false, claseYaOcurrio: true };
  assert.equal(valorReserva({ ...C1, ...base }), 7_000);
  assert.equal(valorReserva({ ...C2, ...base }), 8_000);
  assert.equal(valorReserva({ ...C3, ...base }), 6_000);
  assert.equal(valorReserva({ ...C5, ...base }), 8_500);
});

test("valor de una reserva: un crédito de regalo vale cero", () => {
  // No entró plata. Atribuirle el precio de lista inventaría un ingreso.
  assert.equal(
    valorReserva({ ...REGALO, recuperoCredito: false, claseYaOcurrio: true }),
    0,
  );
});

test("valor de una reserva: si el crédito volvió, no atribuye nada", () => {
  assert.equal(valorReserva({ ...C1, recuperoCredito: true, claseYaOcurrio: true }), 0);
});

test("valor de una reserva: una cancelación tardía sí atribuye", () => {
  // Perdió el crédito, la clase se dictó igual y la plata se ganó igual.
  assert.equal(valorReserva({ ...C1, recuperoCredito: false, claseYaOcurrio: true }), 7_000);
});

/** Las nueve reservas del escenario de §11.4, en orden. */
const RESERVAS_DEL_ESCENARIO: ReservaAtribuible[] = [
  { ...C1, recuperoCredito: false, claseYaOcurrio: true }, // Ana  CL1
  { ...C2, recuperoCredito: false, claseYaOcurrio: true }, // Bea  CL1
  { ...C1, recuperoCredito: false, claseYaOcurrio: true }, // Ana  CL2
  { ...REGALO, recuperoCredito: false, claseYaOcurrio: true }, // Cata CL2, canceló tarde
  { ...C1, recuperoCredito: false, claseYaOcurrio: true }, // Ana  CL3
  { ...C5, recuperoCredito: false, claseYaOcurrio: true }, // Cata CL3
  { ...C2, recuperoCredito: true, claseYaOcurrio: true }, // Bea  CL3, canceló a tiempo
  { ...C1, recuperoCredito: false, claseYaOcurrio: false }, // Ana  CL4, futura
  { ...C3, recuperoCredito: true, claseYaOcurrio: true }, // Ana  CL5, XO canceló
];

test("atribución: el escenario da $37.500 dictado y $7.000 comprometido", () => {
  const a = atribuir(RESERVAS_DEL_ESCENARIO);
  assert.equal(a.dictado, 37_500);
  assert.equal(a.comprometido, 7_000);
  assert.equal(a.total, 44_500);
});

test("atribución: lo comprometido no se mezcla con lo dictado", () => {
  // La regla existe porque el calendario abre 60 días: sin separar, el número
  // sería en buena parte clases que la profesora todavía no dicta.
  const a = atribuir([{ ...C1, recuperoCredito: false, claseYaOcurrio: false }]);
  assert.equal(a.dictado, 0);
  assert.equal(a.comprometido, 7_000);
});

test("atribución: una fila agrupada vale por sus n reservas", () => {
  // El SQL agrupa por los atributos que definen el valor; acá se multiplica.
  const agrupado = atribuir([{ ...C1, recuperoCredito: false, claseYaOcurrio: true, n: 3 }]);
  const suelto = atribuir([
    { ...C1, recuperoCredito: false, claseYaOcurrio: true },
    { ...C1, recuperoCredito: false, claseYaOcurrio: true },
    { ...C1, recuperoCredito: false, claseYaOcurrio: true },
  ]);
  assert.equal(agrupado.dictado, 21_000);
  assert.deepEqual(agrupado, suelto);
});

test("atribución: sin reservas, todo en cero y no null", () => {
  assert.deepEqual(atribuir([]), { dictado: 0, comprometido: 0, total: 0 });
});
