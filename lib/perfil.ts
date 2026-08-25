/**
 * Validación de los datos que la persona completa después del primer ingreso.
 *
 * Función pura, igual que `lib/lead.ts`: se puede probar sin levantar nada y la
 * usa el servidor, que es el que manda.
 *
 * Solo nombre y teléfono. Lo de menores de edad —fecha de nacimiento, datos del
 * apoderado y su autorización— está fuera de alcance a propósito: XO Mini entra
 * con rango etario sin definir. Ver PRD-0004 §9.
 */

export type PerfilBruto = { nombre: unknown; telefono: unknown };

export type DatosPerfil = { nombre: string; telefono: string };

export type ErroresPerfil = Partial<Record<keyof DatosPerfil, string>>;

export function validarPerfil(
  bruto: PerfilBruto,
): { ok: true; datos: DatosPerfil } | { ok: false; errores: ErroresPerfil } {
  const errores: ErroresPerfil = {};

  const nombre = typeof bruto.nombre === "string" ? bruto.nombre.trim() : "";
  if (nombre.length < 2) {
    errores.nombre = "Escribe tu nombre para saber cómo llamarte.";
  } else if (nombre.length > 80) {
    errores.nombre = "Con el nombre y el apellido basta.";
  }

  // Ocho dígitos, sin el +56 9. Mismo formato que el WhatsApp de los leads.
  const telefono =
    typeof bruto.telefono === "string" ? bruto.telefono.replace(/\D/g, "") : "";
  if (!/^\d{8}$/.test(telefono)) {
    errores.telefono = "El número va sin el +56 9 y tiene 8 dígitos.";
  }

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, datos: { nombre, telefono } };
}
