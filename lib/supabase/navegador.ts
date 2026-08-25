"use client";

import { createBrowserClient } from "@supabase/ssr";
import { configSupabase } from "./config";

/** Cliente del navegador. Solo para iniciar sesión: nunca escribe datos. */
export function clienteNavegador() {
  const { url, llave } = configSupabase();
  return createBrowserClient(url, llave);
}
