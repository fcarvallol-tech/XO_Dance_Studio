import { clp } from "@/lib/planes";

/**
 * Las piezas del tablero de owner.
 *
 * Todas están hechas alrededor de un problema: **un tablero en cero se ve igual
 * si funciona que si está roto**. Por eso ningún indicador muestra un número
 * pelado. Cada uno lleva su denominador, y cuando vale cero lleva además desde
 * cuándo no pasa nada, que es lo que separa "este mes no hubo" de "nunca hubo".
 *
 * Fondo claro, como el resto de los portales (BRAND.md §8). Ojo con el rosa:
 * sobre claro da 1.7:1 y **no sirve para texto**, solo como borde o fondo de
 * bloque. Los números grandes van en Bebas, que es la voz de la marca.
 */

/** Un porcentaje con un decimal, o el guion largo si no hay con qué calcularlo. */
export function pct(tasa: number | null): string {
  return tasa === null ? "—" : `${(tasa * 100).toFixed(1).replace(".", ",")}%`;
}

/** "1 clase dictada" y no "1 clases dictadas". */
export function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Plata con el signo por fuera del peso.
 *
 * `clp(-55500)` da "$-55.500", que se lee como un precio raro y no como una
 * caída. El signo va antes del símbolo.
 */
export function clpConSigno(monto: number): string {
  return `${monto < 0 ? "-" : "+"}${clp(Math.abs(monto))}`;
}

