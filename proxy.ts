import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CABECERA_RUTA, exigeSesion } from "@/lib/rutas";

/**
 * Proxy — en Next 16 es lo que antes se llamaba middleware.
 *
 * Hace dos cosas, y ninguna es autorizar:
 *
 * 1. **Refresca el token.** Un Server Component no puede escribir cookies, así
 *    que si el token venció, el único lugar donde se puede guardar el nuevo es
 *    acá.
 * 2. **Chequeo optimista.** Redirige a /entrar a quien claramente no tiene
 *    sesión, para no renderizar media página primero.
 *
 * Y una tercera, que no decide nada: **marca la ruta pedida** en la cabecera
 * `CABECERA_RUTA`, para que el layout que descubre un perfil incompleto sepa a
 * dónde volver después (PRD-0017 §19). Un layout no tiene otra forma de saberlo.
 *
 * La autorización de verdad vive en el layout de cada grupo (`requiereNivel`) y
 * en las políticas RLS. La doc de Next es explícita: el proxy corre en cada
 * ruta, incluidas las prefetcheadas, y "should not be used as a full session
 * management or authorization solution". Acá no se consulta el rol.
 */
export async function proxy(request: NextRequest) {
  // Se arma de nuevo cada vez que cambian las cookies, para que la petición que
  // sigue lleve **las dos cosas**: el token refrescado y la ruta. Con `set` y
  // no `append`, lo que haya mandado el navegador con ese nombre se pisa.
  const seguir = () => {
    const cabeceras = new Headers(request.headers);
    cabeceras.set(CABECERA_RUTA, request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.next({ request: { headers: cabeceras } });
  };
  let respuesta = seguir();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const llave =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  // Sin configuración no hay sesión que refrescar. La landing pública no
  // depende de esto y tiene que seguir sirviéndose igual.
  if (!url || !llave) return respuesta;

  const supabase = createServerClient(url, llave, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nuevas) {
        for (const { name, value } of nuevas) {
          request.cookies.set(name, value);
        }
        respuesta = seguir();
        for (const { name, value, options } of nuevas) {
          respuesta.cookies.set(name, value, options);
        }
      },
    },
  });

  // Esta llamada es la que refresca el token y dispara setAll. No se puede
  // omitir aunque no se use el resultado.
  const { data } = await supabase.auth.getClaims();
  const haySesion = Boolean(data?.claims?.sub);

  // La lista vive en lib/rutas.ts, junto al mapa de qué layout cubre qué, para
  // que no se pueda desincronizar con los guards.
  const ruta = request.nextUrl.pathname;

  if (exigeSesion(ruta) && !haySesion) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/entrar";
    destino.search = `?volver=${encodeURIComponent(ruta)}`;
    return NextResponse.redirect(destino);
  }

  return respuesta;
}

export const config = {
  // Todo menos estáticos e imágenes. Las rutas de /auth quedan dentro a
  // propósito: son las que escriben la cookie de sesión.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|ico|ttf|woff2?)$).*)",
  ],
};
