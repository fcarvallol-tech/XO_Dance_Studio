/**
 * La liquidación de una profesora en un mes (PRD-0010 parte 3).
 *
 * **Toda la regla de pago vive acá, y solo acá.** La base de datos entrega los
 * insumos —cada clase con su estado, su causa y cuántos créditos se
 * consumieron— y no calcula ningún monto. La pantalla del owner, el portal de
 * la profesora y el botón "Pagado" usan estas mismas funciones: si la regla
 * estuviera también en SQL, habría dos versiones de lo mismo y una sola con
 * tests.
 *
 * Las reglas salen de `CONTEXT.md` §5.b, en las versiones del 21/10/2026 (el
 * umbral del variable) y del 04/11/2026 (las causas, la recuperación y el
 * incentivo en dos tramos). Lo que no estaba escrito y hubo que leer está
 * marcado **«lectura»** y explicado en PRD-0010 parte 3 §12.3.
 *
 * Sin dependencias de servidor. Dinero en enteros CLP.
 */

import { diaEnSantiago } from "../semana.ts";

// ---------------------------------------------------------------------------
// Constantes de la regla
// ---------------------------------------------------------------------------

/**
 * La liquidación arranca el 1 de noviembre de 2026 (Felipe, 04/11/2026).
 * Octubre se pagó a mano, está cerrado fuera del sistema y no se carga: nada
 * acá lo calcula ni lo muestra como pendiente.
 */
export const PRIMER_MES_LIQUIDABLE = "2026-11";

/** La tarifa general (CONTEXT.md §5.b). Isi también, desde el 04/11/2026. */
export const TARIFA_GENERAL: Tarifa = {
  baseHoraClp: 18_000,
  variableCreditoClp: 250,
  umbralVariable: 5,
};

/** Incentivo por promedio, regla del 04/11/2026 (CONTEXT.md §5.b). */
export const INCENTIVO = {
  /** Cuántas clases se promedian: las mejores del mes. */
  mejores: 4,
  /** Con menos dictadas en el mes, no hay incentivo. */
  minimoDictadas: 4,
  /** Los tramos **se suman**: con promedio 22 o más se cobran los dos. */
  tramos: [
    { desdePromedio: 14, montoClp: 7_500 },
    { desdePromedio: 22, montoClp: 7_500 },
  ],
} as const;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Tarifa = {
  /** `costos_profesoras.base_hora_clp`. */
  baseHoraClp: number;
  /** `costos_profesoras.variable_credito_clp`. */
  variableCreditoClp: number;
  /** Desde qué crédito se paga el variable: con 5, desde el sexto. */
  umbralVariable: number;
};

export type Causa =
  | "sala_no_disponible"
  | "cambio_de_parrilla"
  | "ausencia_profesora"
  | "sin_alumnas"
  | "asistencia_insuficiente";

export const CAUSAS: readonly Causa[] = [
  "sala_no_disponible",
  "cambio_de_parrilla",
  "ausencia_profesora",
  "sin_alumnas",
  "asistencia_insuficiente",
];

export type EstadoClase = "programada" | "cancelada" | "no_dictada";

/** Una clase tal como la entrega la base para liquidar. */
export type ClaseLiquidable = {
  id: string;
  /** Quien la dictó: `clases.profesora_id`. Con un reemplazo, la reemplazante. */
  profesoraId: string;
  cursoId: string;
  /** Para leer: el nombre del curso y de la sala. No entran en ningún cálculo. */
  curso: string;
  sede: string;
  inicio: string;
  fin: string | null;
  tipo: "parrilla" | "especial";
  estado: EstadoClase;
  causa: Causa | null;
  /**
   * Si la profesora llegó a la clase. Se marca al clasificarla
   * (`causas_de_clase.profesora_se_presento`), apagado por defecto. El dato se
   * guarda en las cinco causas, pero solo cambia el pago en `sala_no_disponible`.
   */
  profesoraSePresento: boolean;
  /** Si tiene una recuperación vigente: una clase con `recupera_clase_id` a esta, no cancelada. */
  recuperada: boolean;
  /** Cuándo es esa recuperación. Puede caer en otro mes, y ahí se paga en ese otro. */
  recuperacionInicio: string | null;
  /** Si esta clase recupera a otra, cuándo era esa otra. */
  recuperaInicio: string | null;
  /** Reservas con crédito y sin devolver (el mismo hecho que atribuye ingreso). */
  creditosConsumidos: number;
};

