import type { CursoId, ProfesoraId } from "./tipos";

export type Profesora = {
  id: ProfesoraId;
  nombre: string;
  /** Eyebrow del lineup: el estilo que enseña, en minúsculas y corto. */
  estilo: string;
  /** Texto propio de cada profesora, tal cual lo escribió. TODO: faltan Carli y Maida. */
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
    bio:
      "Soy la Pau💗 mi estilo de baile es muy femenino, esta es la base de mis clases de girly y reggaeton. En ambos cursos podrás aprender a ocupar todo tu cuerpo (amplitud), mantener el centro (equilibrio), y trabajo de suelo. El nivel coreográfico será básico, y el nivel explicativo, principiante. Esta es TU clase, estaré muy preocupada de ir a tu ritmo😉 Tengo muchas ganas de conocerte!! Nos vemos en xo💋",
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
    bio:
      "Holaa✨️ Soy la Drimy, bailo hace 8 años y me dedico principalmente a los estilos urbanos y al jazz. La danza ha sido una parte fundamental de mi crecimiento personal: me ayudó a conocerme, a confiar en mí misma y a descubrir una seguridad que no sabía que necesitaba. Por eso decidí enseñar; porque quiero que otras personas también puedan encontrar en la danza un espacio para potenciarse, ganar confianza y crecer. Me apasiona acompañar ese proceso y ver cómo cada persona descubre todo lo que es capaz de hacer a través del movimiento.",
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
    bio:
      "Soy Lina, bailarina, intérprete y profesora. A lo largo de los años he aprendido y explorado distintos estilos como jazz y urbano, además de técnicas como ballet, lo que me ha permitido ir formando mi propia manera de bailar y de enseñar. Desde 2024 hago clases a niños y niñas desde los 2 hasta los 13 años, y me encanta poder compartir con ellos todo lo que he aprendido. En mis clases busco que cada niño pueda aprender a su ritmo, divertirse, expresarse y, sobre todo, disfrutar del baile. Nos vemos en clase!",
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