/** Una fecha corta en la zona de la academia. Nunca en UTC. */
export function hora24(iso: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function fechaCorta(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

export function Bloque({
  titulo,
  bajada,
  children,
}: {
  titulo: string;
  bajada?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14 first:mt-0">
      <h2 className="xo-eyebrow text-xo-gris">{titulo}</h2>
      {bajada ? (
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-xo-gris">{bajada}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Rejilla({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-px border border-xo-negro/10 bg-xo-negro/10 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}

export type Comparado = {
  /** El valor del período anterior. Sirve para no mostrar "+$0" contra un cero. */
  anterior: number | null;
  absoluta: number | null;
  relativa: number | null;
};

export function Indicador({
  rotulo,
  valor,
  denominador,
  comparacion,
  comparacionEnPesos,
  sinDatoDesde,
  destacado,
  nota,
}: {
  rotulo: string;
  /** Ya formateado: acá no se decide si es plata, cantidad o porcentaje. */
  valor: string;
  /** El absoluto que acompaña al porcentaje, o el contexto del número. */
  denominador?: string;
  comparacion?: Comparado;
  comparacionEnPesos?: boolean;
  /**
   * Qué decir cuando el valor es cero: desde cuándo no pasa nada. Un cero con
   * procedencia es un dato; un cero pelado es una incógnita.
   */
  sinDatoDesde?: string;
  destacado?: boolean;
  nota?: string;
}) {
  const sube = comparacion?.absoluta != null && comparacion.absoluta > 0;
  const baja = comparacion?.absoluta != null && comparacion.absoluta < 0;
  const signo = sube ? "+" : "";

  return (
    <div className={`bg-xo-blanco p-5 ${destacado ? "sm:col-span-2 lg:col-span-1" : ""}`}>
      <p className="xo-eyebrow text-xo-gris">{rotulo}</p>
      <p
        className={`mt-3 font-display leading-none text-xo-negro ${
          destacado ? "text-[clamp(3rem,9vw,4.5rem)]" : "text-[clamp(2.25rem,7vw,3rem)]"
        }`}
      >
        {valor}
      </p>

      {denominador ? (
        <p className="mt-2 text-sm text-xo-gris">{denominador}</p>
      ) : null}

      {/* Cuando los dos meses están en cero, la comparación es ruido: "+$0 · el
          mes anterior fue cero" no agrega nada sobre la línea que ya explica
          desde cuándo no pasa nada. */}
      {comparacion && !(comparacion.absoluta === 0 && comparacion.anterior === 0) ? (
        <p className="mt-3 text-sm text-xo-gris">
          {comparacion.absoluta === null ? (
            "Sin período anterior con que comparar"
          ) : comparacion.absoluta === 0 ? (
            "Igual que el mes anterior"
          ) : (
            <>
              <span className={baja || sube ? "font-medium text-xo-negro" : ""}>
                {comparacionEnPesos
                  ? clpConSigno(comparacion.absoluta)
                  : `${signo}${comparacion.absoluta}`}
              </span>{" "}
              {comparacion.relativa === null
                ? "· el mes anterior fue cero"
                : `· ${signo}${pct(comparacion.relativa)} vs. el mes anterior`}
            </>
          )}
        </p>
      ) : null}

      {sinDatoDesde ? (
        <p className="mt-3 border-l-2 border-xo-rosa pl-3 text-sm text-xo-gris">
          {sinDatoDesde}
        </p>
      ) : null}

      {nota ? <p className="mt-3 text-sm text-xo-gris">{nota}</p> : null}
    </div>
  );
}

/**
 * La franja de conciliación.
 *
 * Es el único número del tablero cuyo valor correcto se conoce sin mirar los
 * datos: el libro de movimientos y la suma de los lotes tienen que dar igual.
 * Si no dan, todo el bloque de créditos es sospechoso y hay que decirlo antes
 * de que alguien decida algo mirándolo.
 */
export function FranjaConciliacion({
  libro,
  lotes,
  cuadra,
  leidoA,
}: {
  libro: number;
  lotes: number;
  cuadra: boolean;
  leidoA: string;
}) {
  if (!cuadra) {
    return (
      <div role="alert" className="mb-10 border-l-2 border-xo-negro bg-xo-negro/5 py-4 pl-5">
        <p className="font-medium text-xo-negro">
          El libro y los lotes no cuadran: {libro} contra {lotes}.
        </p>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-xo-gris">
          Todo lo que sigue sobre créditos es sospechoso. La suma de
          `movimientos_credito` debería dar igual que la suma de lo disponible en
          los lotes; que no den es un descuadre de datos, no un problema de esta
          pantalla. Avísale a Felipe antes de decidir nada con estos números.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-10 border-l-2 border-xo-rosa py-3 pl-5">
      <p className="text-sm text-xo-gris">
        <span className="font-medium text-xo-negro">Libro y lotes cuadran</span> en{" "}
        {libro} créditos. Leído a las {leidoA}.
      </p>
    </div>
  );
}

/**
 * Un indicador que no existe todavía, con el motivo.
 *
 * Existe porque un indicador ausente se nota y uno en cero no. Mostrar "0
 * no-shows" cuando nada registra asistencia sería mentir con un número.
 */
export function SinDato({ rotulo, porque }: { rotulo: string; porque: string }) {
  return (
    <div className="bg-xo-blanco p-5">
      <p className="xo-eyebrow text-xo-gris">{rotulo}</p>
      <p className="mt-3 font-display text-[clamp(2.25rem,7vw,3rem)] leading-none text-xo-negro/25">
        sin dato
      </p>
      <p className="mt-2 text-sm leading-relaxed text-xo-gris">{porque}</p>
    </div>
  );
}

/** Una tabla angosta que en móvil se desplaza sola en vez de romper la página. */
export function Tabla({
  columnas,
  children,
}: {
  columnas: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto border border-xo-negro/10">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-xo-negro/10">
            {columnas.map((c, i) => (
              <th
                key={c}
                scope="col"
                className={`xo-eyebrow px-4 py-3 text-xo-gris ${
                  i === 0 ? "text-left" : "text-right"
                }`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Fila({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-xo-negro/10 last:border-0">{children}</tr>;
}

export function Celda({
  children,
  principal,
  apagada,
}: {
  children: React.ReactNode;
  principal?: boolean;
  apagada?: boolean;
}) {
  return (
    <td
      className={`px-4 py-3 ${principal ? "text-left text-xo-negro" : "text-right"} ${
        apagada ? "text-xo-gris" : "text-xo-negro"
      }`}
    >
      {children}
    </td>
  );
}