export type Efecto = "base" | "nada";

export type TipoLinea =
  /** Programada y ya empezó: se presume dictada y paga base más variable. */
  | "dictada"
  /** Cancelada o no dictada, con causa: paga según `efectoDeCausa`. */
  | "no_dictada"
  /** Cancelada o no dictada sin causa: bloquea el pago de todo el mes. */
  | "sin_causa"
  /** Todavía no empieza: no entra. */
  | "futura"
  /** Clase especial: se paga con otra regla, fuera de esta liquidación. */
  | "especial";

export type Linea = {
  claseId: string;
  cursoId: string;
  curso: string;
  sede: string;
  inicio: string;
  tipo: TipoLinea;
  causa: Causa | null;
  recuperacionInicio: string | null;
  recuperaInicio: string | null;
  horas: number;
  creditosConsumidos: number;
  baseClp: number;
  variableClp: number;
  totalClp: number;
  /** Por qué paga lo que paga, en palabras: lo lee el owner y la profesora. */
  explicacion: string;
};

/** Una clase de las que se promediaron para el incentivo. */
export type ClaseDelPromedio = { claseId: string; inicio: string; creditos: number };

export type IncentivoDeCurso = {
  cursoId: string;
  curso: string;
  /** Cuántas clases dictadas tuvo ese curso en el mes. */
  dictadas: number;
  /** Los créditos de las mejores, de mayor a menor. Vacío si no llega al mínimo. */
  mejores: number[];
  /** Cuáles clases son esas mejores. Vacío si no llega al mínimo. */
  clasesDelPromedio: ClaseDelPromedio[];
  /** Promedio de las mejores, solo para mostrar. La comparación se hace sin decimales. */
  promedio: number | null;
  /** Cuántos tramos alcanzó: 0, 1 o 2. */
  tramos: number;
  montoClp: number;
  explicacion: string;
};

export type Bloqueo =
  | { tipo: "antes_de_noviembre" }
  | { tipo: "mes_en_curso" }
  | { tipo: "sin_tarifa" }
  | { tipo: "clases_sin_causa"; cuantas: number };

export type Liquidacion = {
  profesoraId: string;
  mes: string;
  lineas: Linea[];
  incentivos: IncentivoDeCurso[];
  baseClp: number;
  variableClp: number;
  incentivoClp: number;
  totalClp: number;
  /** Las especiales del mes, que se pagan aparte (PRD-0010 parte 3 §4.1). */
  especiales: number;
  /** Lo que impide marcarla como pagada. Vacío = se puede pagar. */
  bloqueos: Bloqueo[];
};

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

/** El mes civil de un instante, en Santiago: "2026-11". */
export function mesEnSantiago(instante: string | Date): string {
  return diaEnSantiago(new Date(instante)).slice(0, 7);
}

/** Si el mes ya terminó en Santiago: no se paga un mes antes de que termine. */
export function mesTerminado(mes: string, ahora: Date): boolean {
  return mesEnSantiago(ahora) > mes;
}

/** Cuánto dura una clase. Sin `fin`, una hora (CONTEXT.md §5.b). */
export function horas(inicio: string, fin: string | null): number {
  if (fin === null) return 1;
  const ms = new Date(fin).getTime() - new Date(inicio).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms / 3_600_000 : 1;
}

