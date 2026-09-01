/**
 * Tipos y helpers de compras, créditos y reservas.
 *
 * Sin nada de servidor: lo usan componentes cliente. Las consultas están en
 * `compras-consultas.ts` y las escrituras en las acciones de servidor.
 */

export type EstadoCompra = "pendiente" | "pagada" | "rechazada" | "reembolsada";

export type Compra = {
  id: string;
  planNombre: string;
  clases: number;
  monto: number;
  estado: EstadoCompra;
  medioPago: string;
  declaradaAt: string;
  motivoRechazo: string | null;
  /** Solo en la bandeja de admin. */
  alumna?: string | null;
  correoAlumna?: string | null;
  perfilId?: string;
};

export type ClaseDelCalendario = {
  id: string;
  inicio: string;
  cursoSlug: string;
  cursoNombre: string;
  profesoraSlug: string;
  profesoraNombre: string;
  sedeNombre: string;
  sedeComuna: string;
  cupoMaximo: number;
  tomados: number;
  /** La reserva de quien mira, si ya reservó esta clase. */
  reservaId: string | null;
};

export type ReservaPropia = {
  id: string;
  claseId: string;
  inicio: string;
  cursoNombre: string;
  profesoraNombre: string;
  sedeNombre: string;
  sedeDireccion: string;
  estado: string;
  creditoDevuelto: boolean;
};

export const NOMBRE_ESTADO: Record<EstadoCompra, string> = {
  pendiente: "Esperando confirmación",
  pagada: "Confirmada",
  rechazada: "Rechazada",
  reembolsada: "Reembolsada",
};

export function lugaresLibres(clase: ClaseDelCalendario): number {
  return Math.max(0, clase.cupoMaximo - clase.tomados);
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * "lunes 8 de septiembre, 20:00", en hora de Santiago.
 *
 * Se formatea a mano y no con Intl para que servidor y navegador escriban
 * exactamente lo mismo: una diferencia acá es un error de hidratación.
 */
export function cuandoLegible(iso: string): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(new Date(iso));

  const dato = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  const fecha = new Date(
    `${dato("year")}-${dato("month")}-${dato("day")}T12:00:00Z`,
  );

  return `${DIAS[fecha.getUTCDay()]} ${Number(dato("day"))} de ${
    MESES[Number(dato("month")) - 1]
  }, ${dato("hour")}:${dato("minute")}`;
}

/** Solo el día, para agrupar el calendario: "lunes 8 de septiembre". */
export function diaLegible(iso: string): string {
  return cuandoLegible(iso).split(",")[0];
}

/** "20:00" en hora de Santiago. */
export function horaLegible(iso: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

/** La clave de agrupación por día, estable entre servidor y navegador. */
export function claveDia(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(iso));
}
