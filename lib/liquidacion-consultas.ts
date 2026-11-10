import { clienteServidor } from "./supabase/servidor";
import { comoTexto, type Lectura } from "./compras-consultas";
import {
  liquidar,
  noEntraEnEstePago,
  PRIMER_MES_LIQUIDABLE,
  type Causa,
  type ClaseLiquidable,
  type EstadoClase,
  type Liquidacion,
  type NoPagada,
  type Tarifa,
} from "./dominio/liquidacion";
import { diaEnSantiago } from "./semana";

/**
 * Lo que leen `/owner/liquidaciones` y `/profesora/liquidacion` (PRD-0010 parte
 * 3, paso E). Siempre con la sesión de quien mira: las funciones de la base
 * deciden qué ve cada una. La regla de pago vive en `lib/dominio/liquidacion.ts`.
 *
 * **El reloj es el de la base**, `hoy_santiago()`, el mismo con que
 * `cerrar_liquidacion()` decide si el mes terminó. Si la pantalla mirara otro,
 * podría ofrecer cerrar algo que la base rechaza.
 */

export type EstadoLiquidacion = "pendiente" | "cerrada" | "pagada";

/** Lo que se congela al cerrar. Sin ningún dato de una alumna (ADR-0008). */
export type FotoLiquidacion = Liquidacion & { noEntra: NoPagada[] };

export type FilaLiquidacion = {
  id: string;
  monto: number;
  huella: string;
  detalle: FotoLiquidacion;
  cerradaAt: string;
  pagadaAt: string | null;
  tieneComprobante: boolean;
};

export type LiquidacionDeProfesora = {
  profesoraId: string;
  nombre: string;
  /** Lo que da hoy. Es lo que se muestra mientras no esté cerrada. */
  calculo: FotoLiquidacion;
  huella: string;
  fila: FilaLiquidacion | null;
  estado: EstadoLiquidacion;
};

export type MesDeLiquidacion = {
  mes: string;
  hoy: string;
  /** De noviembre de 2026 al mes de hoy. */
  meses: string[];
  profesoras: LiquidacionDeProfesora[];
};

type Insumo = {
  clase_id: string;
  profesora_id?: string;
  curso_id: string;
  curso: string;
  sede: string;
  inicio: string;
  fin: string | null;
  tipo: "parrilla" | "especial";
  estado: EstadoClase;
  causa: Causa | null;
  profesora_se_presento: boolean;
  recuperada: boolean;
  creditos_consumidos: number;
  recuperacion_inicio: string | null;
  recupera_inicio: string | null;
  /** Solo si la marca cae en el mes que se mira o antes: lo filtra la base. */
  no_se_recupera_at: string | null;
};

const YO = "yo";

function aClase(i: Insumo): ClaseLiquidable {
  return {
    id: i.clase_id,
    profesoraId: i.profesora_id ?? YO,
    cursoId: i.curso_id,
    curso: i.curso,
    sede: i.sede,
    inicio: i.inicio,
    fin: i.fin,
    tipo: i.tipo,
    estado: i.estado,
    causa: i.causa,
    profesoraSePresento: i.profesora_se_presento,
    recuperada: i.recuperada,
    recuperacionInicio: i.recuperacion_inicio,
    recuperaInicio: i.recupera_inicio,
    noSeRecuperaAt: i.no_se_recupera_at ?? null,
    creditosConsumidos: i.creditos_consumidos,
  };
}

function foto(entrada: Parameters<typeof liquidar>[0]): FotoLiquidacion {
  const l = liquidar(entrada);
  return { ...l, noEntra: noEntraEnEstePago(l.lineas, entrada.mes) };
}

/**
 * "Ahora", según la base. Si la base dice que hoy es hoy, la hora real, para que
 * la clase de esta noche siga siendo futura; si dice otro día, el fin de ese día.
 */
