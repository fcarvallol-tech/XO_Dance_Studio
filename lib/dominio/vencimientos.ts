/**
 * El aviso de que se vencen las clases (PRD-0032): la clave, la fecha en
 * palabras y el texto. Puro: no manda nada ni toca la base.
 *
 * **Qué lotes se avisan lo decide la base**, en
 * `avisos_de_vencimiento_pendientes()`: rol alumna, disponible > 0, entre 10 y
 * 3 días por delante y sin aviso previo con esa clave. Esa regla vive allá
 * porque es un filtro sobre lotes de todas las personas, y traerlos para
 * filtrar acá sería traer la tabla entera. Se prueba en
 * `scripts/base-local/escenario-vencimiento.mjs`.
 */

const ZONA = "America/Santiago";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Un aviso por persona y por fecha de vencimiento (§3.2, §8.3). Dos lotes que
 * vencen el mismo día son un correo con la suma; la misma clave escrita en la
 * base es la que impide el duplicado si el barrido corre dos veces.
 */
export function claveDeVencimiento(perfilId: string, vence: string): string {
  return `vencimiento:${perfilId}:${vence}`;
}

/** "2026-12-03" → [2026, 12, 3]. La fecha ya viene en hora de Chile desde la base. */
function partes(vence: string): [number, number, number] {
  const [a, m, d] = vence.slice(0, 10).split("-").map(Number);
  return [a, m, d];
}

/** "3 de diciembre". */
export function fechaCorta(vence: string): string {
  const [, m, d] = partes(vence);
  return `${d} de ${MESES[m - 1]}`;
}

/**
 * "jueves 3 de diciembre". El día de la semana sale de la fecha y no de Intl,
 * que según la versión de ICU pone o no una coma después del día.
 */
export function fechaConDia(vence: string): string {
  const [a, m, d] = partes(vence);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return `${DIAS[dia]} ${fechaCorta(vence)}`;
}

const clasesEn = (n: number) => `${n} ${n === 1 ? "clase" : "clases"}`;

/** §8.2: "Te quedan 3 clases en XO: vencen el 3 de diciembre". */
export function asuntoDeVencimiento(clases: number, vence: string): string {
  const uno = clases === 1;
  return `Te ${uno ? "queda" : "quedan"} ${clasesEn(clases)} en XO: ${uno ? "vence" : "vencen"} el ${fechaCorta(vence)}`;
}

/** §3.3: "Camila, te quedan 3 clases. Vencen el jueves 3 de diciembre." */
export function fraseDeVencimiento(clases: number, vence: string, nombre: string | null): string {
  const uno = clases === 1;
  const inicio = nombre ? `${nombre}, te` : "Te";
  return `${inicio} ${uno ? "queda" : "quedan"} ${clasesEn(clases)}. ${uno ? "Vence" : "Vencen"} el ${fechaConDia(vence)}.`;
}

/** El correo saluda por el nombre de pila (§8.2). */
export function nombreDePila(nombre: string | null | undefined): string | null {
  const primero = (nombre ?? "").trim().split(/\s+/)[0];
  return primero ? primero : null;
}

/** "2026-11-23": el día de hoy en Chile, que es el que cuenta para los 10 días. */
export function hoyEnSantiago(ahora: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}
