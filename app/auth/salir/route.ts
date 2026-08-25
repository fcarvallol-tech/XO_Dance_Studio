import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

/** Cerrar sesión. Va por POST para que no la dispare un prefetch ni una imagen. */
export async function POST(request: Request) {
  const supabase = await clienteServidor();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", new URL(request.url).origin), {
    status: 303,
  });
}
