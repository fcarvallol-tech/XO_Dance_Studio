import { clienteServidor } from "./supabase/servidor";
import { comoTexto, type Lectura } from "./compras-consultas";
import type { Periodo } from "./dominio/periodo";

/**
 * Las consultas de la página de finanzas del owner. **Solo servidor.**
 *
 * `metricas_finanzas` va con la sesión de quien mira: verifica
 * `tiene_nivel('owner')` en su primera línea, porque es `security definer`
 * —lee `sedes.costo_hora_clp`, que no está concedido a `authenticated`— y
 * RLS no la frena. Un admin recibe 42501, no una lista vacía.
 *
 * Acá no se calcula nada. La caja neta, las horas de una clase, su costo y su
 * margen los hace `lib/dominio/finanzas.ts`, que tiene tests. La página de
 * finanzas resuelve en tres llamadas: la identidad (memoizada), el resumen de
 * la parte 1 —que ya trae los ingresos— y esta.
 */

export type EgresoFila = {
  id: string;
  /** Un día, `YYYY-MM-DD`. No un instante. */
  fecha: string;
  categoria: string;
  categoria_nombre: string;
  descripcion: string;
  monto_clp: number;
  sede: string | null;
  tiene_comprobante: boolean;
};

/** La atribución llega agrupada: el precio unitario lo calcula `lib/dominio`. */
export type GrupoAtribucionClase = {
  monto_compra_clp: number | null;
  clases_compra: number | null;
  recupero_credito: boolean;
  n: number;
};

export type ClaseFinanzas = {
  clase_id: string;
  inicio: string;
  /** `null` en la parrilla: dura una hora. Las especiales e intensivos lo traen. */
  fin: string | null;
  curso: string;
  profesora: string;
  sede: string;
  costo_hora_sala_clp: number | null;
  base_hora_profesora_clp: number | null;
  variable_credito_clp: number | null;
  creditos_consumidos: number;
  atribucion: GrupoAtribucionClase[];
};

export type Finanzas = {
  meta: {
    desde: string;
    hasta: string;
    desde_anterior: string;
    hasta_anterior: string;
    generado_at: string;
  };
  egresos: { total_clp: number; n: number; lista: EgresoFila[] };
  egresos_anterior: { total_clp: number; n: number };
  /** Sin filtro de período: lo que permite decir "nunca se ha registrado uno". */
  desde_siempre: { total_clp: number; n: number; ultimo_egreso: string | null };
  /** Solo clases de parrilla que ya ocurrieron y no se cancelaron. */
  por_clase: ClaseFinanzas[];
};

export async function getFinanzas(
  periodo: Periodo,
  anterior: Periodo,
): Promise<Lectura<Finanzas | null>> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("metricas_finanzas", {
    p_desde: periodo.desde.toISOString(),
    p_hasta: periodo.hasta.toISOString(),
    p_desde_ant: anterior.desde.toISOString(),
    p_hasta_ant: anterior.hasta.toISOString(),
  });

  return { datos: (data as Finanzas | null) ?? null, error: comoTexto(error) };
}

export type OpcionesEgreso = {
  /** Las categorías activas, en su orden. Viven en la base y se editan ahí. */
  categorias: { slug: string; nombre: string }[];
  sedes: { id: string; nombre: string }[];
};

/**
 * Lo que el formulario de egreso ofrece elegir. Con la sesión del owner: la
 * política de `categorias_egreso` es de solo owner, así que a cualquier otro
 * esto le devuelve vacío y el formulario no puede ni empezar.
 */
export async function getOpcionesEgreso(): Promise<Lectura<OpcionesEgreso>> {
  const supabase = await clienteServidor();
  const [categorias, sedes] = await Promise.all([
    supabase.from("categorias_egreso").select("slug, nombre").eq("activa", true).order("orden"),
    supabase.from("sedes").select("id, nombre").eq("activa", true).is("deleted_at", null).order("orden"),
  ]);

  return {
    datos: {
      categorias: (categorias.data ?? []) as { slug: string; nombre: string }[],
      sedes: (sedes.data ?? []) as { id: string; nombre: string }[],
    },
    error: comoTexto(categorias.error) ?? comoTexto(sedes.error),
  };
}
