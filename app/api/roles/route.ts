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
 * la academia no puede quedarse sin owner; y quien pasa a `profesora` queda
 * amarrada a una del catálogo.
 *
 * Desde PRD-0015 acá **no** se valida el slug de la profesora. Esa validación
 * existía solo porque el catálogo vivía en `lib/profesoras.ts` y no había
 * llave foránea; ahora la existencia la garantiza `perfiles_profesora_fk` y
 * que esté activa lo comprueba `cambiar_rol`. La regla vive en un solo lugar.
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

  const { perfilId, rol, motivo, profesoraId } = (cuerpo ?? {}) as {
    perfilId?: unknown;
    rol?: unknown;
    motivo?: unknown;
    profesoraId?: unknown;
  };

  if (typeof perfilId !== "string" || !perfilId) {
    return NextResponse.json({ mensaje: "Falta el perfil." }, { status: 400 });
  }
  if (!esRol(rol)) {
    return NextResponse.json({ mensaje: "Ese rol no existe." }, { status: 400 });
  }

  // Que venga *algo* sí se comprueba acá, para responder algo entendible en vez
  // de dejar que la base levante una excepción por un campo vacío.
  if (rol === "profesora" && !String(profesoraId ?? "").trim()) {
    return NextResponse.json(
      { mensaje: "Elige a qué profesora del catálogo corresponde." },
      { status: 400 },
    );
  }

  const supabase = clienteAdmin();
  const { data, error } = await supabase.rpc("cambiar_rol", {
    p_perfil_id: perfilId,
    p_rol_nuevo: rol,
    p_actor_user_id: actor.userId,
    p_motivo: typeof motivo === "string" ? motivo : null,
    // Para cualquier otro rol viaja nulo y la base limpia la columna.
    p_profesora_id: rol === "profesora" ? String(profesoraId) : null,
  });

  if (error) {
    // La base es la que decide. Sus mensajes están escritos para mostrarse.
    // 23503 lo levanta la llave foránea o el chequeo de profesora activa.
    const permiso = error.code === "42501";
    console.error("cambiar_rol rechazó el cambio:", error.message);
    return NextResponse.json(
      { mensaje: error.message },
      { status: permiso ? 403 : 400 },
    );
  }

  return NextResponse.json({ ok: true, perfil: data }, { status: 200 });
}
