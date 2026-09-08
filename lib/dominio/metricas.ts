/**
 * Métricas del tablero de owner: la parte que **divide, compara y redondea**.
 *
 * El reparto con el SQL es deliberado (PRD-0010 §8.2): las funciones de la base
 * suman, cuentan y agrupan, que es lo que Postgres hace bien, y acá se calcula
 * todo lo que tiene un denominador. Así lo que se rompe callado —dividir por
 * cero, comparar contra un período vacío, un porcentaje sobre cuatro personas—
 * queda en funciones puras con tests, y no hay lógica duplicada: el SQL nunca
 * divide y esto nunca consulta.
 *
 * **Ninguna función devuelve `NaN`, `Infinity` ni un `0` inventado.** Cuando no
 * hay con qué calcular, devuelven `null`, y la tarjeta muestra "sin datos" en
 * vez de un cero que no se distingue de estar roto. Ese es el punto del módulo.
 *
 * Dinero: enteros CLP, siempre. Sin decimales, sin floats acumulados.
 */

// ---------------------------------------------------------------------------
// Tasas y comparaciones
// ---------------------------------------------------------------------------

/**
 * Una tasa entre 0 y 1, o `null` cuando no hay denominador.
 *
 * `null` y `0` son cosas distintas: "nadie usó sus créditos" no es lo mismo que
 * "todavía no hay créditos". El tablero los muestra distinto.
 */
export function tasa(parte: number, total: number): number | null {
  if (!Number.isFinite(parte) || !Number.isFinite(total)) return null;
  if (total <= 0) return null;
  return parte / total;
}

export type Comparacion = {
  actual: number;
  /** `null` cuando no hubo período anterior con que comparar. */
  anterior: number | null;
  /** La diferencia, en la unidad del indicador. Es lo que se muestra al lado del %. */
  absoluta: number | null;
  /** La variación relativa. `null` cuando no se puede expresar como porcentaje. */
  relativa: number | null;
};

/**
 * Compara un período contra el anterior.
 *
 * Dos casos que **no** son el mismo y que devuelven cosas distintas:
 *
 * - **No hubo período anterior** (`anterior === null`): no hay diferencia ni
 *   porcentaje. La tarjeta dice "sin período anterior".
 * - **El período anterior fue cero**: la diferencia absoluta sí existe y es el
 *   valor actual, pero el porcentaje no: crecer desde cero no es "+100%", es una
 *   división por cero disfrazada. Ver PRD-0010 §10.
 */
export function comparar(actual: number, anterior: number | null): Comparacion {
  if (anterior === null || !Number.isFinite(anterior)) {
    return { actual, anterior: null, absoluta: null, relativa: null };
  }
  return {
    actual,
    anterior,
    absoluta: actual - anterior,
    relativa: anterior === 0 ? null : (actual - anterior) / anterior,
  };
}

// ---------------------------------------------------------------------------
// Créditos: la brecha y la conciliación
// ---------------------------------------------------------------------------

export type Creditos = {
  /** Otorgados en total, histórico: comprados más regalados. */
  otorgadas: number;
  /** Consumo **neto**: las reservas restan, las devoluciones suman. */
  consumidas: number;
  /** Suma de `cantidad_disponible` de **todos** los lotes, vigentes y vencidos. */
  disponibles: number;
  /** Disponibles en lotes que ya vencieron. */
  vencidas: number;
};

export type Brecha = Creditos & {
  /**
   * Lo que todavía se debe: plata cobrada por un servicio no entregado, que
   * sigue siendo exigible.
   */
  pasivoVigente: number;
  /** Tasa de utilización, acumulada. Ver PRD-0010 §5.1. */
  utilizacion: number | null;
};

/**
 * La brecha tiene **tres** partes, no dos.
 *
 * El PRD original la definía como vendidas − consumidas, y eso sobreestima el
 * pasivo: incluye créditos que ya vencieron y que nadie va a usar. Un crédito
 * vencido dejó de ser una deuda y pasó a ser margen. Se separa, no se suma.
 *
 * ⚠️ **El pasivo se mide, no se deduce.** Sale de los lotes —disponibles menos
 * vencidos—, no de restarle el consumo a lo otorgado. Las dos cuentas dan igual
 * mientras nadie use movimientos de tipo `ajuste`, que no son ni venta ni
 * consumo: al primer ajuste, la resta miente y la medición no. Que ambas
 * coincidan es justamente lo que verifica `conciliacion`.
 */
export function brecha(c: Creditos): Brecha {
  return {
    ...c,
    pasivoVigente: c.disponibles - c.vencidas,
    utilizacion: tasa(c.consumidas, c.otorgadas),
  };
}

export type Conciliacion = {
  /** Suma de `movimientos_credito.cantidad`. */
  libro: number;
  /** Suma de `creditos.cantidad_disponible`, vigentes y vencidos. */
  lotes: number;
  diferencia: number;
  cuadra: boolean;
};

/**
 * El único número del tablero cuyo valor correcto se conoce sin mirar los datos:
 * el libro y los lotes tienen que dar igual.
 *
 * Si no cuadran, todo el bloque de créditos es sospechoso y la franja se pinta
 * roja. Ver PRD-0010 §5.1.b.
 *
 * ⚠️ No se concilia contra `movimientos_credito.saldo_resultante`: esa columna
 * guarda el saldo **vigente** al momento del asiento —`saldo_creditos()` filtra
 * por `fecha_vencimiento > now()`— así que no es el acumulado del libro y no
 * cuadra con él por diseño.
 */
