import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { validarLead } from "@/lib/lead";

/**
 * Guarda el lead antes de mandar a WhatsApp. La inserción pasa por acá, nunca
 * desde el cliente: la service role key salta RLS y no puede salir del servidor.
 */
export async function POST(request: Request) {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json(
      { mensaje: "No entendimos los datos enviados. Recarga y prueba de nuevo." },
      { status: 400 },
    );
  }

  const validacion = validarLead(cuerpo as Parameters<typeof validarLead>[0]);
  if (!validacion.ok) {
    return NextResponse.json(
      {
        mensaje: "Revisa los campos marcados y vuelve a enviar.",
        errores: validacion.errores,
      },
      { status: 400 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.",
    );
    return NextResponse.json(
      {
        mensaje:
          "No pudimos guardar tus datos. Escríbenos por WhatsApp y te anotamos al tiro.",
      },
      { status: 500 },
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { lead } = validacion;
  const { error } = await supabase.from("leads").insert({
    nombre: lead.nombre,
    whatsapp: lead.whatsapp,
    para_quien: lead.paraQuien,
    edad_alumna: lead.edadAlumna,
    curso_id: lead.cursoId,
    profesora_id: lead.profesoraId,
    origen: lead.origen,
  });

  if (error) {
    console.error("Error al insertar el lead:", error);
    return NextResponse.json(
      {
        mensaje:
          "No pudimos guardar tus datos. Escríbenos por WhatsApp y te anotamos al tiro.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
