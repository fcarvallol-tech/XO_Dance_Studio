/**
 * Finanzas del tablero de owner: la parte que **resta, divide y compara**.
 *
 * Mismo reparto que `metricas.ts` (PRD-0010 §8.2): el SQL suma y agrupa, y
 * acá se calcula todo lo que tiene un denominador o un signo. Así lo que se
 * rompe callado —una caja negativa comparada en porcentaje, un costo que no
 * se cargó y aparece como cero— queda en funciones puras con tests.
 *
 * **Dos preguntas distintas, a propósito.**
 * - La **caja neta** resta lo que se *registró* como salido de la cuenta. No
 *   resta costos calculados: si Carla anota el arriendo que pagó y el sistema
 *   además lo calcula por clase, se descuenta dos veces.
 * - El **margen por clase** usa los costos *calculados* —sala por hora, base
 *   de la profesora por hora y $250 por crédito consumido— para saber qué deja
 *   cada clase dictada. Es economía unitaria, no caja.
 *
 * **Ningún costo que falte se vuelve cero.** Si la profesora no tiene fila en
 * `costos_profesoras` o la sede no tiene `costo_hora_clp`, el margen es `null`
 * y la fila dice "sin costo cargado". Un cero acá se leería como "esta clase
 * no cuesta nada", que es exactamente el cero que miente de PRD-0010 §9.
 *
 * Dinero: enteros CLP, siempre.
 */

import { valorReserva, type ReservaAtribuible } from "./metricas.ts";

// ---------------------------------------------------------------------------
// Caja neta
// ---------------------------------------------------------------------------

/** Ingresos y egresos de un período. Los dos son enteros CLP. */
export type Caja = { ingresosClp: number; egresosClp: number };

export type CajaNeta = Caja & { netoClp: number };

/** Lo que entró menos lo que se registró como salido. Nunca resta costos calculados. */
export function cajaNeta(c: Caja): CajaNeta {
  return { ...c, netoClp: c.ingresosClp - c.egresosClp };
}

export type ComparacionCaja = {
  actual: number;
  anterior: number | null;
  absoluta: number | null;
  /** Solo cuando el anterior es positivo. Contra cero o negativo, un % no significa nada. */
  relativa: number | null;
};

/**
 * Compara la caja de un mes con la del anterior.
 *
 * Distinto de `comparar` de `metricas.ts` en un punto: una caja puede ser
 * negativa, y crecer desde −$6.000 a $9.500 no es "−258%". Cuando el anterior
 * no es positivo solo hay diferencia en pesos, y la tarjeta muestra eso.
 */
export function compararCaja(actual: number, anterior: number | null): ComparacionCaja {
  if (anterior === null || !Number.isFinite(anterior)) {
    return { actual, anterior: null, absoluta: null, relativa: null };
  }
  return {
    actual,
    anterior,
    absoluta: actual - anterior,
    relativa: anterior > 0 ? (actual - anterior) / anterior : null,
  };
}

// ---------------------------------------------------------------------------
// Costo, ingreso y margen de una clase
// ---------------------------------------------------------------------------

export type CostoDeClase = {
  /** Duración en horas. Sin `fin`, una hora (CONTEXT.md §5.b). */
  horas: number;
  /** `sedes.costo_hora_clp`. `null` si nadie lo cargó. */
  costoHoraSalaClp: number | null;
  /** `costos_profesoras.base_hora_clp`. `null` si la profesora no tiene fila. */
  baseHoraProfesoraClp: number | null;
  /** `costos_profesoras.variable_credito_clp`. `null` si la profesora no tiene fila. */
  variableCreditoClp: number | null;
  /** Reservas que consumieron un crédito y no lo recuperaron. PRD §7.1.3 y §8.5.b. */
  creditosConsumidos: number;
};

export type Costo = {
  salaClp: number;
  profesoraClp: number;
  totalClp: number;
};

/**
 * Lo que costó dictar una clase. `null` si falta cualquiera de los tres
 * costos: un costo que no se cargó no es un costo de cero, es un dato que
 * falta.
 *
 * El variable no escala con la duración: se paga por crédito consumido, dure
 * lo que dure la clase.
 */
