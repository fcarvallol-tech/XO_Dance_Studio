/**
 * Los slugs del catálogo.
 *
 * Hasta PRD-0015 eran uniones cerradas —`"kids" | "teens" | …`— y el
 * compilador verificaba cada slug del sitio. Con el catálogo en base de datos
 * ese conjunto deja de conocerse en tiempo de compilación, así que pasan a ser
 * `string`. **Es una pérdida consciente**: a cambio la integridad la garantizan
 * llaves foráneas contra `cursos(slug)` y `profesoras(slug)`, que además cubren
 * lo que el compilador nunca cubrió — los datos que ya están en la base.
 * Anotado en `ARCHITECTURE.md` §10.
 */
export type CursoId = string;

export type ProfesoraId = string;

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
