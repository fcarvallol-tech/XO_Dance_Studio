import type { CursoId, ProfesoraId } from "./tipos";

export type Profesora = {
  id: ProfesoraId;
  nombre: string;
  /** Eyebrow del lineup: el estilo que enseña, en minúsculas y corto. */
  estilo: string;
  /** TODO — bio real pendiente de cada profesora. */
  bio: string;
  cursos: CursoId[];
  instagram: string;
  /** TODO — material pendiente. Ruta dentro de /public, o null. */
  video: string | null;
  foto: string | null;
  /**
   * Una profesora que se va no se borra: se desactiva. Los leads históricos
   * apuntan a su id y tienen que seguir siendo legibles. Inactiva significa
   * que no aparece en el selector del formulario ni tiene perfil público.
   */
  activa: boolean;
};

export const PROFESORAS: Profesora[] = [
  {
    id: "carli",
    nombre: "Carli",
    estilo: "reggaetón femenino · urbano",
    bio: 'Acá la bio de "Carli"',
    cursos: ["girly-basico", "teens"],
    instagram: "https://www.instagram.com/carlataty.20/",
    video: null,
    foto: null,
    activa: true,
  },
  {
    id: "pau",
    nombre: "Pau",
    estilo: "reggaetón femenino",
    bio: 'Acá la bio de "Pau"',
    cursos: ["girly-basico", "girly-intermedio"],
    instagram: "https://www.instagram.com/pau_balbontinc/",
    video: null,
    foto: null,
    activa: true,
  },
  {
    id: "drimy",
    nombre: "Drimy",
    estilo: "urbano teens",
    bio: 'Acá la bio de "Drimy"',
    cursos: ["teens"],
    instagram: "https://www.instagram.com/ladrimy/",
    video: null,
    foto: null,
    activa: true,
  },
  {
    id: "lina",
    nombre: "Lina",
    estilo: "urbano teens",
    bio: 'Acá la bio de "Lina"',
    cursos: ["teens"],
    instagram: "https://www.instagram.com/linaapop/",
    video: null,
    foto: null,
    activa: true,
  },
  {
    id: "maida",
    nombre: "Maida",
    estilo: "k-pop",
    bio: 'Acá la bio de "Maida"',
    cursos: ["kpop"],
    instagram: "https://www.instagram.com/maidaquirozc/",
    video: null,
    foto: null,
    activa: true,
  },
];

/** Las que se ofrecen hoy. Es lo que ve la visitante, en el orden del lineup. */
export const PROFESORAS_ACTIVAS: Profesora[] = PROFESORAS.filter(
  (profesora) => profesora.activa,
);

export function getProfesora(id: ProfesoraId): Profesora | undefined {
  return PROFESORAS.find((profesora) => profesora.id === id);
}

/** Solo para lo que mira al público: perfiles y selector del formulario. */
export function getProfesoraActiva(id: string): Profesora | undefined {
  return PROFESORAS_ACTIVAS.find((profesora) => profesora.id === id);
}

export function nombresDe(ids: ProfesoraId[]): string[] {
  return ids
    .map((id) => getProfesora(id)?.nombre)
    .filter((nombre): nombre is string => Boolean(nombre));
}

/**
 * La que vale para captar un lead. Una profesora inactiva no está en el
 * selector, así que tampoco se acepta en el servidor.
 */
export function esProfesoraActiva(id: string): id is ProfesoraId {
  return PROFESORAS_ACTIVAS.some((profesora) => profesora.id === id);
}
