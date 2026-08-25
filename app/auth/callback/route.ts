import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

/**
 * Vuelta de Google. Cambia el `code` por una sesión y deja la cookie puesta.
 *
 * Supabase vincula solo las identidades que comparten correo verificado, así
 * que quien ya entró por magic link con el mismo correo vuelve al mismo
 * usuario, no a uno nuevo.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const volver = destinoSeguro(url.searchParams.get("volver"));

  if (!code) {
    return NextResponse.redirect(new URL("/entrar?error=sin-codigo", url.origin));
  }

  const supabase = await clienteServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("No se pudo canjear el código de Google:", error.message);
    return NextResponse.redirect(new URL("/entrar?error=codigo", url.origin));
  }

  return NextResponse.redirect(new URL(volver, url.origin));
}

/**
 * Solo rutas internas. Un `?volver=` con host ajeno convertiría el login en un
 * redirector abierto para phishing.
 */
function destinoSeguro(valor: string | null): string {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//")) {
    return "/mi-perfil";
  }
  return valor;
}
