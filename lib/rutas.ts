/**
 * Qué ruta cubre qué layout.
 *
 * Existe por un bucle de redirección real: el layout de `(cuenta)` mandaba a
 * `/completar-perfil`, que vivía dentro de `(cuenta)`, así que el mismo layout
 * volvía a correr y a redirigir. Ver PRD-0004 §12.
 *
 * Con este mapa, un guard puede preguntar antes de redirigir si el destino cae
 * bajo el layout que lo está ejecutando, que es la definición exacta del bucle.
 */

export type Grupo = "cuenta" | "profesora" | "admin" | "owner";

/** Las rutas que cubre el layout de cada grupo. */
export const RUTAS_DE_GRUPO: Record<Grupo, string[]> = {
  // `/comprar` **no** está acá desde PRD-0020: es la vitrina pública, y el paso
  // que sí exige sesión vive en `/transferir/<oferta>`. Se resolvió así, y no
  // con excepciones dentro de `/comprar`, porque `empiezaEn` compara **por
  // prefijo**: cualquier regla que intentara abrir `/comprar/pack-4` dejando
  // cerrado `/comprar/pack-4/transferir` sería justamente el tipo de lógica que
  // en este proyecto ya produjo un bucle de redirección (PRD-0004 §12). Con dos
  // raíces distintas no hay nada que afinar.
  cuenta: ["/mi-perfil", "/transferir", "/reservar", "/reservar-especial", "/mis-clases"],
  profesora: ["/profesora"],
  admin: ["/admin"],
  owner: ["/owner"],
};

/**
 * Las que exigen sesión. `/completar-perfil` está acá pero **no** en
 * `RUTAS_DE_GRUPO`: necesita sesión y vive fuera de todo grupo, justamente para
 * que ningún layout de grupo pueda redirigir hacia ella y volver a ejecutarse.
 */
export const RUTAS_CON_SESION: string[] = [
  "/completar-perfil",
  ...Object.values(RUTAS_DE_GRUPO).flat(),
];

/**
 * Destino de último recurso. La landing es pública y no tiene layout de grupo,
 * así que ningún guard corre sobre ella: siempre es seguro mandar ahí.
 */
export const RUTA_NEUTRAL = "/";

export function empiezaEn(ruta: string, base: string): boolean {
  return ruta === base || ruta.startsWith(`${base}/`);
}

/** ¿El layout de `grupo` corre sobre `ruta`? */
export function cubiertaPor(ruta: string, grupo: Grupo): boolean {
  return RUTAS_DE_GRUPO[grupo].some((base) => empiezaEn(ruta, base));
}

export function exigeSesion(ruta: string): boolean {
  return RUTAS_CON_SESION.some((base) => empiezaEn(ruta, base));
}

/**
 * La ruta que se pidió, puesta por `proxy.ts` en cada petición.
 *
 * Existe porque **un layout no sabe en qué página está**, y es el layout el que
 * descubre que el perfil está incompleto y manda a completarlo. Sin esto, la
 * alumna que apretó "Comprar" terminaba en `/mis-clases` con saldo 0 en vez de
 * volver al pack (PRD-0017 §19). El proxy la sobrescribe siempre: lo que mande
 * el navegador con este nombre no llega.
 */
export const CABECERA_RUTA = "x-xo-ruta";

/**
 * El `?volver=` es seguro para un redirect, o `null`.
 *
 * Llega de la URL y lo escribe cualquiera, así que se descarta:
 * - lo que no es una ruta de este sitio: `//host` y `/\host` los navegadores
 *   los leen como otro dominio, y el login quedaría de redirector para phishing;
 * - `/completar-perfil`, que es la página que lo lee: volver ahí es un bucle;
 * - `/auth/…`, que canjean enlaces de un solo uso.
 *
 * Una sola función para todo el camino de entrada. Antes había una copia en
 * cada ruta de `/auth`, y la de completar el perfil no existía.
 */
export function volverInterno(valor: string | null | undefined): string | null {
  if (!valor || !valor.startsWith("/")) return null;
  if (valor.startsWith("//") || valor.startsWith("/\\")) return null;
  if (empiezaEn(valor.split("?")[0], "/completar-perfil")) return null;
  if (empiezaEn(valor.split("?")[0], "/auth")) return null;
  return valor;
}
