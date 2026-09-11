import { clienteServidor } from "./supabase/servidor";
import { comoTexto, type Lectura } from "./compras-consultas";
import type { Periodo } from "./dominio/periodo";

/**
 * Las dos consultas del tablero de owner. **Solo servidor.**
 *
 * Van con la sesión de quien mira, no con la service role key: las funciones
 * verifican `tiene_nivel('owner')` adentro y RLS queda puesto debajo. Si algún
 * día una política estuviera mal, esto devuelve error o vacío, no las métricas
 * del negocio a un admin.
 *
 * **Dos llamadas para toda la página.** Cada consulta al portal es una ida y
 * vuelta HTTP que se cuenta de a una; la identidad ya viene memoizada con
 * `cache()` desde el layout. Total: tres.
 *
 * Acá no se calcula nada. Las tasas, brechas, promedios y comparaciones las
 * hace `lib/dominio/metricas.ts`, que tiene tests.
 */

export type Resumen = {
  meta: {
    desde: string;
    hasta: string;
    desde_anterior: string;
    hasta_anterior: string;
    generado_at: string;
  };
  venta: {
    ingresos_clp: number;
    compras: number;
    por_plan: { slug: string; nombre: string; compras: number; monto_clp: number }[];
    pendientes: { compras: number; monto_clp: number };
  };
  venta_anterior: { ingresos_clp: number; compras: number };
  creditos: {
    vendidas: number;
    regaladas: number;
    consumidas: number;
    otorgadas_historico: number;
    consumidas_historico: number;
    disponibles: number;
    vencidas_sin_usar: number;
    por_vencer_30d: number;
  };
  creditos_anterior: { vendidas: number; regaladas: number; consumidas: number };
  conciliacion: { libro: number; lotes: number };
  /** Sin filtro de período: lo que permite distinguir un mes en cero de una base vacía. */
  desde_siempre: {
    ingresos_clp: number;
    compras: number;
    ultima_compra_at: string | null;
    ultimo_movimiento_at: string | null;
    ultima_reserva_at: string | null;
    ultima_clase_at: string | null;
  };
  alumnas: {
    cuentas: number;
    activas: number;
    en_riesgo: number;
    con_compra: number;
    con_recompra: number;
    con_reserva: number;
  };
  operacion: {
    cancelaciones: number;
    con_devolucion: number;
    sin_devolucion: number;
    por_clase_cancelada: number;
  };
};

export type ClaseDemanda = {
  clase_id: string;
  fecha: string;
  inicio: string;
  estado: string;
  curso: string;
  profesora: string;
  sede: string;
  cupo: number;
  reservas: number;
  dictada: boolean;
};

export type HorarioDemanda = {
  horario_id: string;
  dia_semana: number;
  hora: string;
  curso: string;
  profesora: string;
  sede: string;
  clases_dictadas: number;
  reservas: number;
  cupos: number;
};

/** La atribución llega agrupada: el precio unitario lo calcula `lib/dominio`. */
export type GrupoAtribucion = {
  monto_compra_clp: number | null;
  clases_compra: number | null;
  recupero_credito: boolean;
  clase_ya_ocurrio: boolean;
  n: number;
};

export type ProfesoraDemanda = {
  profesora_id: string;
  slug: string;
  nombre: string;
  reservas: number;
  atribucion: GrupoAtribucion[];
};

/**
 * Cómo se cayeron las reservas pendientes de pago de las clases especiales
 * (PRD-0018 §8.3.b). `soltadas` y `expiradas` son estados distintos en la base
 * a propósito: la primera es la alumna arrepintiéndose, la segunda somos
 * nosotros no aprobando a tiempo. `vigentes_ahora` no lleva período: es una
 * foto de los cupos tomados por alguien que todavía no transfiere.
 */
export type PendientesDemanda = {
  soltadas: number;
  expiradas: number;
  expiradas_por_clase_cancelada: number;
  vigentes_ahora: number;
};

export type Demanda = {
  meta: { desde: string; hasta: string; generado_at: string };
  pendientes: PendientesDemanda;
  por_clase: ClaseDemanda[];
  por_horario: HorarioDemanda[];
  por_profesora: ProfesoraDemanda[];
};

export async function getResumen(
  periodo: Periodo,
  anterior: Periodo,
): Promise<Lectura<Resumen | null>> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("metricas_resumen", {
    p_desde: periodo.desde.toISOString(),
    p_hasta: periodo.hasta.toISOString(),
    p_desde_ant: anterior.desde.toISOString(),
    p_hasta_ant: anterior.hasta.toISOString(),
  });

  return { datos: (data as Resumen | null) ?? null, error: comoTexto(error) };
}

export async function getDemanda(periodo: Periodo): Promise<Lectura<Demanda | null>> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("metricas_demanda", {
    p_desde: periodo.desde.toISOString(),
    p_hasta: periodo.hasta.toISOString(),
  });

  return { datos: (data as Demanda | null) ?? null, error: comoTexto(error) };
}
