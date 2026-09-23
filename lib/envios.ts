/**
 * Tipos y rótulos de los envíos de correo.
 *
 * **Sin nada de servidor: lo usan componentes cliente.** Misma separación que
 * `compras.ts` y `compras-consultas.ts`, y por la misma razón: importar desde
 * un componente cliente un módulo que toca `next/headers` arrastra el servidor
 * al bundle y rompe la compilación.
 *
 * Las consultas están en `envios-consultas.ts`, las reglas en
 * `dominio/envios.ts` y las escrituras en las acciones.
 */

export type EnvioFallido = {
  id: string;
  plantilla: string;
  destinatario: string | null;
  estado: string;
  intentos: number;
  ultimoError: string | null;
  motivoDescarte: string | null;
  creadoAt: string;
  proximoIntentoAt: string | null;
  caducaAt: string | null;
};

/** Cómo se llama cada plantilla en pantalla. */
export const NOMBRE_PLANTILLA: Record<string, string> = {
  transferenciaDeclarada: "Aviso a la academia",
  compraAprobada: "Compra aprobada",
  compraRechazada: "Compra rechazada",
  reserva: "Comprobante de reserva",
  especialPendiente: "Cupo tomado de una especial",
  especialConfirmada: "Especial confirmada",
};
