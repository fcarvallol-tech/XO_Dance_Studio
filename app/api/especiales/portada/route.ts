import { NextResponse } from "next/server";
import { clienteAdmin } from "@/lib/supabase/admin";
import { perfilActual } from "@/lib/sesion";
import { tieneNivel } from "@/lib/roles";

/**
 * Subir la portada de una clase especial.
 *
 * Va por Route Handler y no por Server Action porque el archivo se sube con la
 * **service role**: el bucket `portadas-especiales` es privado y no tiene
 * política de escritura para `authenticated` (PRD-0018 §7.6). La sesión se
 * verifica acá, y el tipo y el tamaño **también acá**: lo que valide el
 * navegador no es una validación, es una comodidad.
 *
 * Un archivo por clase, nombrado por su id: subir otra portada reemplaza la
 * anterior en vez de acumular basura en el bucket.
 */
export const runtime = "nodejs";

const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAXIMO_BYTES = 1024 * 1024;

export async function POST(request: Request) {
  const actor = await perfilActual();
  if (!actor || !tieneNivel(actor.rol, "admin")) {
    return NextResponse.json({ mensaje: "No tienes permiso." }, { status: 403 });
  }

  const formulario = await request.formData();
  const claseId = String(formulario.get("clase_id") ?? "");
  const archivo = formulario.get("portada");

  if (!claseId || !(archivo instanceof File)) {
    return NextResponse.json({ mensaje: "Falta la clase o el archivo." }, { status: 400 });
  }

  const extension = TIPOS[archivo.type];
  if (!extension) {
    return NextResponse.json(
      { mensaje: "La portada tiene que ser .jpg o .webp." },
      { status: 400 },
    );
  }
  if (archivo.size > MAXIMO_BYTES) {
    return NextResponse.json(
      { mensaje: "La portada pesa más de 1 MB. Compríme la antes de subirla." },
      { status: 400 },
    );
  }

  const admin = clienteAdmin();
  const ruta = `${claseId}.${extension}`;

  const { error: errorSubida } = await admin.storage
    .from("portadas-especiales")
    .upload(ruta, archivo, { contentType: archivo.type, upsert: true });

  if (errorSubida) {
    return NextResponse.json({ mensaje: errorSubida.message }, { status: 500 });
  }

  // La columna la escribe la función de siempre: así la portada queda sujeta a
  // las mismas validaciones de rol que el resto de la ficha.
  const { error } = await admin.rpc("editar_especial", {
    p_actor_user_id: actor.userId,
    p_clase_id: claseId,
    p_portada_path: ruta,
  });

  if (error) {
    return NextResponse.json({ mensaje: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ruta });
}
