import { clienteAdmin } from "./supabase/admin";
import { clienteServidor } from "./supabase/servidor";
import { comoTexto, type Lectura } from "./compras-consultas";
import { DIAS_HACIA_ATRAS, conCreditoVencido, porRecuperar } from "./dominio/recuperativas";
import type { Causa } from "./dominio/liquidacion";

/**
 * Lo que necesita `/admin/recuperativas` (PRD-0027).
 *
 * Con la sesión de quien mira, salvo a quién hay que avisarle: eso devuelve
 * correos y la función solo se abre a la service role. De acá solo sale cuántas
 * son, nunca quiénes.
 */

export type ClasePorRecuperar = {
  id: string;
  inicio: string;
  curso: string;
  profesora: string;
  profesoraId: string;
  sede: string;
  sedeId: string;
  causa: Causa | null;
  /** Lo que duraba: la recuperativa dura lo mismo. `null` si la clase no tenía fin. */
  duracionMin: number | null;
  afectadas: number;
  conCreditoVencido: number;
};

export type RecuperativaProgramada = {
  id: string;
  inicio: string;
  curso: string;
  profesora: string;
  sede: string;
  cupoMaximo: number;
  originalInicio: string | null;
};

export type DatosRecuperativas = {
  porRecuperar: ClasePorRecuperar[];
  programadas: RecuperativaProgramada[];
};

type FilaCaida = {
  id: string;
  inicio: string;
  fin: string | null;
  sede_id: string;
  profesora_id: string;
  cursos: { nombre: string } | null;
  profesoras: { nombre: string } | null;
  sedes: { nombre: string } | null;
  causas_de_clase: { causa: Causa; deleted_at: string | null } | null;
};

type FilaViva = {
  id: string;
  inicio: string;
  recupera_clase_id: string;
  cupo_maximo: number;
  cursos: { nombre: string } | null;
  profesoras: { nombre: string } | null;
  sedes: { nombre: string } | null;
  original: { inicio: string } | null;
};

export async function getRecuperativas(): Promise<Lectura<DatosRecuperativas>> {
  const supabase = await clienteServidor();
  const ahora = new Date();
  const desde = new Date(ahora.getTime() - DIAS_HACIA_ATRAS * 24 * 60 * 60 * 1000);

  const [caidas, vivas] = await Promise.all([
    supabase
      .from("clases")
      .select(
        "id, inicio, fin, sede_id, profesora_id, cursos ( nombre ), profesoras ( nombre ), sedes ( nombre ), causas_de_clase ( causa, deleted_at )",
      )
      .eq("tipo", "parrilla")
      .in("estado", ["cancelada", "no_dictada"])
      // Una recuperativa caída se vuelve a recuperar desde su original.
      .is("recupera_clase_id", null)
      .gte("inicio", desde.toISOString())
      .order("inicio", { ascending: false }),
    supabase
      .from("clases")
      .select(
        "id, inicio, recupera_clase_id, cupo_maximo, cursos ( nombre ), profesoras ( nombre ), sedes ( nombre ), original:recupera_clase_id ( inicio )",
      )
      .not("recupera_clase_id", "is", null)
      .eq("estado", "programada")
      .gte("inicio", desde.toISOString())
      .order("inicio"),
  ]);

  const fallo = comoTexto(caidas.error) ?? comoTexto(vivas.error);
  const vacio = { porRecuperar: [], programadas: [] };
  if (fallo) return { datos: vacio, error: fallo };

  const filasVivas = (vivas.data ?? []) as unknown as FilaViva[];
  const pendientes = porRecuperar(
    ((caidas.data ?? []) as unknown as FilaCaida[]).map((c) => ({
      ...c,
      causa: c.causas_de_clase && !c.causas_de_clase.deleted_at ? c.causas_de_clase.causa : null,
    })),
    filasVivas.map((v) => ({ recuperaClaseId: v.recupera_clase_id })),
  );

  const { data: filasAfectadas, error: errorAfectadas } = pendientes.length
    ? await clienteAdmin().rpc("afectadas_de_clases", { p_originales: pendientes.map((c) => c.id) })
    : { data: [], error: null };
  const falloAfectadas = comoTexto(errorAfectadas);
  if (falloAfectadas) return { datos: vacio, error: falloAfectadas };

  const porClase = new Map<string, { vence: string }[]>();
  for (const a of (filasAfectadas ?? []) as { original_id: string; vence: string }[]) {
    porClase.set(a.original_id, [...(porClase.get(a.original_id) ?? []), a]);
  }

  return {
    datos: {
      porRecuperar: pendientes.map((c) => ({
        id: c.id,
        inicio: c.inicio,
        curso: c.cursos?.nombre ?? "",
        profesora: c.profesoras?.nombre ?? "",
        profesoraId: c.profesora_id,
        sede: c.sedes?.nombre ?? "",
        sedeId: c.sede_id,
        causa: c.causa,
        duracionMin: c.fin ? Math.round((new Date(c.fin).getTime() - new Date(c.inicio).getTime()) / 60000) : null,
        afectadas: porClase.get(c.id)?.length ?? 0,
        conCreditoVencido: conCreditoVencido(porClase.get(c.id) ?? [], ahora),
      })),
      programadas: filasVivas.map((v) => ({
        id: v.id,
        inicio: v.inicio,
        curso: v.cursos?.nombre ?? "",
        profesora: v.profesoras?.nombre ?? "",
        sede: v.sedes?.nombre ?? "",
        cupoMaximo: v.cupo_maximo,
        originalInicio: v.original?.inicio ?? null,
      })),
    },
    error: null,
  };
}
