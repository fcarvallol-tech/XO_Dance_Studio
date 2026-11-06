/**
 * Las categorías de clase que se crean a mano (PRD-0027 §7.6).
 *
 * 🔴 **La categoría no es una etiqueta.** Define con qué paga la alumna, cómo
 * cobra la profesora y si la clase cuelga de un horario, y ahí un error cuesta
 * plata. Por eso cada categoría dice las tres cosas: agregar una tercera es
 * agregar un caso acá, y TypeScript obliga a contestarlas.
 */

export type Categoria = "recuperativa" | "especial";

export type DefinicionCategoria = {
  nombre: string;
  /** Lo que lee quien la crea, antes de llenar nada. */
  queEs: string;
  pagaLaAlumna: "credito" | "plata";
  cobraLaProfesora: "base_y_variable" | "mitad_de_lo_recaudado";
  cuelgaDeUnHorario: boolean;
  /** Canción, dificultad, descripción, Reel, precio y mínimo de alumnas. */
  llevaMarketing: boolean;
};

export const CATEGORIAS: Record<Categoria, DefinicionCategoria> = {
  recuperativa: {
    nombre: "Recuperativa",
    queEs:
      "Recupera una clase que no se dictó. La alumna reserva con su crédito y la profesora cobra base más variable, como en una clase normal.",
    pagaLaAlumna: "credito",
    cobraLaProfesora: "base_y_variable",
    cuelgaDeUnHorario: true,
    llevaMarketing: false,
  },
  especial: {
    nombre: "Clase especial / intensivo",
    queEs:
      "La alumna paga con plata, no con créditos. La profesora cobra el 50% de lo recaudado menos la sala, sin base ni variable.",
    pagaLaAlumna: "plata",
    cobraLaProfesora: "mitad_de_lo_recaudado",
    cuelgaDeUnHorario: false,
    llevaMarketing: true,
  },
};

export const ORDEN_CATEGORIAS: readonly Categoria[] = ["recuperativa", "especial"];

export function esCategoria(valor: string | undefined): valor is Categoria {
  return valor !== undefined && Object.hasOwn(CATEGORIAS, valor);
}
