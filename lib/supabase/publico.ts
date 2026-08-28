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
export function clientePublico() {
  const { url, llave } = configSupabase();

  return createClient(url, llave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