/** La base de una clase, redondeada al peso por línea y no al total. */
export function baseDeClase(horasClase: number, tarifa: Tarifa): number {
  return Math.round(tarifa.baseHoraClp * horasClase);
}

/**
 * El variable de una clase: `máx(0, créditos − umbral) × $250` (Felipe,
 * 21/10/2026). Clase por clase: no se prorratea ni se arrastra. No escala con
 * la duración.
 */
export function variableDeClase(creditos: number, tarifa: Tarifa): number {
  return Math.max(0, creditos - tarifa.umbralVariable) * tarifa.variableCreditoClp;
}

/**
 * Qué paga una clase que no se dictó (CONTEXT.md §5.b, decisión 1 del
 * 04/11/2026, la regla del 03/11/2026 y las correcciones del 05/11/2026):
 *
 * - **`sala_no_disponible` y la profesora se presentó: la base**, aunque se haya
 *   recuperado. Lo que paga el viaje perdido es que el problema fue de XO y ella
 *   no podía saberlo. En las otras causas el campo no cambia nada: en
 *   `sin_alumnas` y `asistencia_insuficiente` ella sí sabía que iba a dar clase,
 *   lo que falló fue la demanda, y eso se resuelve con la recuperación
 *   (Felipe, 06/11/2026).
 * - Si no, **recuperada, por la causa que sea: nada.** Se paga una sola vez, en
 *   la recuperación, que es una clase dictada más.
 * - Si no, sin recuperar:
 *   - `sala_no_disponible`: la base. El problema fue de XO.
 *   - `cambio_de_parrilla`: nada. Esa clase nunca estuvo en su semana.
 *   - `ausencia_profesora`: nada.
 *   - `sin_alumnas` y `asistencia_insuficiente`: la base, porque organizó su día
 *     en torno a esa clase y traer alumnas es trabajo de XO.
 *
 * No hay reloj: cuándo se canceló no cambia nada (Felipe, 05/11/2026).
 */
export function efectoDeCausa(
  causa: Causa,
  contexto: { recuperada: boolean; profesoraSePresento: boolean },
): Efecto {
  if (causa === "sala_no_disponible" && contexto.profesoraSePresento) return "base";
  if (contexto.recuperada) return "nada";
  switch (causa) {
    case "sala_no_disponible":
    case "sin_alumnas":
    case "asistencia_insuficiente":
      return "base";
    case "cambio_de_parrilla":
    case "ausencia_profesora":
      return "nada";
  }
}

export const NOMBRE_CAUSA: Record<Causa, string> = {
  sala_no_disponible: "la sala no estuvo disponible",
  cambio_de_parrilla: "cambio de parrilla",
  ausencia_profesora: "ausencia de la profesora",
  sin_alumnas: "no hubo alumnas",
  asistencia_insuficiente: "no llegaron alumnas suficientes",
};

