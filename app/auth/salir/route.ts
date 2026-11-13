import { NextResponse } from "next/server";
import { volverInterno } from "@/lib/rutas";
import { clienteServidor } from "@/lib/supabase/servidor";

/**
 * Cerrar sesión. Va por POST para que no la dispare un prefetch ni una imagen.
 *
 * Acepta un `volver` interno en el formulario: desde `/entrar`, con un enlace
 * que no sirvió y la sesión de otra persona abierta, salir tiene que dejarla
 * en `/entrar` con la clase que había pedido, no en la portada (Felipe,
 * 13/11/2026). Sin `volver`, a la portada, como siempre.
 */
export async function POST(request: Request) {
  const origen = new URL(request.url).origin;
  let volver: string | null = null;
  try {
    const datos = await request.formData();
    const valor = datos.get("volver");
    volver = typeof valor === "string" ? volverInterno(valor) : null;
  } catch {
    // Sin cuerpo de formulario: se sale igual.
  }
  const supabase = await clienteServidor();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(volver ?? "/", origen), { status: 303 });
}
