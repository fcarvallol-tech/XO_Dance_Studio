/**
 * Reglas puras de las clases especiales (PRD-0018): lo que decide, compara o
 * valida sin tocar la base.
 *
 * El reparto con el SQL es el mismo de `metricas.ts`: la base bloquea filas,
 * cuenta y suma; acá viven los contratos que después replica el SQL
 * (`seSolapan`, `cupoTomado`, `expiraAt`) y lo que solo existe en la
 * interfaz (`codigoDeReel`, `desdePrecio`, `puedePublicar`). Cuando una regla
 * vive en los dos lados, **el test de acá es el contrato** y el escenario de
 * staging (plan, fase 3) verifica que el SQL lo cumple.
 *
 * Dinero: enteros CLP. Fechas: `Date` en UTC; ninguna función mira la zona.
 */

import { valorReserva, type ReservaAtribuible } from "./metricas.ts";

// ---------------------------------------------------------------------------
// El Reel
// ---------------------------------------------------------------------------

/** Lo que Instagram usa en sus shortcodes. Ni puntos, ni barras, ni espacios. */
const CODIGO_REEL = /^[A-Za-z0-9_-]{5,40}$/;

/**
 * El código de un Reel a partir del link que alguien pegó.
 *
 * Acepta `instagram.com/reel/<código>` e `instagram.com/p/<código>`, con o sin
 * `www`, con o sin barra final, con parámetros de tracking o sin ellos. Todo lo
 * demás devuelve `null`: un perfil, una historia, otro dominio, o un código con
 * caracteres que no van en una URL. Se guarda **solo el código**: la URL se
 * arma al mostrar con `urlDeEmbed`.
 */
