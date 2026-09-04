import { cache } from "react";
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
 * Su id de profesora, **memoizado por petición**.
 *
 * `mi_profesora_id()` resuelve el salto de slug a uuid en la base, con la sesión
 * de quien pregunta: no se puede falsear pasando otro id. Lo que cambia acá es
 * cuántas veces se pregunta. `/profesora/mis-clases` hace dos lecturas
 * independientes —la grilla y la próxima clase— y cada una lo pedía por su
 * cuenta: dos viajes para una respuesta que no puede cambiar dentro de la misma
 * petición.
 *
 * `cache()` vive lo que vive la petición. No es un caché entre visitantes ni
 * entre navegaciones, así que no puede devolver el id de otra profesora.
 */
const miProfesoraId = cache(async function miProfesoraId(): Promise<{
  id: string | null;
  error: string | null;
}> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("mi_profesora_id");
  if (error) return { id: null, error: comoTexto(error) };
  return { id: (data as string | null) ?? null, error: null };
});

const CAMPOS_CLASE =
  "id, inicio, cupo_maximo, estado, motivo_cancelacion, profesora_id, cursos ( nombre ), sedes ( nombre, comuna ), profesoras ( nombre ), horarios ( profesora_id, profesoras ( nombre ) )";

/** Qué recorte de sus clases se quiere. Todo opcional; se combinan. */
type Recorte = {
  /** ISO. Desde cuándo, inclusive. */
  desde?: string;
  /** ISO. Hasta cuándo, inclusive. */
  hasta?: string;
  /** Una clase puntual. Sigue acotado a las suyas. */
  id?: string;
  /** Deja fuera las canceladas. */
  soloActivas?: boolean;
  limite?: number;
};

/**
 * Sus clases, recortadas por quien pregunta.
 *
 * **El recorte se hace en la consulta, no en memoria.** Antes esto traía una
 * ventana fija y cada uso filtraba después: el detalle de una clase pedía un año
 * entero de clases con todas sus reservas para mostrar una, y la tira de "tu
 * próxima clase" pedía treinta días para mostrar la primera. Traer de más no es
 * solo lento: es una consulta de reservas proporcional a lo que se descartó.
 *
 * El `eq("profesora_id")` es lo que la acota a las suyas, y tiene que estar acá.
 * `clases` es pública a propósito —las alumnas necesitan la parrilla para
 * reservar— y las políticas permisivas se suman con OR, así que agregar una
 * política "de la profesora" no quitaría nada.
 */
