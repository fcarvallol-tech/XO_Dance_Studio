import { esCursoValido } from "./cursos";
import { esProfesoraValida } from "./profesoras";
import type { CursoId, ProfesoraId } from "./tipos";

export type ParaQuien = "propio" | "hija";

export type LeadBruto = {
  nombre: unknown;
  whatsapp: unknown;
  paraQuien: unknown;
  edadAlumna: unknown;
  cursoId: unknown;
  profesoraId: unknown;
  origen: unknown;
};

export type Lead = {
  nombre: string;
  /** Ocho dígitos, sin el prefijo +56 9. */
  whatsapp: string;
  paraQuien: ParaQuien;
  edadAlumna: number | null;
  cursoId: CursoId;
  profesoraId: ProfesoraId | null;
  origen: string;
};

export type ErroresLead = Partial<Record<keyof Lead, string>>;

export const EDAD_MINIMA = 4;
export const EDAD_MAXIMA = 17;

/**
 * Misma validación en el cliente y en la Route Handler. El cliente la usa para
 * avisar antes de enviar; el servidor es el que manda.
 */
export function validarLead(
  bruto: LeadBruto,
): { ok: true; lead: Lead } | { ok: false; errores: ErroresLead } {
  const errores: ErroresLead = {};

  const nombre = typeof bruto.nombre === "string" ? bruto.nombre.trim() : "";
  if (nombre.length < 2) {
    errores.nombre = "Escribe tu nombre para saber cómo llamarte.";
  } else if (nombre.length > 80) {
    errores.nombre = "Con el nombre y el apellido basta.";
  }

  const whatsapp =
    typeof bruto.whatsapp === "string" ? bruto.whatsapp.replace(/\D/g, "") : "";
  if (!/^\d{8}$/.test(whatsapp)) {
    errores.whatsapp = "El número va sin el +56 9 y tiene 8 dígitos.";
  }

  const paraQuien =
    bruto.paraQuien === "propio" || bruto.paraQuien === "hija"
      ? bruto.paraQuien
      : null;
  if (!paraQuien) {
    errores.paraQuien = "Dinos para quién es la clase.";
  }

  let edadAlumna: number | null = null;
  if (paraQuien === "hija") {
    const edad = Number(bruto.edadAlumna);
    if (!Number.isInteger(edad) || edad < EDAD_MINIMA || edad > EDAD_MAXIMA) {
      errores.edadAlumna = `Pon la edad de tu hija, entre ${EDAD_MINIMA} y ${EDAD_MAXIMA}.`;
    } else {
      edadAlumna = edad;
    }
  }

  const cursoId =
    typeof bruto.cursoId === "string" && esCursoValido(bruto.cursoId)
      ? bruto.cursoId
      : null;
  if (!cursoId) {
    errores.cursoId = "Elige el curso que te interesa.";
  }

  const profesoraId =
    typeof bruto.profesoraId === "string" && esProfesoraValida(bruto.profesoraId)
      ? bruto.profesoraId
      : null;

  const origen =
    typeof bruto.origen === "string" ? bruto.origen.slice(0, 40) : "formulario";

  if (Object.keys(errores).length > 0 || !paraQuien || !cursoId) {
    return { ok: false, errores };
  }

  return {
    ok: true,
    lead: { nombre, whatsapp, paraQuien, edadAlumna, cursoId, profesoraId, origen },
  };
}

/** Número completo en el formato que espera wa.me. */
export function whatsappCompleto(ochoDigitos: string): string {
  return `569${ochoDigitos}`;
}