export function codigoDeReel(entrada: string): string | null {
  let url: URL;
  try {
    url = new URL(entrada.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.hostname !== "www.instagram.com" && url.hostname !== "instagram.com") return null;

  const partes = url.pathname.split("/").filter((p) => p.length > 0);
  if (partes.length !== 2) return null;
  if (partes[0] !== "reel" && partes[0] !== "p") return null;
  if (!CODIGO_REEL.test(partes[1])) return null;
  return partes[1];
}

/**
 * La única URL de Instagram que el sitio construye. Es lo que `embed.js`
 * genera (PRD-0018 §8.7), y se monta en un iframe **solo después del toque**.
 */
export function urlDeEmbed(codigo: string): string {
  if (!CODIGO_REEL.test(codigo)) {
    throw new Error("Código de Reel inválido: tiene que venir de codigoDeReel().");
  }
  return `https://www.instagram.com/reel/${codigo}/embed/`;
}

// ---------------------------------------------------------------------------
// Solape y cupo — contratos que el SQL replica
// ---------------------------------------------------------------------------

export type Bloque = { inicio: Date; fin: Date };

/**
 * Dos bloques `[inicio, fin)` se pisan. El fin es abierto: 19:00–20:00 no pisa
 * 20:00–21:00, pero 19:30–20:30 sí. La duración manda (PRD-0018 §9.3).
 */
export function seSolapan(a: Bloque, b: Bloque): boolean {
  return a.inicio.getTime() < b.fin.getTime() && b.inicio.getTime() < a.fin.getTime();
}

export type ReservaCupo = {
  estado: string;
  /** Solo tiene sentido en `pendiente_pago`. */
  expiraAt: Date | null;
};

/**
 * Cuántos cupos están tomados: confirmadas, asistió, **y las pendientes de pago
 * que todavía no vencen**. Es el conteo que `reservar()`, `reservar_especial()`,
 * `lugaresLibres`, `reservas_de_mis_clases` y las métricas tienen que replicar
 * idéntico (PRD-0018 §7.3): una pendiente que cuenta en un lado y no en otro es
 * un cupo vendido dos veces.
 *
 * La comparación es estricta, `expira_at > now()`: una pendiente que vence
 * exactamente ahora ya no cuenta. Una pendiente sin `expira_at` es un dato roto
 * y no cuenta, para que el error no tome cupos.
 */
export function cupoTomado(reservas: ReservaCupo[], ahora: Date): number {
  let tomados = 0;
  for (const r of reservas) {
    if (r.estado === "confirmada" || r.estado === "asistio") tomados += 1;
    else if (r.estado === "pendiente_pago" && r.expiraAt !== null && r.expiraAt.getTime() > ahora.getTime()) {
      tomados += 1;
    }
  }
  return tomados;
}

// ---------------------------------------------------------------------------
// Expiración de una reserva pendiente — PRD-0018 §8.2
// ---------------------------------------------------------------------------

const HORA_MS = 60 * 60 * 1000;
/** Antes del inicio de la clase, una pendiente ya no puede seguir tomando el cupo. */
const MARGEN_ANTES_DE_CLASE_MS = 2 * HORA_MS;

/**
 * Hasta cuándo una reserva pendiente de pago retiene el cupo:
 * `min(declarada + retención, inicio − 2 h)`.
 *
 * Si la clase es en menos de 2 horas, el resultado queda **antes** de
 * `declaradaAt`: la reserva nacería vencida. Esta función no lo esconde; quien
 * llama (`reservar_especial()`) lo compara y rechaza con "muy encima de la
 * clase".
 */
export function expiraAt(declaradaAt: Date, inicioClase: Date, retencionHoras: number): Date {
  if (!Number.isFinite(retencionHoras) || retencionHoras <= 0) {
    throw new Error("La retención tiene que ser un número de horas positivo.");
  }
  const porRetencion = declaradaAt.getTime() + retencionHoras * HORA_MS;
  const porClase = inicioClase.getTime() - MARGEN_ANTES_DE_CLASE_MS;
  return new Date(Math.min(porRetencion, porClase));
}

// ---------------------------------------------------------------------------
// Lo que ve la landing y lo que exige Publicar
// ---------------------------------------------------------------------------

export type EspecialListada = {
  precioClp: number;
  inicio: Date;
  /** `null` = borrador. */
  publicadaAt: Date | null;
  cancelada: boolean;
};

/**
 * El "desde $X" de la fila de Planes: el precio más bajo entre las especiales
 * publicadas, futuras y no canceladas. `null` cuando no hay ninguna, y entonces
 * la fila no se muestra (PRD-0018 §3.8).
 */
export function desdePrecio(especiales: EspecialListada[], ahora: Date): number | null {
  let minimo: number | null = null;
  for (const e of especiales) {
    if (e.publicadaAt === null || e.cancelada) continue;
    if (e.inicio.getTime() <= ahora.getTime()) continue;
    if (minimo === null || e.precioClp < minimo) minimo = e.precioClp;
  }
  return minimo;
}

export type EspecialAPublicar = {
  reelCodigo: string | null;
  portadaPath: string | null;
  profesoraId: string | null;
  sedeId: string | null;
  inicio: Date | null;
  precioClp: number | null;
};

export type FaltaParaPublicar = "reel" | "portada" | "profesora" | "sede" | "fecha" | "precio";

/**
 * Qué le falta a una especial para poder publicarse (PRD-0018 §9.2). Devuelve
 * la lista, no un booleano, para que el formulario diga exactamente qué falta.
 * Vacía = se puede publicar. Un precio de $0 es un precio: una clase gratis.
 */
export function puedePublicar(e: EspecialAPublicar, ahora: Date): FaltaParaPublicar[] {
  const faltan: FaltaParaPublicar[] = [];
  if (!e.reelCodigo) faltan.push("reel");
  if (!e.portadaPath) faltan.push("portada");
  if (!e.profesoraId) faltan.push("profesora");
  if (!e.sedeId) faltan.push("sede");
  if (e.inicio === null || e.inicio.getTime() <= ahora.getTime()) faltan.push("fecha");
  if (e.precioClp === null || !Number.isInteger(e.precioClp) || e.precioClp < 0) faltan.push("precio");
  return faltan;
}

// ---------------------------------------------------------------------------
// Plata: atribución y la palanca del mínimo de alumnas
// ---------------------------------------------------------------------------

/** Una reserva pagada con una compra de clase, no con un crédito. */
export type ReservaConCompraDeClase = {
  /** `compras.monto_clp`, congelado al declarar. */
  montoClp: number;
  /** `compras.reembolso_monto_clp`, si admin registró una devolución. */
  reembolsoClp: number | null;
};

/**
 * Lo que una reserva le atribuye a la profesora. Con crédito, la regla de
 * PRD-0010 §7.1 (`valorReserva`). Con compra de clase, el monto entero de la
 * compra, neto de reembolso y nunca negativo (PRD-0018 §7.7).
 */
export function montoAtribuible(r: ReservaAtribuible | ReservaConCompraDeClase): number {
  if ("montoClp" in r) {
    return Math.max(0, r.montoClp - (r.reembolsoClp ?? 0));
  }
  return valorReserva(r);
}

/**
 * Desde cuántas alumnas la profesora iguala, en una especial, lo que gana en
 * una clase normal. Regla de PRD-0009 §8.3: `variable = (n × precio − sala) / 2`,
 * así que `n ≥ (2 × base + sala) / precio`, redondeado hacia arriba.
 *
 * Es el número que el formulario muestra al lado de `minimo_alumnas`. `null`
 * sin precio: con una clase gratis no hay cuenta que hacer.
 */
export function alumnasParaIgualarBase(precioClp: number, costoSalaClp: number, baseClp: number): number | null {
  if (!Number.isFinite(precioClp) || precioClp <= 0) return null;
  return Math.ceil((2 * baseClp + costoSalaClp) / precioClp);
}