/** Qué paga una clase, con la explicación que se lee en pantalla. */
export function lineaDeClase(clase: ClaseLiquidable, tarifa: Tarifa, ahora: Date): Linea {
  const h = horas(clase.inicio, clase.fin);
  const linea = (
    tipo: TipoLinea,
    baseClp: number,
    variableClp: number,
    explicacion: string,
  ): Linea => ({
    claseId: clase.id,
    cursoId: clase.cursoId,
    curso: clase.curso,
    sede: clase.sede,
    inicio: clase.inicio,
    tipo,
    causa: clase.causa,
    recuperacionInicio: clase.recuperacionInicio,
    recuperaInicio: clase.recuperaInicio,
    horas: h,
    creditosConsumidos: clase.creditosConsumidos,
    baseClp,
    variableClp,
    totalClp: baseClp + variableClp,
    explicacion,
  });

  if (clase.tipo === "especial") {
    return linea("especial", 0, 0, "Clase especial: se paga aparte, con su propia regla.");
  }

  if (clase.estado === "programada") {
    if (new Date(clase.inicio).getTime() > ahora.getTime()) {
      return linea("futura", 0, 0, "Todavía no ocurre.");
    }
    const variable = variableDeClase(clase.creditosConsumidos, tarifa);
    return linea(
      "dictada",
      baseDeClase(h, tarifa),
      variable,
      variable > 0
        ? `Base más ${clase.creditosConsumidos - tarifa.umbralVariable} créditos sobre ${tarifa.umbralVariable}.`
        : `Base. ${clase.creditosConsumidos} créditos: el variable empieza en el ${tarifa.umbralVariable + 1}.º.`,
    );
  }

  if (clase.causa === null) {
    return linea("sin_causa", 0, 0, "Falta decir por qué no se dictó. Hasta entonces no se puede pagar el mes.");
  }

  const efecto = efectoDeCausa(clase.causa, {
    recuperada: clase.recuperada,
    profesoraSePresento: clase.profesoraSePresento,
  });
  const porque = NOMBRE_CAUSA[clase.causa];
  const viajePerdido = clase.causa === "sala_no_disponible" && clase.profesoraSePresento;
  const explicacion = viajePerdido
    ? clase.recuperada
      ? `No se dictó (${porque}), pero la profesora se presentó: se paga la base, además de la recuperación.`
      : `No se dictó (${porque}), pero la profesora se presentó: se paga la base, sin variable.`
    : clase.recuperada
      ? `No se dictó (${porque}) y se recuperó: se paga una sola vez, en la recuperación.`
      : efecto === "base"
        ? `No se dictó (${porque}): se paga la base, sin variable.`
        : `No se dictó (${porque}): no se paga.`;

  // Sin variable aunque haya tenido reservas: al no dictarse, los créditos
  // vuelven a las alumnas, y una que no vuelve —cancelada tarde— no la dictó.
  return linea("no_dictada", efecto === "base" ? baseDeClase(h, tarifa) : 0, 0, explicacion);
}

/**
 * El incentivo de un curso en un mes (regla del 04/11/2026): el promedio de
 * las 4 mejores clases **dictadas**, con dos tramos que se suman.
 *
 * - Con menos de 4 dictadas, nada. Una recuperación es una dictada más.
 * - Las no dictadas no entran como cero: no entran.
 * - La comparación es **sin decimales**: suma de las mejores ≥ tramo × 4. Así
 *   13,75 no llega a 14 y 14,00 sí, sin redondeos que discutir.
 */
export function incentivoDeCurso(
  cursoId: string,
  creditosDeDictadas: number[],
): Omit<IncentivoDeCurso, "curso" | "clasesDelPromedio"> {
  const dictadas = creditosDeDictadas.length;
  if (dictadas < INCENTIVO.minimoDictadas) {
    return {
      cursoId,
      dictadas,
      mejores: [],
      promedio: null,
      tramos: 0,
      montoClp: 0,
      explicacion: `${dictadas} ${dictadas === 1 ? "clase dictada" : "clases dictadas"}: hacen falta ${INCENTIVO.minimoDictadas} para optar.`,
    };
  }

  const mejores = [...creditosDeDictadas].sort((a, b) => b - a).slice(0, INCENTIVO.mejores);
  const suma = mejores.reduce((t, n) => t + n, 0);
  const alcanzados = INCENTIVO.tramos.filter((t) => suma >= t.desdePromedio * INCENTIVO.mejores);
  const montoClp = alcanzados.reduce((t, x) => t + x.montoClp, 0);
  const promedio = suma / INCENTIVO.mejores;

  return {
    cursoId,
    dictadas,
    mejores,
    promedio,
    tramos: alcanzados.length,
    montoClp,
    explicacion:
      alcanzados.length === 0
        ? `Promedio ${formatoPromedio(promedio)} en sus ${INCENTIVO.mejores} mejores: el primer tramo es desde ${INCENTIVO.tramos[0].desdePromedio}.`
        : `Promedio ${formatoPromedio(promedio)} en sus ${INCENTIVO.mejores} mejores: ${alcanzados.length === 1 ? "primer tramo" : "los dos tramos"}.`,
  };
}

