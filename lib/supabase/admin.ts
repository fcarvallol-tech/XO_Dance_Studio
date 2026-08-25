import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la service role key: **salta RLS**. Nunca puede salir del
 * servidor ni usarse para responderle datos a alguien sin verificar antes
 * quién es.
 *
 * Se usa solo donde RLS no alcanza: escribir leads desde la landing pública, y
 * llamar a `cambiar_rol`, que es la única operación que puede tocar la columna
 * `rol`.
 */
export function clienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !llave) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.",
    );
  }

  return createClient(url, llave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
