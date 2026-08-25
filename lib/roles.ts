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

/** Cómo se le dice a cada rol en pantalla. */
export const NOMBRE_ROL: Record<Rol, string> = {
  alumna: "Alumna",
  profesora: "Profesora",
  admin: "Administración",
  owner: "Dueña",
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
      return "/mi-perfil";
  }
}
