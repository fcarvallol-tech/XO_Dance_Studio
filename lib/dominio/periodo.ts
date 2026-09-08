/**
 * El período que mira el tablero, en la zona horaria correcta.
 *
 * Las fechas se guardan en UTC y se leen en `America/Santiago`. Para "el mes en
 * curso" eso no es un detalle de presentación: si el corte se calcula en UTC,
 * una compra aprobada a las 22:00 del 31 de agosto en Santiago cae en
 * septiembre —son las 02:00 UTC del día 1— y aparece en el mes equivocado. En
 * Chile el desfase es de 3 o 4 horas según el horario de verano, así que hay
 * tres o cuatro horas de cada mes que se irían al mes siguiente.
 *
 * Los períodos son semiabiertos, `[desde, hasta)`, igual que en el SQL.
 */

const ZONA = "America/Santiago";

/** Cuánto se le suma a UTC para llegar a la hora de Santiago, en ese instante. */
function desfase(instante: Date): number {
  const enZona = new Date(instante.toLocaleString("en-US", { timeZone: ZONA }));
  const enUtc = new Date(instante.toLocaleString("en-US", { timeZone: "UTC" }));
  return enZona.getTime() - enUtc.getTime();
}

/**
 * El instante UTC de una medianoche de Santiago.
 *
 * Itera dos veces porque el desfase depende del instante que se está
 * calculando: en los dos fines de semana del año en que cambia el horario, la
 * primera estimación cae del lado equivocado del cambio y la segunda corrige.
 */
function medianocheEnSantiago(anio: number, mes: number, dia: number): Date {
  const nominal = Date.UTC(anio, mes, dia);
  let instante = nominal;
  for (let i = 0; i < 2; i++) instante = nominal - desfase(new Date(instante));
  return new Date(instante);
}

/** Año y mes de Santiago en un instante dado. */
function mesDeSantiago(ahora: Date): { anio: number; mes: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(ahora);
  const valor = (tipo: string) =>
    Number(partes.find((p) => p.type === tipo)?.value);
  return { anio: valor("year"), mes: valor("month") - 1 };
}

export type Periodo = { desde: Date; hasta: Date };

/**
 * El mes en curso en Santiago, desde su primer instante hasta el primero del
 * mes siguiente.
 *
 * `hasta` es el fin del mes y no `ahora` a propósito: así el período no cambia
 * de largo cada vez que se recarga la página, y la comparación contra el mes
 * anterior compara dos meses completos y no un mes contra los días corridos.
 */
export function mesEnCurso(ahora: Date = new Date()): Periodo {
  const { anio, mes } = mesDeSantiago(ahora);
  return {
    desde: medianocheEnSantiago(anio, mes, 1),
    hasta: medianocheEnSantiago(anio, mes + 1, 1),
  };
}

/**
 * El mes anterior al de un período.
 *
 * Se calcula acá y se le pasa al SQL, en vez de que el SQL lo deduzca. Deducirlo
 * como "el mismo largo, pegado antes" parece equivalente y no lo es: septiembre
 * dura 30 días, así que restarle 30 a su primer día da el **2** de agosto y la
 * comparación se hace contra un agosto al que le falta un día. Meses distintos
 * duran distinto, y esa es toda la razón.
 */
export function mesAnterior(periodo: Periodo): Periodo {
  const { anio, mes } = mesDeSantiago(periodo.desde);
  return {
    desde: medianocheEnSantiago(anio, mes - 1, 1),
    hasta: medianocheEnSantiago(anio, mes, 1),
  };
}

/** Cómo se llama el mes de un período, para rotular la tarjeta. */
export function nombreDelMes(periodo: Periodo): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: ZONA,
    month: "long",
    year: "numeric",
  }).format(periodo.desde);
}