export function conciliacion(libro: number, lotes: number): Conciliacion {
  const diferencia = libro - lotes;
  return { libro, lotes, diferencia, cuadra: diferencia === 0 };
}

// ---------------------------------------------------------------------------
// Venta
// ---------------------------------------------------------------------------

/** Enteros CLP: el ticket promedio se redondea, nunca se arrastra con decimales. */
export function ticketPromedio(ingresosClp: number, compras: number): number | null {
  if (compras <= 0) return null;
  return Math.round(ingresosClp / compras);
}

export type PlanVendido = { slug: string; nombre: string; compras: number };

/**
 * El plan más vendido del período. **Devuelve todos los empatados**, no el
 * primero que salga: con los volúmenes de los primeros meses el empate es el
 * caso normal, no el borde. Ver PRD-0010 §10.
 */
export function planesMasVendidos(planes: PlanVendido[]): PlanVendido[] {
  const conVentas = planes.filter((p) => p.compras > 0);
  if (conVentas.length === 0) return [];
  const tope = Math.max(...conVentas.map((p) => p.compras));
  return conVentas.filter((p) => p.compras === tope);
}

// ---------------------------------------------------------------------------
// Demanda
// ---------------------------------------------------------------------------

export type ClaseOcupada = { reservas: number; cupo: number };

export type Ocupacion = {
  tasa: number | null;
  /** Los absolutos van siempre con el porcentaje. PRD-0010 §7.4. */
  reservas: number;
  cupos: number;
  clases: number;
};

/**
 * Ocupación promedio sobre el cupo real de cada clase, no sobre 22 fijo: el
 * cupo se copia del horario al generar la clase y una clase vieja puede tener
 * otro.
 *
 * ⚠️ **Quien llama pasa solo las clases que ocurrieron.** Una clase cancelada no
 * es un horario muerto, es una clase que no ocurrió, y arrastra el promedio
 * hacia abajo sin que eso signifique nada. Ver PRD-0010 §7.5.
 */
export function ocupacionPromedio(clases: ClaseOcupada[]): Ocupacion {
  const validas = clases.filter((c) => c.cupo > 0);
  const reservas = validas.reduce((suma, c) => suma + c.reservas, 0);
  const cupos = validas.reduce((suma, c) => suma + c.cupo, 0);
  return { tasa: tasa(reservas, cupos), reservas, cupos, clases: validas.length };
}

export type ReservaAtribuible = {
  /** Monto de la compra que originó el lote. `null` en un lote de regalo. */
  montoCompraClp: number | null;
  /** Clases de esa compra. `null` en un lote de regalo. */
  clasesCompra: number | null;
  /** Canceló a tiempo, o XO canceló la clase: el crédito volvió a su lote. */
  recuperoCredito: boolean;
  /** La clase ya pasó. */
  claseYaOcurrio: boolean;
  /**
   * Cuántas reservas idénticas representa esta fila. Por omisión, una.
   *
   * Existe para que el SQL pueda **agrupar** por los cuatro atributos de
   * arriba en vez de devolver una fila por reserva: en un mes lleno son
   * cientos de filas que la página tendría que arrastrar para calcular una
   * sola cifra. Agrupadas son un puñado, y el SQL sigue sin dividir.
   */
  n?: number;
};

/**
 * Lo que vale una reserva para la profesora que dicta esa clase.
 *
 * Regla completa en PRD-0010 §7.1. En resumen: el precio unitario del lote que
 * la pagó, cero si el crédito volvió, y **cero si el lote era un regalo** —un
 * regalo no trajo plata, y atribuirle el precio de lista inventaría un ingreso
 * que nunca existió.
 *
 * Una cancelación tardía sí atribuye: la alumna perdió el crédito, la clase se
 * dictó igual y la plata se ganó igual.
 */
export function valorReserva(r: ReservaAtribuible): number {
  if (r.recuperoCredito) return 0;
  if (r.montoCompraClp === null || r.clasesCompra === null) return 0;
  if (r.clasesCompra <= 0) return 0;
  return Math.round(r.montoCompraClp / r.clasesCompra);
}

export type Atribucion = {
  /** Clases que ya ocurrieron: plata ganada y servicio entregado. */
  dictado: number;
  /** Clases futuras: todavía puede evaporarse en una cancelación. */
  comprometido: number;
  /** La suma. Solo se muestra rotulada y con las dos partes al lado. */
  total: number;
};

/**
 * Ingreso atribuido a una profesora, **partido en dos**.
 *
 * La atribución ocurre al reservar (la compra no elige profesora), y el
 * calendario abre 60 días: sin separar, el número sería en buena parte clases
 * que todavía no dicta, y se leería como plata ganada. Ver PRD-0010 §7.1.b.
 */
export function atribuir(reservas: ReservaAtribuible[]): Atribucion {
  let dictado = 0;
  let comprometido = 0;
  for (const r of reservas) {
    const valor = valorReserva(r) * (r.n ?? 1);
    if (r.claseYaOcurrio) dictado += valor;
    else comprometido += valor;
  }
  return { dictado, comprometido, total: dictado + comprometido };
}
