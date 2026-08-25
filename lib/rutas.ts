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
  cuenta: ["/mi-perfil"],
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
