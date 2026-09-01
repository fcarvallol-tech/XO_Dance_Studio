/**
 * Los cuatro roles y su jerarquía.
 *
 * Espejo exacto de `public.nivel_rol` en la migración de PRD-0004. Acá sirve
 * para decidir qué se dibuja; la base es la que manda y vuelve a validar.
 *
 * `owner` es superconjunto de `admin` por aritmética, no por listas paralelas:
 * pedir nivel `admin` incluye a `owner` sin nombrarlo.
 */

export const ROLES = ["alumna", "profesora", "admin", "owner"] as const;

export type Rol = (typeof ROLES)[number];

const NIVEL: Record<Rol, number> = {
  alumna: 10,
  profesora: 20,
  admin: 30,
  owner: 40,
};

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && ROLES.includes(valor as Rol);
}

export function nivelRol(rol: Rol): number {
  return NIVEL[rol];
}

/** ¿`rol` alcanza para lo que exige `minimo`? */
export function tieneNivel(rol: Rol, minimo: Rol): boolean {
  return NIVEL[rol] >= NIVEL[minimo];
}

/**
 * Cómo se le dice a cada rol en pantalla.
 *
 * `alumna` y `profesora` van en femenino porque son los términos del dominio,
 * y el dominio es explícitamente femenino: son los nombres que usan CLAUDE.md,
 * el esquema y toda la comunicación de la academia.
 *
 * `admin` y `owner` **no**: sus identificadores son neutros y quien los ocupa
 * puede ser cualquiera. "Dueña" le inventaba un género que el esquema no tiene
 * — el owner hoy son Felipe y Carla— así que se dice "Owner", igual que la
 * columna.
 */
export const NOMBRE_ROL: Record<Rol, string> = {
  alumna: "Alumna",
  profesora: "Profesora",
  admin: "Administración",
  owner: "Owner",
};

/** A dónde mandar a alguien según su rol, después de entrar. */
export function inicioSegunRol(rol: Rol): string {
  switch (rol) {
    case "owner":
      return "/owner/metricas";
    case "admin":
      return "/admin";
    case "profesora":
      return "/profesora/mis-clases";
    default:
      // La alumna entra a lo que vino a hacer: ver sus clases y reservar.
      return "/mis-clases";
  }
}
