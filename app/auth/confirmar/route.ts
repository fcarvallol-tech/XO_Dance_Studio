import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

/**
 * Aterrizaje del magic link.
 *
 * Este es el camino que hace posible que entre una alumna sin cuenta de Google
 * —Google exige 13 años y la academia recibe antes—, que es la razón entera de
 * ADR-0006.
 *
 * ---
 *
 * **Acepta dos formas de llegar, y no es por gusto.** Estuvo roto desde
 * PRD-0004 por leer solo una:
 *
 * 1. **`?token_hash=…&type=…`** — cuando el correo apunta directo acá. Es el
 *    único que **funciona entre dispositivos**: pedir el enlace en el
 *    computador y abrirlo en el teléfono. Requiere que el template del correo
 *    en Supabase use `{{ .TokenHash }}`; ver PRD-0004 §13.
 *
 * 2. **`?code=…`** — cuando el correo apunta al `/auth/v1/verify` de Supabase y
 *    éste redirige acá tras validar. Es lo que ocurre con PKCE, que es el flujo
 *    por defecto de `createBrowserClient`. Solo sirve **en el mismo navegador**
 *    que pidió el enlace, porque el `code_verifier` quedó guardado ahí.
 *
 * Lo que **no** se puede rescatar desde el servidor es el fragmento
 * (`#access_token=…`) que devuelve el flujo implícito: el navegador nunca manda
 * la parte después del `#`. Si llega así, se dice explícitamente en vez de
 * culpar al enlace.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const volver = destinoSeguro(url.searchParams.get("volver"));

  // Supabase puede devolver su propio error en la query.
  const errorSupabase = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (errorSupabase) {
    console.error("Supabase rechazó el enlace:", errorSupabase);
    return NextResponse.redirect(new URL("/entrar?error=enlace", url.origin));
  }

  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");

  const supabase = await clienteServidor();

  // Camino 1: el correo apunta directo acá con el token.
  if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (error) {
      // Acá sí es cierto que el enlace no sirve: vencen y son de un solo uso.
      console.error("Magic link inválido o ya usado:", error.message);
      return NextResponse.redirect(new URL("/entrar?error=enlace", url.origin));
    }
    return NextResponse.redirect(new URL(volver, url.origin));
  }

  // Camino 2: Supabase ya validó el token y nos manda el code de PKCE.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // Lo más probable acá no es que el enlace esté malo, sino que se abrió en
      // otro navegador: el code_verifier de PKCE vive donde se pidió.
      console.error("No se pudo canjear el código del magic link:", error.message);
      return NextResponse.redirect(new URL("/entrar?error=otro-navegador", url.origin));
    }
    return NextResponse.redirect(new URL(volver, url.origin));
  }

  // No llegó nada utilizable. **No es que el enlace haya expirado**: es que
  // viene en una forma que el servidor no puede leer, casi siempre el fragmento
  // del flujo implícito. Decirle a la persona que su enlace venció sería
  // mentirle y mandarla a pedir otro que va a fallar igual.
  console.error(
    "El magic link llegó sin token_hash ni code. Si el enlace traía " +
      "#access_token=…, el template del correo está apuntando a /auth/v1/verify " +
      "en vez de a esta ruta. Ver PRD-0004 §13.",
  );
  return NextResponse.redirect(new URL("/entrar?error=configuracion", url.origin));
}

/**
 * Solo rutas internas. Un `?volver=` con host ajeno convertiría el login en un
 * redirector abierto para phishing.
 */
function destinoSeguro(valor: string | null): string {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//")) {
    return "/mis-clases";
  }
  return valor;
}
