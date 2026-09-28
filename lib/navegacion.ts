/**
 * Los caminos del sitio público, en un solo lugar.
 *
 * Existe para que la barra, el menú móvil y el pie **no se puedan
 * desincronizar**: agregar una página y que aparezca en dos de los tres lugares
 * es el tipo de error que nadie reporta porque desde la página que uno mira se
 * ve bien.
 *
 * El orden es el que decidió Felipe (PRD-0022 §3) y **no es alfabético ni
 * casual**: primero lo que alguien viene a hacer —ver cuándo hay clases, quién
 * las dicta, cuánto cuestan—, y al final lo institucional.
 */

export type Camino = { href: string; texto: string };

export const CAMINOS: Camino[] = [
  { href: "/calendario", texto: "Calendario" },
  { href: "/nuestras-profes", texto: "Nuestras Profes" },
  { href: "/comprar", texto: "Packs de clases" },
  { href: "/clases-especiales", texto: "Clases Especiales" },
  { href: "/nosotros", texto: "Nosotros" },
  { href: "/ayuda", texto: "Ayuda" },
];

/**
 * A dónde lleva "Mi Cuenta". `/entrar` ya resuelve los dos casos: con sesión
 * manda a cada rol a su inicio, sin sesión muestra la puerta.
 */
export const MI_CUENTA: Camino = { href: "/entrar", texto: "Mi Cuenta" };

/**
 * Las anclas de la landing vieja y a qué página corresponden ahora.
 *
 * Están publicadas en Instagram y en los perfiles de profesora, así que no
 * pueden quedar rotas. ⚠️ **Una ancla no llega al servidor** —el navegador no
 * manda lo que va después del `#`—, así que esto no se puede resolver con una
 * redirección: lo lee un componente cliente en la portada.
 */
export const ANCLAS_VIEJAS: Record<string, string> = {
  "#planes": "/comprar",
  "#profesoras": "/nuestras-profes",
  "#cursos": "/calendario",
  "#sedes": "/nosotros",
  "#que-es-xo": "/nosotros",
  "#clase-de-prueba": "/comprar",
  "#inscripcion": "/comprar",
};
