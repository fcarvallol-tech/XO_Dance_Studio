import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { clienteAdmin } from "@/lib/supabase/admin";
import { perfilActual } from "@/lib/sesion";
import { tieneNivel } from "@/lib/roles";

/**
 * Marcar pagada una liquidación cerrada (POST) y ver su comprobante (GET). PRD-0010
 * parte 3 §8.4: el archivo va en el mismo paso, porque "lo subo después" en la
 * práctica es "nunca". Si la base rebota, el archivo se borra.
 */

const BUCKET = "comprobantes-liquidaciones";
const TIPOS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
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
  const id = String(formulario.get("liquidacion_id") ?? "");
  const archivo = formulario.get("comprobante");
  if (!id || !(archivo instanceof File) || archivo.size === 0) {
    return NextResponse.json({ mensaje: "Falta el comprobante." }, { status: 400 });
  }
  const extension = TIPOS[archivo.type];
  if (!extension) {
    return NextResponse.json({ mensaje: "El comprobante tiene que ser PDF, JPG, PNG o WebP." }, { status: 400 });
  }
  if (archivo.size > MAXIMO_BYTES) {
    return NextResponse.json({ mensaje: "El comprobante pesa más de 2 MB." }, { status: 400 });
  }

  const admin = clienteAdmin();
  const ruta = `${id}.${extension}`;
  const { error: errorSubida } = await admin.storage.from(BUCKET).upload(ruta, archivo, {
    contentType: archivo.type,
    upsert: true,
  });
  if (errorSubida) {
    console.error("No se pudo subir el comprobante:", errorSubida.message);
    return NextResponse.json({ mensaje: "No se pudo subir el comprobante." }, { status: 500 });
  }

  const { error } = await admin.rpc("pagar_liquidacion", {
    p_actor_user_id: actor.userId,
    p_liquidacion_id: id,
    p_comprobante_path: ruta,
  });
  if (error) {
    // Un pago que ya estaba registrado usa este mismo archivo: no se borra.
    if (error.code !== "23514") await admin.storage.from(BUCKET).remove([ruta]);
    const mostrable = ["23514", "42501", "22023", "P0002"].includes(error.code ?? "");
    if (!mostrable) console.error("Error al pagar la liquidación:", error);
    return NextResponse.json(
      { mensaje: mostrable ? error.message : "Algo falló de nuestro lado." },
      { status: 400 },
    );
  }

  revalidatePath("/owner/liquidaciones");
  revalidatePath("/owner/finanzas");
  revalidatePath("/profesora/liquidacion");
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const actor = await perfilActual();
  if (!actor || !tieneNivel(actor.rol, "owner")) {
    return NextResponse.json({ mensaje: "No tienes permiso." }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id") ?? "";
  const admin = clienteAdmin();
  const { data } = await admin
    .from("liquidaciones_profesoras")
    .select("comprobante_path")
    .eq("id", id)
    .maybeSingle();
  if (!data?.comprobante_path) {
    return NextResponse.json({ mensaje: "Esa liquidación no tiene comprobante." }, { status: 404 });
  }

  const { data: firmada, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(data.comprobante_path, VIGENCIA_S);
  if (error || !firmada) {
    return NextResponse.json({ mensaje: "No se pudo abrir el comprobante." }, { status: 500 });
  }
  return NextResponse.redirect(firmada.signedUrl);
}
