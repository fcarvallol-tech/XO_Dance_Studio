import { NextResponse } from "next/server";
import { esRol, tieneNivel } from "@/lib/roles";
import { perfilActual } from "@/lib/sesion";
import { clienteAdmin } from "@/lib/supabase/admin";

/**
 * El único camino para cambiar el rol de alguien.
 *
 * Hace falta una ruta de servidor porque `authenticated` no tiene grant de
 * `update` sobre la columna `rol` — y eso incluye a admin y owner. Es
 * deliberado: así nadie se autoasigna un rol ni por un descuido en una
 * política, porque el permiso no existe a nivel de Postgres. Quien puede
 * tocar esa columna es la service role key, que vive solo acá.
 *
 * Dos verificaciones, no una:
 *
 * 1. Acá se comprueba la sesión y el nivel de quien llama, para responder algo
 *    entendible y no exponer la base a una llamada sin sesión.
 * 2. `public.cambiar_rol` vuelve a validar todo en la base. Es la única capa
 *    que resiste a alguien con la service role key en la mano, y además hace el
 *    cambio y su registro en la misma transacción: no puede quedar un rol
 *    cambiado sin línea en el libro.
 *
 * Reglas, todas en la función SQL: solo admin o más; nadie cambia su propio
 * rol; nadie asigna por encima de su nivel ni degrada a quien está más arriba;
 * y la academia no puede quedarse sin owner.
 */
export async function POST(request: Request) {
  const actor = await perfilActual();
  if (!actor) {
    return NextResponse.json({ mensaje: "Necesitas iniciar sesión." }, { status: 401 });
  }

  if (!tieneNivel(actor.rol, "admin")) {
    // 404 y no 403: quien no es admin no tiene por qué saber que esto existe.
    return NextResponse.json({ mensaje: "No encontrado." }, { status: 404 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ mensaje: "Datos ilegibles." }, { status: 400 });
  }

  const { perfilId, rol, motivo } = (cuerpo ?? {}) as {
    perfilId?: unknown;
    rol?: unknown;
    motivo?: unknown;
  };

  if (typeof perfilId !== "string" || !perfilId) {
    return NextResponse.json({ mensaje: "Falta el perfil." }, { status: 400 });
  }
  if (!esRol(rol)) {
    return NextResponse.json({ mensaje: "Ese rol no existe." }, { status: 400 });
  }

  const supabase = clienteAdmin();
  const { data, error } = await supabase.rpc("cambiar_rol", {
    p_perfil_id: perfilId,
    p_rol_nuevo: rol,
    p_actor_user_id: actor.userId,
    p_motivo: typeof motivo === "string" ? motivo : null,
  });

  if (error) {
    // La base es la que decide. Sus mensajes están escritos para mostrarse.
    const permiso = error.code === "42501";
    console.error("cambiar_rol rechazó el cambio:", error.message);
    return NextResponse.json(
      { mensaje: error.message },
      { status: permiso ? 403 : 400 },
    );
  }

  return NextResponse.json({ ok: true, perfil: data }, { status: 200 });
}