function ahoraDe(hoy: string): Date {
  const real = new Date();
  return diaEnSantiago(real) === hoy ? real : new Date(`${hoy}T23:59:00-03:00`);
}

/** Del primer mes liquidable al de hoy, el más reciente primero. */
export function mesesDesdeElPrimero(hoy: string): string[] {
  const meses: string[] = [];
  let [anio, mes] = PRIMER_MES_LIQUIDABLE.split("-").map(Number);
  const hasta = hoy.slice(0, 7);
  for (;;) {
    const actual = `${anio}-${String(mes).padStart(2, "0")}`;
    if (actual > hasta) break;
    meses.unshift(actual);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }
  return meses;
}

/** El mes que abre la página: el último terminado; antes de eso, el primero. */
function mesPorDefecto(meses: string[]): string {
  return meses[1] ?? meses[0];
}

function elegirMes(pedido: string | undefined, meses: string[]): string {
  return pedido && meses.includes(pedido) ? pedido : mesPorDefecto(meses);
}

const vacio = (hoy: string): MesDeLiquidacion => ({ mes: "", hoy, meses: [], profesoras: [] });

export async function getLiquidaciones(mesPedido?: string): Promise<Lectura<MesDeLiquidacion>> {
  const supabase = await clienteServidor();

  const { data: hoyDato, error: errorHoy } = await supabase.rpc("hoy_santiago");
  if (errorHoy) return { datos: vacio(""), error: comoTexto(errorHoy) };
  const hoy = hoyDato as string;
  const meses = mesesDesdeElPrimero(hoy);
  const mes = elegirMes(mesPedido, meses);
  const primerDia = `${mes}-01`;

  const [insumos, huellas, filas, tarifas, profesoras] = await Promise.all([
    supabase.rpc("insumos_liquidacion", { p_mes: primerDia }),
    supabase.rpc("huellas_liquidacion", { p_mes: primerDia }),
    supabase
      .from("liquidaciones_profesoras")
      .select("id, profesora_id, monto_clp, huella, detalle, cerrada_at, pagada_at, comprobante_path")
      .eq("mes", primerDia)
      .is("deleted_at", null),
    supabase.from("costos_profesoras").select("profesora_id, base_hora_clp, variable_credito_clp, umbral_variable"),
    supabase.from("profesoras").select("id, nombre, activa").order("orden"),
  ]);

  const fallo =
    comoTexto(insumos.error) ?? comoTexto(huellas.error) ?? comoTexto(filas.error) ??
    comoTexto(tarifas.error) ?? comoTexto(profesoras.error);
  if (fallo) return { datos: vacio(hoy), error: fallo };

  const clases = ((insumos.data ?? []) as Insumo[]).map(aClase);
  const ahora = ahoraDe(hoy);
  const huellaDe = new Map(
    ((huellas.data ?? []) as { profesora_id: string; huella: string }[]).map((h) => [h.profesora_id, h.huella]),
  );
  type FilaTarifa = { profesora_id: string; base_hora_clp: number; variable_credito_clp: number; umbral_variable: number };
  const tarifaDe = new Map(
    ((tarifas.data ?? []) as FilaTarifa[]).map((t): [string, Tarifa] => [
      t.profesora_id,
      { baseHoraClp: t.base_hora_clp, variableCreditoClp: t.variable_credito_clp, umbralVariable: t.umbral_variable },
    ]),
  );
  type Fila = {
    id: string; profesora_id: string; monto_clp: number; huella: string; detalle: FotoLiquidacion;
    cerrada_at: string; pagada_at: string | null; comprobante_path: string | null;
  };
  const filaDe = new Map(((filas.data ?? []) as Fila[]).map((f) => [f.profesora_id, f]));

  const lista = ((profesoras.data ?? []) as { id: string; nombre: string; activa: boolean }[])
    .filter((p) => p.activa || clases.some((c) => c.profesoraId === p.id))
    .map((p): LiquidacionDeProfesora => {
      const f = filaDe.get(p.id);
      return {
        profesoraId: p.id,
        nombre: p.nombre,
        calculo: foto({ profesoraId: p.id, mes, clases, tarifa: tarifaDe.get(p.id) ?? null, ahora }),
        huella: huellaDe.get(p.id) ?? "",
        fila: f
          ? {
              id: f.id,
              monto: f.monto_clp,
              huella: f.huella,
              detalle: f.detalle,
              cerradaAt: f.cerrada_at,
              pagadaAt: f.pagada_at,
              tieneComprobante: f.comprobante_path !== null,
            }
          : null,
        estado: !f ? "pendiente" : f.pagada_at ? "pagada" : "cerrada",
      };
    });

  return { datos: { mes, hoy, meses, profesoras: lista }, error: null };
}

