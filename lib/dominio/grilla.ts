/**
 * Dónde cae cada clase en una grilla horaria.
 *
 * La grilla del calendario público se divide en **tramos de media hora**, y no
 * en bloques de una hora, por una razón concreta: hay clases de 90 minutos
 * (PRD-0021) y una grilla por horas no puede representarlas sin mentir — o las
 * alarga a dos horas o las corta a una.
 *
 * Todo el cálculo es aritmética de media hora, y es exactamente el tipo de
 * cuenta que se ve bien hasta que aparece una clase que empieza a y media. Por
 * eso vive acá con tests, y no dentro del componente.
 *
 * Las horas se guardan en UTC y se leen en `America/Santiago`.
 */

// Con extensión: el corredor de Node resuelve los ESM por ruta exacta, y es
// el patrón que ya usa el resto de `lib/dominio`.
import { duracionMin } from "./horarios.ts";
// `lib/semana.ts` es aritmética de días civiles en Santiago, pura y sin nada de
// servidor: es de este mismo tipo de código, solo que más viejo que la carpeta.
// Reimplementar acá "el lunes de" sería tener la misma cuenta en dos lados.
import { lunesDe, sumarDias } from "../semana.ts";

export const MINUTOS_POR_TRAMO = 30;

/** Una clase sin `fin` se asume de una hora, como la parrilla. */
const MINUTOS_QUE_SE_SUPONEN = 60;

const ZONA = "America/Santiago";

/** La hora del día en Santiago, con los minutos como fracción: 18:30 → 18.5. */
function horaDecimal(iso: string): number {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const dato = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? 0);
  return dato("hour") + dato("minute") / 60;
}

/**
 * En qué tramo empieza una clase, contando desde la hora en que abre la grilla.
 * El primero es el 0.
 */
export function tramoDe(inicio: string, horaDeApertura: number): number {
  return Math.round((horaDecimal(inicio) - horaDeApertura) * (60 / MINUTOS_POR_TRAMO));
}

/**
 * Cuántos tramos ocupa. **Se redondea hacia arriba**: una clase de 45 minutos
 * ocupa dos tramos, porque mostrar uno la haría parecer más corta y dejaría un
 * hueco donde en realidad hay una clase.
 */
export function tramosQueOcupa(inicio: string, fin: string | null): number {
  const minutos = duracionMin(inicio, fin) ?? MINUTOS_QUE_SE_SUPONEN;
  return Math.max(1, Math.ceil(minutos / MINUTOS_POR_TRAMO));
}

export type Tramo = { inicio: string; fin: string | null };

/**
 * Desde qué hora hasta qué hora dibujar la grilla.
 *
 * Se calcula de las clases y no se fija a mano: una grilla de 8 a 23 con clases
 * solo de tarde son quince filas vacías que hay que scrollear. Deja una hora de
 * aire a cada lado para que la primera y la última no queden pegadas al borde.
 */
export function ventanaDeHoras(clases: Tramo[]): { desde: number; hasta: number } {
  if (clases.length === 0) return { desde: 9, hasta: 22 };

  let primera = 24;
  let ultima = 0;

  for (const clase of clases) {
    const empieza = horaDecimal(clase.inicio);
    const minutos = duracionMin(clase.inicio, clase.fin) ?? MINUTOS_QUE_SE_SUPONEN;
    primera = Math.min(primera, empieza);
    ultima = Math.max(ultima, empieza + minutos / 60);
  }

  return {
    desde: Math.max(0, Math.floor(primera) - 1),
    hasta: Math.min(24, Math.ceil(ultima) + 1),
  };
}


/**
 * Los lunes que debe ofrecer la navegación de la grilla, **uno por semana y
 * sin saltarse ninguna**.
 *
 * Antes las semanas salían de agrupar las clases, así que una semana sin clases
 * simplemente no existía y el botón "Después" avanzaba dos de un salto, sin que
 * quien navega tuviera cómo notarlo. Ahora el rango es continuo: desde la
 * semana de hoy —que siempre está, aunque no haya nada— hasta la de la última
 * clase.
 *
 * Recibe **días civiles** en Santiago (`"2026-09-29"`), no instantes: qué día
 * es una clase de las 21:00 depende de la zona, y esa conversión ya la hizo
 * quien llama.
 */
export function semanasDeLaGrilla(dias: string[], hoy: string): string[] {
  const lunes = [lunesDe(hoy), ...dias.map(lunesDe)].sort();
  const primero = lunes[0];
  const ultimo = lunes[lunes.length - 1];

  const salida: string[] = [];
  for (let d = primero; d <= ultimo; d = sumarDias(d, 7)) salida.push(d);
  return salida;
}

/**
 * Si una clase ya ocurrió: **empezó**, no terminó. Una clase en curso ya no se
 * puede reservar ni cancelar, así que para el calendario es pasada.
 */
export function esPasada(inicio: string, ahora: Date): boolean {
  return new Date(inicio).getTime() <= ahora.getTime();
}

/**
 * En qué semana abre la grilla (PRD-0006 §13).
 *
 * Antes abría siempre en la de hoy, y un domingo —con todo lo de la semana ya
 * ocurrido— se veía vacía, como si no hubiera clases. Ahora abre en **la
 * primera semana, desde la de hoy, que tenga algo que reservar**. Si a la de
 * hoy le queda algo, se queda en esa.
 *
 * Recibe los **días** que tienen algo reservable, no las clases: qué es
 * reservable —no empezó, tiene lugar, o es una especial con su página— lo
 * decide quien llama, que sabe la hora y los cupos.
 *
 * Sin nada reservable en ninguna, la semana de hoy: mejor ver la actual, con
 * sus pasadas, que una semana cualquiera.
 */
export function semanaInicial(semanas: string[], diasReservables: string[], hoy: string): number {
  const actual = Math.max(0, semanas.indexOf(lunesDe(hoy)));
  const conAlgo = new Set(diasReservables.map(lunesDe));
  for (let i = actual; i < semanas.length; i++) {
    if (conAlgo.has(semanas[i])) return i;
  }
  return actual;
}