export function costoClase(c: CostoDeClase): Costo | null {
  if (
    c.costoHoraSalaClp === null ||
    c.baseHoraProfesoraClp === null ||
    c.variableCreditoClp === null
  ) {
    return null;
  }
  if (!Number.isFinite(c.horas) || c.horas <= 0) return null;

  const salaClp = Math.round(c.costoHoraSalaClp * c.horas);
  const profesoraClp =
    Math.round(c.baseHoraProfesoraClp * c.horas) + c.variableCreditoClp * c.creditosConsumidos;
  return { salaClp, profesoraClp, totalClp: salaClp + profesoraClp };
}

/**
 * Cuánto dura una clase, en horas. Sin `fin`, una hora: es la regla de
 * CONTEXT.md §5.b y lo que hace `generar_clases`, que no escribe `fin`. Las
 * especiales y el intensivo sí lo traen. `null` si `fin` no es posterior.
 */
export function horasDeClase(inicio: string, fin: string | null): number | null {
  if (fin === null) return 1;
  const ms = new Date(fin).getTime() - new Date(inicio).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms / 3_600_000;
}

/** Ingreso de una clase: la suma del valor de cada reserva que la pagó. Reusa la regla 7.1. */
export function ingresoClase(reservas: ReservaAtribuible[]): number {
  return reservas.reduce((suma, r) => suma + valorReserva(r) * (r.n ?? 1), 0);
}

export type ClaseConMargen = {
  ingresoClp: number;
  costo: Costo | null;
  /** `null` cuando el costo es `null`. Nunca un cero inventado. */
  margenClp: number | null;
};

export function margenClase(reservas: ReservaAtribuible[], costo: CostoDeClase): ClaseConMargen {
  const ingresoClp = ingresoClase(reservas);
  const c = costoClase(costo);
  return { ingresoClp, costo: c, margenClp: c === null ? null : ingresoClp - c.totalClp };
}

export type ResumenMargen = {
  /** Solo las clases con costo cargado. */
  clases: number;
  ingresoClp: number;
  costoClp: number;
  margenClp: number;
  /** Cuántas quedaron fuera por no tener costo. Se muestra siempre. */
  sinCosto: number;
};

export function resumenMargen(clases: ClaseConMargen[]): ResumenMargen {
  let n = 0;
  let ingreso = 0;
  let costo = 0;
  let sinCosto = 0;
  for (const c of clases) {
    if (c.costo === null) {
      sinCosto++;
      continue;
    }
    n++;
    ingreso += c.ingresoClp;
    costo += c.costo.totalClp;
  }
  return { clases: n, ingresoClp: ingreso, costoClp: costo, margenClp: ingreso - costo, sinCosto };
}

// ---------------------------------------------------------------------------
// Egresos
// ---------------------------------------------------------------------------

export type EgresoAgrupable = { categoria: string; montoClp: number };

/** Total por categoría, de mayor a menor. Empates por nombre, para que el orden sea estable. */
export function porCategoria(
  egresos: EgresoAgrupable[],
): { categoria: string; montoClp: number }[] {
  const suma = new Map<string, number>();
  for (const e of egresos) suma.set(e.categoria, (suma.get(e.categoria) ?? 0) + e.montoClp);
  return [...suma]
    .map(([categoria, montoClp]) => ({ categoria, montoClp }))
    .sort((a, b) => b.montoClp - a.montoClp || a.categoria.localeCompare(b.categoria));
}

// ---------------------------------------------------------------------------
// El monto que alguien teclea
// ---------------------------------------------------------------------------

/** El tope de un `int` de Postgres, que es el tipo de `egresos.monto_clp`. */
const MONTO_MAXIMO_CLP = 2_147_483_647;

/**
 * Un monto en pesos a partir de lo que se escribió en el campo.
 *
 * Se aceptan enteros, con o sin puntos de miles en grupos de tres: "68000" y
 * "68.000" son lo mismo. **"12.5" no es 125**: quitar los puntos a ciegas lo
 * convertía en $125 sin que nadie lo notara. Un punto que no separa miles es
 * un decimal mal escrito, y se rechaza para que la persona lo vea.
 *
 * `null` para todo lo que no sea un entero entre 0 y el tope de la columna.
 */
export function montoDesdeTexto(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^\d+$/.test(limpio) && !/^\d{1,3}(\.\d{3})+$/.test(limpio)) return null;
  const monto = Number.parseInt(limpio.replace(/\./g, ""), 10);
  // El cero pasa: lo rechaza `registrar_egreso` con su propio mensaje, que es
  // más preciso que "no es un entero". Acá solo se mira el formato y el tope.
  if (!Number.isSafeInteger(monto) || monto > MONTO_MAXIMO_CLP) return null;
  return monto;
}
