import { createClient } from "@supabase/supabase-js";
import { configSupabase } from "./config";

/**
 * Cliente del catálogo público. Entra como rol `anon` y **no toca cookies**.
 *
 * Eso último es la razón de que exista, y no un detalle: `clienteServidor()`
 * llama a `cookies()`, y esa llamada saca la ruta del prerender — es lo que nos
 * obligó a marcar `force-dynamic` en los portales de PRD-0004. Con este cliente
 * la landing y los perfiles de profesora se siguen generando estáticos.
 *
 * Como entra sin sesión, RLS le entrega solo cursos y profesoras activos. El
 * filtro es del motor, no de la aplicación.
 */
export function clientePublico(opciones: { revalidarSegundos?: number } = {}) {
  const { url, llave } = configSupabase();
  const { revalidarSegundos } = opciones;

  return createClient(url, llave, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Next guarda cada `fetch` en su caché de datos con el `revalidate` de la
    // página —una hora en casi todo el sitio—. Para lo que no puede esperar una
    // hora, quien llama pide menos.
    ...(revalidarSegundos !== undefined
      ? {
          global: {
            fetch: (entrada: RequestInfo | URL, init?: RequestInit) =>
              fetch(entrada, { ...init, next: { revalidate: revalidarSegundos } }),
          },
        }
      : {}),
  });
}
