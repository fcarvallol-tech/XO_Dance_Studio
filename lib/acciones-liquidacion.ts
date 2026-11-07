"use server";

import { revalidatePath } from "next/cache";
import { clienteAdmin } from "./supabase/admin";
import { perfilActual } from "./sesion";
import { tieneNivel } from "./roles";
import { calcularParaCerrar } from "./liquidacion-consultas";
import { CAUSAS, type Causa } from "./dominio/liquidacion";

/**
 * Las escrituras de la liquidación (PRD-0010 parte 3, paso E). El monto no viaja
 * desde el navegador: se recalcula acá, y la base rechaza si la huella que se
 * miró ya no es la de hoy. El comprobante va por su Route Handler.
 */

export type ResultadoLiquidacion = { ok: true } | { ok: false; mensaje: string };

function comoMensaje(error: { message: string; code?: string }): string {
  if (["23514", "42501", "22023", "P0002"].includes(error.code ?? "")) return error.message;
  console.error("Error inesperado en la liquidación:", error);
  return "Algo falló de nuestro lado. Intenta de nuevo en un momento.";
}

function refrescar() {
  revalidatePath("/owner/liquidaciones");
  revalidatePath("/owner/finanzas");
  revalidatePath("/profesora/liquidacion");
}

export async function cerrarLiquidacion(datos: {
  profesoraId: string;
  mes: string;
  huella: string;
}): Promise<ResultadoLiquidacion> {
  const actor = await perfilActual();
  if (!actor || !tieneNivel(actor.rol, "owner")) return { ok: false, mensaje: "No tienes permiso." };

  const calculo = await calcularParaCerrar(datos.profesoraId, datos.mes);
  if ("error" in calculo) return { ok: false, mensaje: calculo.error };

  const { error } = await clienteAdmin().rpc("cerrar_liquidacion", {
    p_actor_user_id: actor.userId,
    p_profesora_id: datos.profesoraId,
    p_mes: `${datos.mes}-01`,
    p_monto_clp: calculo.foto.totalClp,
    p_detalle: calculo.foto,
    p_huella: datos.huella,
  });
  if (error) return { ok: false, mensaje: comoMensaje(error) };

  refrescar();
  return { ok: true };
}

export async function anularLiquidacion(id: string, motivo: string): Promise<ResultadoLiquidacion> {
  const actor = await perfilActual();
  if (!actor || !tieneNivel(actor.rol, "owner")) return { ok: false, mensaje: "No tienes permiso." };

  const { error } = await clienteAdmin().rpc("anular_liquidacion", {
    p_actor_user_id: actor.userId,
    p_liquidacion_id: id,
    p_motivo: motivo,
  });
  if (error) return { ok: false, mensaje: comoMensaje(error) };

  refrescar();
  return { ok: true };
}

/** Decir por qué una clase no se dictó. Sin esto, una clase sin causa traba el mes. */
export async function clasificarClase(datos: {
  claseId: string;
  causa: string;
  detalle: string;
  seHabiaPresentado: boolean;
}): Promise<ResultadoLiquidacion> {
  const actor = await perfilActual();
  if (!actor || !tieneNivel(actor.rol, "admin")) return { ok: false, mensaje: "No tienes permiso." };
  if (!CAUSAS.includes(datos.causa as Causa)) return { ok: false, mensaje: "Elige una causa." };

  const { error } = await clienteAdmin().rpc("registrar_no_dictada", {
    p_actor_user_id: actor.userId,
    p_clase_id: datos.claseId,
    p_causa: datos.causa,
    p_detalle: datos.detalle,
    p_profesora_se_presento: datos.seHabiaPresentado,
  });
  if (error) return { ok: false, mensaje: comoMensaje(error) };

  refrescar();
  return { ok: true };
}
