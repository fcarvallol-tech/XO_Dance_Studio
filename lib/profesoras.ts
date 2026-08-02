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
  },
  {
    id: "drimy",
    nombre: "Drimy",
    estilo: "urbano kids & teens",
    bio: 'Acá la bio de "Drimy"',
    cursos: ["kids", "teens"],
    instagram: "https://www.instagram.com/ladrimy/",
    video: null,
    foto: null,
  },
  {
    id: "lina",
    nombre: "Lina",
    estilo: "urbano kids & teens",
    bio: 'Acá la bio de "Lina"',
    cursos: ["kids", "teens"],
    instagram: "https://www.instagram.com/linaapop/",
    video: null,
    foto: null,
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
  },
];

export function getProfesora(id: ProfesoraId): Profesora | undefined {
  return PROFESORAS.find((profesora) => profesora.id === id);
}

export function nombresDe(ids: ProfesoraId[]): string[] {
  return ids
    .map((id) => getProfesora(id)?.nombre)
    .filter((nombre): nombre is string => Boolean(nombre));
}

export function esProfesoraValida(id: string): id is ProfesoraId {
  return PROFESORAS.some((profesora) => profesora.id === id);
}
