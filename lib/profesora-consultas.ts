import { clienteServidor } from "./supabase/servidor";
import type { Lectura } from "./compras-consultas";

/**
 * Consultas del portal de la profesora. **Solo servidor.**
 *
 * Todo va con **su** sesión, nunca con la service role key. No es solo higiene:
 * es lo que hace que las restricciones del PRD-0008 sean verificables. Si una
 * política estuviera mal, acá se ve vacío en vez de filtrarse la clase de otra.
 *
 * **Los nombres de las inscritas no salen de una consulta**, salen de
 * `inscritas_de_clase`, que devuelve tres columnas y ninguna sensible. RLS
 * filtra filas, no columnas: leer `perfiles` le entregaría el correo y el
 * teléfono de cada alumna junto con el nombre.
 *
 * Todas devuelven `Lectura<T>` — un fallo de lectura no puede verse como
 * "no tienes clases". Ver PRD-0017 §17.
 */

export type ClaseDeProfesora = {
  id: string;
  inicio: string;
  cursoNombre: string;
  sedeNombre: string;
  sedeComuna: string;
  cupoMaximo: number;
  inscritas: number;
  cancelada: boolean;
  motivoCancelacion: string | null;
  /**
   * Cuando la dicta alguien distinto de quien tiene el horario recurrente.
   * Se deriva comparando la clase con su horario: no hay columna para esto.
   */
  reemplazo: { cubro: string | null; meCubre: string | null } | null;
};

export type Inscrita = {
  reservaId: string;
  nombre: string;
  estado: string;
};

export type Solicitud = {
  id: string;
  diaSemana: number;
  hora: string;
  cursoNombre: string | null;
  cursoPropuesto: string | null;
  sedeNombre: string | null;
  mensaje: string | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  respuesta: string | null;
  createdAt: string;
  resueltaAt: string | null;
  /** Solo en la bandeja de admin. */
  profesoraNombre?: string;
};

function comoTexto(error: { message: string; code?: string } | null): string | null {
  if (!error) return null;
  console.error("Error en el portal de profesora:", error);
  return error.code ? `${error.message} (${error.code})` : error.message;
}

type FilaClase = {
  id: string;
  inicio: string;
  cupo_maximo: number;
  estado: string;
  motivo_cancelacion: string | null;
  profesora_id: string;
  cursos: { nombre: string } | null;
  sedes: { nombre: string; comuna: string } | null;
  horarios: { profesora_id: string; profesoras: { nombre: string } | null } | null;
  profesoras: { nombre: string } | null;
};

/**
 * Sus clases de la ventana pedida.
 *
 * `dias` negativo mira hacia atrás. Las clases pasadas se muestran igual —saber
 * quién vino la semana pasada es legítimo— pero **con las mismas columnas**:
 * nombre y nada más, tampoco ahí.
 */
export async function getMisClases(
  desdeDias: number,
  hastaDias: number,
): Promise<Lectura<ClaseDeProfesora[]>> {
  const supabase = await clienteServidor();
  const ahora = Date.now();
  const desde = new Date(ahora + desdeDias * 86_400_000).toISOString();
  const hasta = new Date(ahora + hastaDias * 86_400_000).toISOString();

  // **Acá se filtra, y tiene que ser acá.** La primera versión no filtraba,
  // confiando en una política de RLS que no restringía nada: `clases` es
  // pública a propósito —las alumnas necesitan la parrilla completa para
  // reservar— y las políticas permisivas se suman con OR, así que agregar una
  // "de la profesora" no quitaba nada. Resultado: veía las 73 clases en vez de
  // sus 10.
  //
  // `mi_profesora_id()` resuelve el salto de slug a uuid en la base, con la
  // sesión de quien pregunta: no se puede falsear pasando otro id.
  const { data: miId, error: errorId } = await supabase.rpc("mi_profesora_id");
  if (errorId) return { datos: [], error: comoTexto(errorId) };
  if (!miId) {
    return {
      datos: [],
      error: "Tu cuenta no está enlazada a una profesora del catálogo.",
    };
  }

  const { data, error } = await supabase
    .from("clases")
    .select(
      "id, inicio, cupo_maximo, estado, motivo_cancelacion, profesora_id, cursos ( nombre ), sedes ( nombre, comuna ), profesoras ( nombre ), horarios ( profesora_id, profesoras ( nombre ) )",
    )
    .eq("profesora_id", miId as string)
    .gte("inicio", desde)
    .lte("inicio", hasta)
    .order("inicio");

  if (error) return { datos: [], error: comoTexto(error) };

  const clases = ((data ?? []) as unknown as FilaClase[]).filter(
    (c) => c.cursos && c.sedes,
  );
  if (clases.length === 0) return { datos: [], error: null };

  // El conteo va con su sesión: `reservas_de_mis_clases` le deja ver las de sus
  // clases y ninguna otra. Estas filas no traen nombres.
  const { data: reservas, error: errorReservas } = await supabase
    .from("reservas")
    .select("clase_id")
    .in("clase_id", clases.map((c) => c.id))
    .in("estado", ["confirmada", "asistio"]);

  if (errorReservas) return { datos: [], error: comoTexto(errorReservas) };

  const inscritas = new Map<string, number>();
  for (const fila of (reservas ?? []) as { clase_id: string }[]) {
    inscritas.set(fila.clase_id, (inscritas.get(fila.clase_id) ?? 0) + 1);
  }

  return {
    datos: clases.map((c) => {
      // Si la clase la dicta alguien distinto de quien tiene el horario, es un
      // reemplazo. La clase manda —`clases.profesora_id` se copia al generar y
      // se puede cambiar puntualmente— y esto solo lo hace legible.
      const titular = c.horarios?.profesora_id ?? null;
      const distinta = titular !== null && titular !== c.profesora_id;

      return {
        id: c.id,
        inicio: c.inicio,
        cursoNombre: c.cursos!.nombre,
        sedeNombre: c.sedes!.nombre,
        sedeComuna: c.sedes!.comuna,
        cupoMaximo: c.cupo_maximo,
        inscritas: inscritas.get(c.id) ?? 0,
        cancelada: c.estado === "cancelada",
        motivoCancelacion: c.motivo_cancelacion,
        reemplazo: distinta
          ? {
              // Sale en la lista de quien la dicta, así que siempre es "cubro".
              cubro: c.horarios?.profesoras?.nombre ?? null,
              meCubre: null,
            }
          : null,
      };
    }),
    error: null,
  };
}

