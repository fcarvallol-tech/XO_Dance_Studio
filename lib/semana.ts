/**
 * Semanas en hora de Chile.
 *
 * Todo el cálculo va contra `America/Santiago` y no contra UTC: el lunes de una
 * profesora empieza a medianoche en Santiago, y con UTC se correría de día en
 * la madrugada. Sin librerías, como pide CLAUDE.md.
 *
 * La unidad de trabajo es el **día civil** como `"2026-09-07"`, no un `Date`:
 * un string de fecha no tiene hora que se pueda desfasar sola.
 */

export const ZONA = "America/Santiago";

/** El día civil de un instante, en Santiago: "2026-09-07". */
export function diaEnSantiago(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

/** Hoy, en Santiago. */
export function hoyEnSantiago(): string {
  return diaEnSantiago(new Date());
}

/** ¿Es un "2026-09-07" válido? Lo que llega por la URL no se confía. */
export function esDiaValido(valor: string | null | undefined): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && diaUTC(d) === valor;
}

function diaUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Suma días a un día civil. Se opera a mediodía UTC para que ningún cambio de
 * hora empuje el resultado al día vecino.
 */
export function sumarDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return diaUTC(d);
}

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export function diaSemanaISO(dia: string): number {
  const d = new Date(`${dia}T12:00:00Z`);
  return ((d.getUTCDay() + 6) % 7) + 1;
}

/** El lunes de la semana que contiene ese día. */
export function lunesDe(dia: string): string {
  return sumarDias(dia, -(diaSemanaISO(dia) - 1));
}

/** Los siete días civiles de la semana, de lunes a domingo. */
export function diasDeLaSemana(lunes: string): string[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

/**
 * El desfase de Santiago en ese instante: "-04:00" o "-03:00". Chile cambia de
 * hora, así que no se puede fijar uno solo.
 */
function desfase(cerca: Date): string {
  const parte = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    timeZoneName: "longOffset",
  })
    .formatToParts(cerca)
    .find((p) => p.type === "timeZoneName")?.value;

  const off = parte?.replace("GMT", "") ?? "";
  return /^[+-]\d{2}:\d{2}$/.test(off) ? off : "-04:00";
}

/** El instante exacto en que empieza ese día en Santiago. */
export function inicioDelDia(dia: string): Date {
  // Aproximación para averiguar el desfase vigente esa fecha, y luego el
  // instante real. El error solo podría darse en la hora exacta del cambio de
  // hora, y a esa hora no hay clases.
  const aprox = new Date(`${dia}T12:00:00Z`);
  return new Date(`${dia}T00:00:00${desfase(aprox)}`);
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** "lunes" — el nombre del día civil. */
export function nombreDelDia(dia: string): string {
  return DIAS[diaSemanaISO(dia) - 1];
}

/** "7" — el número, para el encabezado de la columna. */
export function numeroDelDia(dia: string): string {
  return String(Number(dia.slice(8, 10)));
}

/** "8 al 14 de septiembre" — el rango de la semana, para el encabezado. */
export function rangoLegible(lunes: string): string {
  const domingo = sumarDias(lunes, 6);
  const mesL = MESES[Number(lunes.slice(5, 7)) - 1];
  const mesD = MESES[Number(domingo.slice(5, 7)) - 1];
  const dL = numeroDelDia(lunes);
  const dD = numeroDelDia(domingo);

  return mesL === mesD
    ? `${dL} al ${dD} de ${mesL}`
    : `${dL} de ${mesL} al ${dD} de ${mesD}`;
}
