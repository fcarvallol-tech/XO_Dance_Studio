import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configSupabase } from "./config";

/**
 * Cliente con la sesión de quien pide la página. Respeta RLS: es lo que
 * queremos para leer, porque si una política está mal, no devuelve datos.
 *
 * En Next 16 `cookies()` es asíncrono, y desde un Server Component escribir
 * cookies lanza. Por eso el `setAll` va en try: el refresco de token lo hace el
 * proxy, que sí puede escribir.
 *
 * ---
 *
 * **Uno por petición, no uno por llamada.** Renderizar una página del portal
 * llegaba a crear ocho: el layout, la página y cada consulta pedían el suyo. Un
 * cliente nuevo no es gratis —lee las cookies, arma su propio GoTrue y, la
 * primera vez del proceso, descarga el JWKS para poder verificar el token— y
 * ocho copias de eso no leen nada distinto que una.
 *
 * `cache()` de React memoiza dentro de la petición y nada más. No cruza
 * peticiones ni personas: el cliente que se comparte es el de quien está
 * pidiendo esta página, con sus cookies. Compartirlo además es lo correcto si el
 * token se refresca a mitad del render: se refresca una vez, no ocho.
 */
export const clienteServidor = cache(async function clienteServidor() {
  // `cookies()` va primero a propósito: es la llamada que saca a la ruta del
  // prerender estático. Si `configSupabase()` lanza antes, el build intenta
  // prerenderizar una página con sesión y se cae.
  const almacen = await cookies();
  const { url, llave } = configSupabase();

  return createServerClient(url, llave, {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(nuevas) {
        try {
          for (const { name, value, options } of nuevas) {
            almacen.set(name, value, options);
          }
        } catch {
          // Server Component: no se puede escribir. Lo resuelve proxy.ts.
        }
      },
    },
  });
});