function formatoPromedio(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
}

// ---------------------------------------------------------------------------
// La liquidación
// ---------------------------------------------------------------------------

/**
 * Cuánto se le debe a una profesora en un mes.
 *
 * Recibe **todas** las clases que la base le entregue y se queda con las de esa
 * profesora y ese mes, en Santiago: lo que no es de ella no entra aunque
 * llegue. Así el reemplazo se le paga a quien dictó (decisión 3 del
 * 04/11/2026) sin que el llamador tenga que acordarse de filtrar.
 *
 * `tarifa` null es "sin costo cargado": se calcula con cero y queda bloqueada.
 * Un costo que falta no es un costo de cero.
 */
export function liquidar(entrada: {
  profesoraId: string;
  mes: string;
  clases: ClaseLiquidable[];
  tarifa: Tarifa | null;
  ahora: Date;
}): Liquidacion {
  const { profesoraId, mes, ahora } = entrada;
  const tarifa = entrada.tarifa ?? { baseHoraClp: 0, variableCreditoClp: 0, umbralVariable: 0 };

  const delMes = entrada.clases
    .filter((c) => c.profesoraId === profesoraId && mesEnSantiago(c.inicio) === mes)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  const lineas = delMes.map((c) => lineaDeClase(c, tarifa, ahora));

  // Incentivo por curso, con las dictadas de parrilla.
  const porCurso = new Map<string, Linea[]>();
  for (const l of lineas) {
    if (l.tipo !== "dictada") continue;
    porCurso.set(l.cursoId, [...(porCurso.get(l.cursoId) ?? []), l]);
  }
  const incentivos = [...porCurso.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cursoId, dictadas]): IncentivoDeCurso => {
      const incentivo = incentivoDeCurso(cursoId, dictadas.map((l) => l.creditosConsumidos));
      // Mismo orden que `mejores`; en un empate entra la primera del mes.
      const ordenadas = [...dictadas].sort(
        (a, b) => b.creditosConsumidos - a.creditosConsumidos || a.inicio.localeCompare(b.inicio),
      );
      return {
        ...incentivo,
        curso: dictadas[0].curso,
        clasesDelPromedio: ordenadas.slice(0, incentivo.mejores.length).map((l) => ({
          claseId: l.claseId,
          inicio: l.inicio,
          creditos: l.creditosConsumidos,
        })),
      };
    });

  const baseClp = lineas.reduce((t, l) => t + l.baseClp, 0);
  const variableClp = lineas.reduce((t, l) => t + l.variableClp, 0);
  const incentivoClp = incentivos.reduce((t, i) => t + i.montoClp, 0);

  const bloqueos: Bloqueo[] = [];
  if (mes < PRIMER_MES_LIQUIDABLE) bloqueos.push({ tipo: "antes_de_noviembre" });
  if (!mesTerminado(mes, ahora)) bloqueos.push({ tipo: "mes_en_curso" });
  if (entrada.tarifa === null) bloqueos.push({ tipo: "sin_tarifa" });
  const sinCausa = lineas.filter((l) => l.tipo === "sin_causa").length;
  if (sinCausa > 0) bloqueos.push({ tipo: "clases_sin_causa", cuantas: sinCausa });

  return {
    profesoraId,
    mes,
    lineas,
    incentivos,
    baseClp,
    variableClp,
    incentivoClp,
    totalClp: baseClp + variableClp + incentivoClp,
    especiales: lineas.filter((l) => l.tipo === "especial").length,
    bloqueos,
  };
}