/** Lo que `cerrarLiquidacion` vuelve a calcular: nunca se confía en lo que manda el navegador. */
export async function calcularParaCerrar(
  profesoraId: string,
  mes: string,
): Promise<{ foto: FotoLiquidacion } | { error: string }> {
  const lectura = await getLiquidaciones(mes);
  if (lectura.error) return { error: lectura.error };
  if (lectura.datos.mes !== mes) return { error: "Ese mes no se puede liquidar." };
  const p = lectura.datos.profesoras.find((x) => x.profesoraId === profesoraId);
  return p ? { foto: p.calculo } : { error: "Esa profesora no tiene nada en ese mes." };
}

export type MiLiquidacion = {
  mes: string;
  hoy: string;
  meses: string[];
  foto: FotoLiquidacion;
  estado: EstadoLiquidacion;
  cerradaAt: string | null;
  pagadaAt: string | null;
};

/** La suya y nada más: todo lo filtra la base por la sesión (ADR-0008). */
export async function getMiLiquidacion(mesPedido?: string): Promise<Lectura<MiLiquidacion | null>> {
  const supabase = await clienteServidor();

  const { data: hoyDato, error: errorHoy } = await supabase.rpc("hoy_santiago");
  if (errorHoy) return { datos: null, error: comoTexto(errorHoy) };
  const hoy = hoyDato as string;
  const meses = mesesDesdeElPrimero(hoy);
  const mes = mesPedido && meses.includes(mesPedido) ? mesPedido : meses[0];
  const primerDia = `${mes}-01`;

  const [insumos, tarifa, liquidaciones] = await Promise.all([
    supabase.rpc("mis_insumos_liquidacion", { p_mes: primerDia }),
    supabase.rpc("mi_tarifa"),
    supabase.rpc("mis_liquidaciones"),
  ]);
  const fallo = comoTexto(insumos.error) ?? comoTexto(tarifa.error) ?? comoTexto(liquidaciones.error);
  if (fallo) return { datos: null, error: fallo };

  type Mia = { mes: string; monto_clp: number; cerrada_at: string; pagada_at: string | null; detalle: FotoLiquidacion };
  const fila = ((liquidaciones.data ?? []) as Mia[]).find((l) => l.mes === primerDia);
  const t = ((tarifa.data ?? []) as { base_hora_clp: number; variable_credito_clp: number; umbral_variable: number }[])[0];

  return {
    datos: {
      mes,
      hoy,
      meses,
      foto:
        fila?.detalle ??
        foto({
          profesoraId: YO,
          mes,
          clases: ((insumos.data ?? []) as Insumo[]).map(aClase),
          tarifa: t
            ? { baseHoraClp: t.base_hora_clp, variableCreditoClp: t.variable_credito_clp, umbralVariable: t.umbral_variable }
            : null,
          ahora: ahoraDe(hoy),
        }),
      estado: !fila ? "pendiente" : fila.pagada_at ? "pagada" : "cerrada",
      cerradaAt: fila?.cerrada_at ?? null,
      pagadaAt: fila?.pagada_at ?? null,
    },
    error: null,
  };
}
