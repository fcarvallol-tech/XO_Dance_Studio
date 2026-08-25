import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

/**
 * Aterrizaje del magic link. Verifica el `token_hash` que viene en el correo y
 * abre la sesión.
 *
 * Este es el camino que hace posible que entre una alumna sin cuenta de Google
 * —Google exige 13 años y la academia recibe antes—, que es la razón entera de
 * ADR-0006.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;
  const volver = destinoSeguro(url.searchParams.get("volver"));

  if (!tokenHash || !tipo) {
    return NextResponse.redirect(new URL("/entrar?error=enlace", url.origin));
  }

  const supabase = await clienteServidor();
  const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });

  if (error) {
    // Vencido o ya usado. Los magic links son de un solo uso.
    console.error("Magic link inválido:", error.message);
    return NextResponse.redirect(new URL("/entrar?error=enlace", url.origin));
  }

  return NextResponse.redirect(new URL(volver, url.origin));
}

function destinoSeguro(valor: string | null): string {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//")) {
    return "/mi-perfil";
  }
  return valor;
}
