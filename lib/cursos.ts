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
    precio: null, // TODO
    horario: null, // TODO
    cupos: null, // TODO
  },
];

export function getCurso(id: CursoId): Curso | undefined {
  return CURSOS.find((curso) => curso.id === id);
}

export function esCursoValido(id: string): id is CursoId {
  return CURSOS.some((curso) => curso.id === id);
}