/** Una clase suya, para el detalle. */
export async function getClase(
  claseId: string,
): Promise<Lectura<ClaseDeProfesora | null>> {
  const { datos, error } = await getMisClases(-365, 365);
  if (error) return { datos: null, error };
  return { datos: datos.find((c) => c.id === claseId) ?? null, error: null };
}

/**
 * Las inscritas de una clase. **Nombre y estado, nada más.**
 *
 * La función de la base verifica que la clase sea suya y levanta `42501` si no.
 * No es una consulta con un `where`: es un contrato de columnas.
 */
export async function getInscritas(
  claseId: string,
): Promise<Lectura<Inscrita[]>> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("inscritas_de_clase", {
    p_clase_id: claseId,
  });

  return {
    datos: ((data ?? []) as { reserva_id: string; nombre: string; estado: string }[]).map(
      (f) => ({ reservaId: f.reserva_id, nombre: f.nombre, estado: f.estado }),
    ),
    error: comoTexto(error),
  };
}

type FilaSolicitud = {
  id: string;
  dia_semana: number;
  hora: string;
  curso_propuesto: string | null;
  mensaje: string | null;
  estado: string;
  respuesta: string | null;
  created_at: string;
  resuelta_at: string | null;
  cursos: { nombre: string } | null;
  sedes: { nombre: string } | null;
  profesoras: { nombre: string } | null;
};

const CAMPOS_SOLICITUD =
  "id, dia_semana, hora, curso_propuesto, mensaje, estado, respuesta, created_at, resuelta_at, cursos ( nombre ), sedes ( nombre ), profesoras ( nombre )";

function aSolicitud(fila: FilaSolicitud): Solicitud {
  return {
    id: fila.id,
    diaSemana: fila.dia_semana,
    hora: fila.hora.slice(0, 5),
    cursoNombre: fila.cursos?.nombre ?? null,
    cursoPropuesto: fila.curso_propuesto,
    sedeNombre: fila.sedes?.nombre ?? null,
    mensaje: fila.mensaje,
    estado: fila.estado as Solicitud["estado"],
    respuesta: fila.respuesta,
    createdAt: fila.created_at,
    resueltaAt: fila.resuelta_at,
    profesoraNombre: fila.profesoras?.nombre,
  };
}

export async function getMisSolicitudes(): Promise<Lectura<Solicitud[]>> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("solicitudes_horario")
    .select(CAMPOS_SOLICITUD)
    .order("created_at", { ascending: false });

  return {
    datos: ((data ?? []) as unknown as FilaSolicitud[]).map(aSolicitud),
    error: comoTexto(error),
  };
}

/** La bandeja de admin. Con la sesión: si no es admin, sale vacía. */
export async function getSolicitudesPendientes(): Promise<Lectura<Solicitud[]>> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("solicitudes_horario")
    .select(CAMPOS_SOLICITUD)
    .eq("estado", "pendiente")
    .order("created_at");

  return {
    datos: ((data ?? []) as unknown as FilaSolicitud[]).map(aSolicitud),
    error: comoTexto(error),
  };
}

export async function getSolicitudesResueltas(
  limite = 20,
): Promise<Lectura<Solicitud[]>> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("solicitudes_horario")
    .select(CAMPOS_SOLICITUD)
    .neq("estado", "pendiente")
    .order("resuelta_at", { ascending: false })
    .limit(limite);

  return {
    datos: ((data ?? []) as unknown as FilaSolicitud[]).map(aSolicitud),
    error: comoTexto(error),
  };
}

export type Conflicto = { motivo: string; detalle: string };

/** Qué choca con una solicitud. Contexto para admin, no un bloqueo. */
export async function getConflictos(
  solicitudId: string,
): Promise<Conflicto[]> {
  const supabase = await clienteServidor();
  const { data } = await supabase.rpc("conflictos_de_solicitud", {
    p_solicitud_id: solicitudId,
  });
  return ((data ?? []) as Conflicto[]) ?? [];
}
