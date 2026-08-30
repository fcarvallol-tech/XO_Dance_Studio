/** Solo dígitos, con código de país. Formato que espera wa.me. */
export const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP ?? "56984362290";

export const WHATSAPP_VISIBLE = "+56 9 8436 2290";

export const INSTAGRAM_HANDLE = "@XO.dancestudioo";
export const INSTAGRAM_URL = "https://www.instagram.com/xo.dancestudioo/";

/**
 * Las dos comunas donde hay sala. Desde PRD-0016 la dirección exacta **sí** se
 * publica: vive en la tabla `sedes` y se muestra en la sección Sedes.
 */
export const UBICACION = "Providencia y Las Condes, Santiago";

export const INICIO_CLASES = "Las clases parten en septiembre";

export function linkWhatsApp(mensaje: string): string {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
}