/** Lo que dice cada bloqueo, en pantalla. */
export function textoDeBloqueo(b: Bloqueo): string {
  switch (b.tipo) {
    case "antes_de_noviembre":
      return "La liquidación empieza en noviembre de 2026: los meses anteriores se pagaron a mano.";
    case "mes_en_curso":
      return "El mes todavía no termina: puede cambiar hasta el último día.";
    case "sin_tarifa":
      return "Sin costo cargado: falta su tarifa en costos de profesoras.";
    case "clases_sin_causa":
      return `${b.cuantas} ${b.cuantas === 1 ? "clase cancelada o no dictada sin causa" : "clases canceladas o no dictadas sin causa"}.`;
  }
}

// ---------------------------------------------------------------------------
// Lo que no se está pagando
// ---------------------------------------------------------------------------

export type RazonDeNoPago =
  /** Se recupera en otro mes: se paga allá, no en este pago. */
  | "se_paga_otro_mes"
  /** Se recupera dentro del mes: ya está pagada, en la línea de la recuperación. */
  | "se_paga_en_la_recuperacion"
  /** No tiene fecha de recuperación. */
  | "sin_fecha"
  /** Falta decir por qué no se dictó. */
  | "sin_causa"
  /** La causa no paga, y no hay nada que recuperar. */
  | "no_paga"
  | "futura"
  | "especial";

export type NoPagada = {
  claseId: string;
  inicio: string;
  curso: string;
  sede: string;
  razon: RazonDeNoPago;
  /** Cuándo caería la recuperación, si tiene fecha. */
  cae: string | null;
  explicacion: string;
};

const MESES_NOMBRE = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-11" → "noviembre de 2026". */
export function nombreDeMes(mes: string): string {
  const [anio, numero] = mes.split("-").map(Number);
  return `${MESES_NOMBRE[numero - 1]} de ${anio}`;
}

/**
 * Lo que este pago deja afuera, y por qué (Felipe, 06/11/2026). Importa tanto
 * como el total: una clase del 27/11 recuperada el 3/12 se paga en diciembre,
 * y si eso no se ve se descubre cuando la profesora pregunta.
 *
 * Una no dictada que igual paga la base por `sala_no_disponible` con la
 * profesora presente no está acá si ya tiene recuperación: esa línea sí paga.
 */
export function noEntraEnEstePago(lineas: Linea[], mes: string): NoPagada[] {
  const salida: NoPagada[] = [];
  for (const l of lineas) {
    const fila = (razon: RazonDeNoPago, explicacion: string, cae: string | null = null) =>
      salida.push({ claseId: l.claseId, inicio: l.inicio, curso: l.curso, sede: l.sede, razon, cae, explicacion });

    if (l.tipo === "futura") fila("futura", "Todavía no ocurre.");
    if (l.tipo === "especial") fila("especial", "Clase especial: se paga aparte.");
    if (l.tipo === "sin_causa") {
      fila("sin_causa", "Falta decir por qué no se dictó. Hasta entonces no se puede cerrar el mes.", l.recuperacionInicio);
    }
    if (l.tipo !== "no_dictada" || l.causa === "cambio_de_parrilla") {
      if (l.tipo === "no_dictada") fila("no_paga", "Cambio de parrilla: esa clase nunca estuvo en su semana.");
      continue;
    }

    if (l.recuperacionInicio !== null) {
      if (l.totalClp > 0) continue;
      const otroMes = mesEnSantiago(l.recuperacionInicio);
      if (otroMes === mes) {
        fila("se_paga_en_la_recuperacion", "Se paga una sola vez, en la recuperación de este mismo mes.", l.recuperacionInicio);
      } else {
        fila("se_paga_otro_mes", `Se paga en ${nombreDeMes(otroMes)}, cuando se recupere. No entra en este pago.`, l.recuperacionInicio);
      }
      continue;
    }

    fila(
      "sin_fecha",
      l.totalClp > 0
        ? "Sin fecha de recuperación. Si se cierra así, se paga la base y después ya no se puede recuperar."
        : "Sin fecha de recuperación, y hoy no paga nada.",
    );
  }
  return salida;
}
