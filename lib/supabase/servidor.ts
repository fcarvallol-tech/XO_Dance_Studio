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
 */
export async function clienteServidor() {
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
}
