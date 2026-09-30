import { NextResponse } from "next/server";
import { clienteAdmin } from "@/lib/supabase/admin";
import { clienteServidor } from "@/lib/supabase/servidor";
import { perfilActual } from "@/lib/sesion";
import { tieneNivel } from "@/lib/roles";

/**
 * El comprobante de un egreso: subirlo (POST) y verlo (GET).
 *
 * Va por Route Handler y no por Server Action porque el bucket
 * `comprobantes-egresos` es privado y lo escribe la **service role**; no hay
 * política de escritura para `authenticated`. La sesión se verifica acá, y el
 * tipo y el tamaño **también acá**: lo que valide el navegador es comodidad.
 *
 * Un archivo por egreso, nombrado por su id: subir otro reemplaza el anterior.
 * La columna la escribe `adjuntar_comprobante_egreso`, con el mismo chequeo de
 * owner que el resto.
 */
export const runtime = "nodejs";

const BUCKET = "comprobantes-egresos";
const TIPOS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAXIMO_BYTES = 2 * 1024 * 1024;
const VIGENCIA_S = 60 * 10;

export async function POST(request: Request) {
  const actor = await perfilActual();
  if (!actor || !tieneNivel(actor.rol, "owner")) {
    return NextResponse.json({ mensaje: "No tienes permiso." }, { status: 403 });
  }

  const formulario = await request.formData();
  const egresoId = String(formulario.get("egreso_id") ?? "");
  const archivo = formulario.get("comprobante");

  if (!egresoId || !(archivo instanceof File)) {
    return NextResponse.json({ mensaje: "Falta el egreso o el archivo." }, { status: 400 });
  }

  const extension = TIPOS[archivo.type];
  if (!extension) {
    return NextResponse.json(
      { mensaje: "El comprobante tiene que ser PDF, JPG o WebP." },
      { status: 400 },
    );
  }
  if (archivo.size > MAXIMO_BYTES) {
    return NextResponse.json(
      { mensaje: "El comprobante pesa más de 2 MB. Compríme lo antes de subirlo." },
      { status: 400 },
    );
  }

  const admin = clienteAdmin();
  const ruta = `${egresoId}.${extension}`;

  const { error: errorSubida } = await admin.storage
    .from(BUCKET)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: true });

  if (errorSubida) {
    return NextResponse.json({ mensaje: errorSubida.message }, { status: 500 });
  }

  const { error } = await admin.rpc("adjuntar_comprobante_egreso", {
    p_actor_user_id: actor.userId,
    p_egreso_id: egresoId,
    p_path: ruta,
  });

  if (error) {
    return NextResponse.json({ mensaje: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ruta });
}

/**
 * Ver: se lee la ruta **con la sesión del owner** —la política de `egresos`
 * es de solo owner, así que a cualquier otro le devuelve nada— y recién con
 * eso se firma la URL con la service role.
 */
export async function GET(request: Request) {
  const actor = await perfilActual();
  if (!actor || !tieneNivel(actor.rol, "owner")) {
    return NextResponse.json({ mensaje: "No tienes permiso." }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ mensaje: "Falta el egreso." }, { status: 400 });

  const supabase = await clienteServidor();
  const { data: egreso, error } = await supabase
    .from("egresos")
    .select("comprobante_path")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return NextResponse.json({ mensaje: error.message }, { status: 500 });
  if (!egreso?.comprobante_path) {
    return NextResponse.json({ mensaje: "Ese egreso no tiene comprobante." }, { status: 404 });
  }

  const { data, error: errorFirma } = await clienteAdmin()
    .storage.from(BUCKET)
    .createSignedUrl(egreso.comprobante_path, VIGENCIA_S);

  if (errorFirma || !data?.signedUrl) {
    return NextResponse.json({ mensaje: errorFirma?.message ?? "No se pudo firmar." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl, 302);
}
