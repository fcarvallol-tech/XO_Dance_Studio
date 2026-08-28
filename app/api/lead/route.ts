import { NextResponse } from "next/server";
import { validarLead } from "@/lib/lead";
import { clienteAdmin } from "@/lib/supabase/admin";

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

  let supabase;
  try {
    supabase = clienteAdmin();
  } catch (fallo) {
    console.error(fallo);
    return NextResponse.json(
      {
        mensaje:
          "No pudimos guardar tus datos. Escríbenos por WhatsApp y te anotamos al tiro.",
      },
      { status: 500 },
    );
  }

  // crear_lead valida y escribe en una sola llamada: comprueba que el curso y
  // la profesora existan y estén activos —lo único que la aplicación no puede
  // saber sin consultar— y recién ahí inserta. Un viaje a Supabase, igual que
  // cuando el catálogo vivía en un arreglo. Ver PRD-0015 §6.
  const { lead } = validacion;
  const { error } = await supabase.rpc("crear_lead", {
    p_nombre: lead.nombre,
    p_whatsapp: lead.whatsapp,
    p_para_quien: lead.paraQuien,
    p_edad_alumna: lead.edadAlumna,
    p_curso_id: lead.cursoId,
    p_profesora_id: lead.profesoraId,
    p_origen: lead.origen,
  });

  if (error) {
    console.error("Error al guardar el lead:", error);

    // 23503 es lo que levanta crear_lead cuando el curso o la profesora no
    // están vigentes: es culpa del dato enviado, no del servidor. Puede pasar
    // de verdad — la página es estática y alguien puede tenerla abierta desde
    // antes de que se desactivara una profesora.
    if (error.code === "23503") {
      return NextResponse.json(
        {
          mensaje:
            "Esa profesora ya no está tomando inscripciones. Recarga la página y elige otra.",
          errores: { profesoraId: "Elige con quién quieres tomar clases." },
        },
        { status: 400 },
      );
    }

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
