export type CursoId =
  | "kids"
  | "teens"
  | "girly-basico"
  | "girly-intermedio"
  | "kpop";

export type ProfesoraId = "carli" | "pau" | "drimy" | "lina" | "maida";

/** Lo que se muestra cuando un dato todavía no está definido. */
export const POR_CONFIRMAR = "Por confirmar";

/** De dónde salió el click que abrió el formulario. Se guarda en el lead. */
export type Origen =
  | "barra"
  | "hero"
  | "tarjeta-curso"
  | "planes"
  | "ficha-profesora"
  | "perfil-profesora"
  | "clase-de-prueba"
  | "formulario";
