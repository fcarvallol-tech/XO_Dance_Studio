/**
 * Las dos variables que necesita cualquier cliente de Supabase del navegador.
 *
 * `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` es el formato nuevo (`sb_publishable_…`).
 * Se acepta también `NEXT_PUBLIC_SUPABASE_ANON_KEY` porque es como se llamaba
 * antes y el proyecto todavía puede tenerla con ese nombre en algún entorno.
 *
 * ⚠️ Las `NEXT_PUBLIC_*` se incrustan durante el build: agregarlas en Vercel no
 * hace nada hasta el siguiente deploy sin caché. Ver CONTEXT.md §10.
 */
export function configSupabase(): { url: string; llave: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const llave =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !llave) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en el entorno.",
    );
  }

  return { url, llave };
}