async function traerMisClases(
  recorte: Recorte,
): Promise<Lectura<ClaseDeProfesora[]>> {
  const supabase = await clienteServidor();
  const { id: miId, error: errorId } = await miProfesoraId();
  if (errorId) return { datos: [], error: errorId };
  if (!miId) {
    return {
      datos: [],
      error: "Tu cuenta no está enlazada a una profesora del catálogo.",
    };
  }

  let filtro = supabase
    .from("clases")
    .select(CAMPOS_CLASE)
    .eq("profesora_id", miId);

  if (recorte.id) filtro = filtro.eq("id", recorte.id);
  if (recorte.desde) filtro = filtro.gte("inicio", recorte.desde);
  if (recorte.hasta) filtro = filtro.lte("inicio", recorte.hasta);
  if (recorte.soloActivas) filtro = filtro.neq("estado", "cancelada");

  const ordenada = filtro.order("inicio");
  const { data, error } = await (recorte.limite
    ? ordenada.limit(recorte.limite)
    : ordenada);

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

/**
 * Una clase suya, para el detalle.
 *
 * El `id` va en la consulta junto al `profesora_id`: una clase ajena sale vacía,
 * igual que antes, pero sin traer el año completo para descartarlo.
 */
export async function getClase(
  claseId: string,
): Promise<Lectura<ClaseDeProfesora | null>> {
  const { datos, error } = await traerMisClases({ id: claseId, limite: 1 });
  if (error) return { datos: null, error };
  return { datos: datos[0] ?? null, error: null };
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

/** Una clase en la grilla semanal. `inscritas` es null si no es suya. */
export type ClaseDeGrilla = {
  id: string;
  inicio: string;
  hora: string;
  cursoNombre: string;
  profesoraNombre: string;
  sedeNombre: string;
  sedeComuna: string;
  cupoMaximo: number;
  cancelada: boolean;
  mia: boolean;
  /** Solo para las suyas. RLS no devuelve reservas de clases ajenas. */
  inscritas: number | null;
};

export type DiaDeGrilla = { dia: string; clases: ClaseDeGrilla[] };

/**
 * La parrilla completa de una semana: **todas** las clases, no solo las suyas.
 *
 * No reabre el bug de septiembre. `clases` y `horarios` ya eran públicos —la
 * landing los muestra sin cuenta— y lo que estaba mal era que su lista personal
 * mezclara clases ajenas sin distinguirlas. Acá se distinguen: `mia` marca
 * cuáles son suyas y la grilla las pinta distinto.
 *
 * Lo que sigue protegido son **las inscritas**, y no se toca:
 *
 *   · el conteo sale de `reservas`, que `reservas_de_mis_clases` limita a sus
 *     clases — por eso `inscritas` viene `null` en las ajenas sin que la
 *     interfaz tenga que acordarse de ocultarlo;
 *   · los nombres siguen saliendo solo de `inscritas_de_clase`, que rechaza una
 *     clase ajena con 42501.
 */
export async function getSemana(
  lunes: string,
): Promise<Lectura<{ dias: DiaDeGrilla[]; hayClases: boolean }>> {
  const { diasDeLaSemana, inicioDelDia, sumarDias, diaEnSantiago } = await import("./semana");
  const supabase = await clienteServidor();

  const desde = inicioDelDia(lunes);
  const hasta = inicioDelDia(sumarDias(lunes, 7));

  const [{ id: miId }, clases] = await Promise.all([
    miProfesoraId(),
    supabase
      .from("clases")
      .select(
        "id, inicio, cupo_maximo, estado, profesora_id, cursos ( nombre ), profesoras ( nombre ), sedes ( nombre, comuna )",
      )
      .gte("inicio", desde.toISOString())
      .lt("inicio", hasta.toISOString())
      .order("inicio"),
  ]);

  if (clases.error) {
    return { datos: { dias: [], hayClases: false }, error: comoTexto(clases.error) };
  }

  type Fila = {
    id: string;
    inicio: string;
    cupo_maximo: number;
    estado: string;
    profesora_id: string;
    cursos: { nombre: string } | null;
    profesoras: { nombre: string } | null;
    sedes: { nombre: string; comuna: string } | null;
  };

  const filas = ((clases.data ?? []) as unknown as Fila[]).filter(
    (c) => c.cursos && c.profesoras && c.sedes,
  );

  const mias = filas.filter((c) => c.profesora_id === miId).map((c) => c.id);
  const inscritas = new Map<string, number>();

  if (mias.length > 0) {
    const { data: reservas } = await supabase
      .from("reservas")
      .select("clase_id")
      .in("clase_id", mias)
      .in("estado", ["confirmada", "asistio"]);

    for (const r of (reservas ?? []) as { clase_id: string }[]) {
      inscritas.set(r.clase_id, (inscritas.get(r.clase_id) ?? 0) + 1);
    }
  }

  const hora = (iso: string) =>
    new Intl.DateTimeFormat("es-CL", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));

  const porDia = new Map<string, ClaseDeGrilla[]>();
  for (const c of filas) {
    const mia = c.profesora_id === miId;
    const dia = diaEnSantiago(new Date(c.inicio));
    porDia.set(dia, [
      ...(porDia.get(dia) ?? []),
      {
        id: c.id,
        inicio: c.inicio,
        hora: hora(c.inicio),
        cursoNombre: c.cursos!.nombre,
        profesoraNombre: c.profesoras!.nombre,
        sedeNombre: c.sedes!.nombre,
        sedeComuna: c.sedes!.comuna,
        cupoMaximo: c.cupo_maximo,
        cancelada: c.estado === "cancelada",
        mia,
        inscritas: mia ? (inscritas.get(c.id) ?? 0) : null,
      },
    ]);
  }

  return {
    datos: {
      dias: diasDeLaSemana(lunes).map((dia) => ({ dia, clases: porDia.get(dia) ?? [] })),
      hayClases: filas.length > 0,
    },
    error: null,
  };
}

/**
 * Su próxima clase. Es lo que mira en el teléfono minutos antes de entrar a la
 * sala, que es el caso de uso con el que se escribió PRD-0008 §2 — y para eso
 * una línea sirve más que una grilla.
 *
 * Pide **una** fila. Antes pedía treinta días de clases con sus reservas para
 * mostrar la primera que no estuviera cancelada.
 */
export async function getProximaClase(): Promise<Lectura<ClaseDeProfesora | null>> {
  const { datos, error } = await traerMisClases({
    desde: new Date().toISOString(),
    soloActivas: true,
    limite: 1,
  });
  if (error) return { datos: null, error };
  return { datos: datos[0] ?? null, error: null };
}
