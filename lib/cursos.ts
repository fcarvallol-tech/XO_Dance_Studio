import type { CursoId, ProfesoraId } from "./tipos";

export type Curso = {
  id: CursoId;
  nombre: string;
  /** Eyebrow: a quién está dirigido, en una línea corta. */
  publico: string;
  /** El estilo que se baila. Va como tag. */
  estilo: string;
  /** Copy de venta. Kids y Teens le hablan a la mamá; el resto, a la alumna. */
  descripcion: string;
  /** Solo Girly: el formato intensivo mensual por artista. */
  formato: string | null;
  profesoras: ProfesoraId[];
  /**
   * Un curso que sale del catálogo no se borra: se desactiva. Los leads
   * históricos apuntan a su id y tienen que seguir siendo legibles.
   * Inactivo significa que no se muestra ni se acepta en un lead nuevo.
   */
  activa: boolean;

  // TODO — pendientes de Carla. `null` se muestra como "Por confirmar".
  // Este es el único lugar donde se editan: no repetir estos datos en la UI.
  precio: string | null;
  horario: string | null;
  cupos: number | null;
};

export const CURSOS: Curso[] = [
  {
    id: "kids",
    nombre: "XO Kids",
    publico: "Niñas de 7 a 10 años",
    estilo: "Urbano",
    descripcion:
      "Tu hija va a esperar el día de la clase toda la semana. Grupos chicos, profes que se aprenden su nombre la primera clase, y un espacio donde hace amigas mientras aprende a moverse con confianza.",
    formato: null,
    profesoras: ["drimy", "lina"],
    // Fuera del catálogo desde el 21/08/2026: la franja de 7 a 10 deja de
    // ofrecerse y las alumnas actuales pasan a Teens. No se borra.
    activa: false,
    precio: null, // TODO
    horario: null, // TODO
    cupos: null, // TODO
  },
  {
    id: "teens",
    nombre: "XO Teens",
    publico: "Niñas de 11 a 15 años",
    estilo: "Urbano",
    descripcion:
      "La misma cercanía que en Kids, con más técnica y más actitud. Es la edad en que quieren pertenecer a algo: acá tienen dónde.",
    formato: null,
    profesoras: ["carli", "drimy", "lina"],
    activa: true,
    precio: null, // TODO
    horario: null, // TODO
    cupos: null, // TODO
  },
  {
    id: "girly-basico",
    nombre: "XO Girly Básico",
    publico: "Mujeres desde 16 años · sin experiencia",
    estilo: "Reggaetón femenino",
    descripcion:
      "Nunca bailaste reggaetón y te da lata partir. Se empieza de cero, y en cuatro semanas te sabes una coreografía completa del artista del mes.",
    formato:
      "Intensivo mensual por artista. Un artista al mes —Omar Cruz, De la Rose, Standly—, cuatro clases y una coreografía nueva por semana.",
    profesoras: ["carli", "pau"],
    activa: true,
    precio: null, // TODO
    horario: null, // TODO
    cupos: null, // TODO
  },
  {
    id: "girly-intermedio",
    nombre: "XO Girly Intermedio",
    publico: "Mujeres con experiencia previa",
    estilo: "Reggaetón femenino",
    descripcion:
      "Ya bailas y quieres exigirte. Mismo formato mensual, más técnica, más trucos y más velocidad para armarte un estilo propio.",
    formato:
      "Intensivo mensual por artista. Un artista al mes, cuatro clases y una coreografía nueva por semana.",
    profesoras: ["pau"],
    activa: true,
    precio: null, // TODO
    horario: null, // TODO
    cupos: null, // TODO
  },
  {
    id: "kpop",
    nombre: "K-Pop",
    publico: "Todas las edades",
    estilo: "K-Pop",
    descripcion:
      "Las coreografías que te aprendiste sola en tu pieza, ahora con el grupo completo y frente al espejo. Se baila y se conversa de lo mismo.",
    formato: null,
    profesoras: ["maida"],
    activa: true,
    precio: null, // TODO
    horario: null, // TODO
    cupos: null, // TODO
  },
];

/** Los que se ofrecen hoy. Es lo que ve la visitante. */
export const CURSOS_ACTIVOS: Curso[] = CURSOS.filter((curso) => curso.activa);

/**
 * Resuelve cualquier curso, activo o no. Es lo que hace falta para mostrar
 * un lead histórico o el curso de una profesora sin que aparezcan huecos.
 */
export function getCurso(id: CursoId): Curso | undefined {
  return CURSOS.find((curso) => curso.id === id);
}

/**
 * El que vale para captar un lead nuevo. Un curso fuera del catálogo no se
 * muestra, así que tampoco se acepta en el servidor.
 */
export function esCursoActivo(id: string): id is CursoId {
  return CURSOS_ACTIVOS.some((curso) => curso.id === id);
}
