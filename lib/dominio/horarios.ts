/**
 * Cómo se escribe la hora de una clase.
 *
 * Existe por PRD-0021 §8.5: con clases de duración variable, mostrar solo
 * "18:00" le esconde a la profesora que termina a las 19:30, y sin eso no puede
 * planificar lo que viene después.
 *
 * **Es función pura y tiene tests porque el mismo texto se escribe en el
 * servidor y en el navegador.** Una diferencia entre los dos es un error de
 * hidratación, y es la razón por la que este proyecto ya formatea las fechas a
 * mano en vez de dejarlas al azar del entorno.
 *
 * Las horas se guardan en UTC y se leen en `America/Santiago`. El desfase no se
 * escribe a mano: Chile cambia de hora dos veces al año.
 */

const ZONA = "America/Santiago";

/** "18:00" en hora de Santiago, a partir de un instante UTC. */
export function horaEnSantiago(iso: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/**
 * Los minutos que dura la clase, o `null` cuando no se puede saber: sin `fin`
 * —las clases de parrilla no lo tienen— o con un `fin` que no va después del
 * inicio, que es un dato roto y no una duración negativa.
 */
export function duracionMin(inicio: string, fin: string | null): number | null {
  if (!fin) return null;
  const minutos = (new Date(fin).getTime() - new Date(inicio).getTime()) / 60000;
  if (!Number.isFinite(minutos) || minutos <= 0) return null;
  return Math.round(minutos);
}

/** Una clase sin `fin` se asume de una hora, como la parrilla. */
const MINUTOS_QUE_SE_SUPONEN = 60;

/**
 * La hora de la clase como se muestra: **"18:00" si dura lo que se supone, y
 * "18:00–19:30" si dura otra cosa.**
 *
 * El rango aparece solo cuando hay algo que no se puede suponer. Ponérselo a
 * todas las clases de una hora llenaría de "–19:00" redundantes la pantalla que
 * más se mira, que es la grilla semanal.
 */
export function rangoHorario(inicio: string, fin: string | null): string {
  const inicial = horaEnSantiago(inicio);
  const minutos = duracionMin(inicio, fin);

  if (minutos === null || minutos === MINUTOS_QUE_SE_SUPONEN) return inicial;
  return `${inicial}–${horaEnSantiago(fin!)}`;
}
