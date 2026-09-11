import { NextResponse } from "next/server";
import { clienteAdmin } from "@/lib/supabase/admin";

/**
 * Materializa las clases de las próximas semanas desde los horarios.
 *
 * **Existe porque `pg_cron` está por confirmar.** Si está disponible en el plan
 * de Supabase, lo correcto es agendar `select public.generar_clases()` ahí: es
 * SQL puro, sin HTTP y sin un secreto que se pueda filtrar. Esta ruta es el
 * camino alternativo, con Vercel Cron y un secreto en cabecera, exactamente
 * como `/api/revalidar`.
 *
 * Sea cual sea el que se use, sobra que corra el otro: `generar_clases` es
 * idempotente por índice único.
 *
 * **Y de paso barre las reservas pendientes vencidas** (PRD-0018 §8.2). El cupo
 * de una especial se libera solo en `reservar_especial`, cuando alguien lo
 * necesita, así que el barrido no es lo que mantiene el cupo correcto: es lo que
 * evita que la bandeja de admin y las métricas muestren pendientes muertas.
 */
async function generar(request: Request) {
  const esperado = process.env.CRON_SECRETO?.trim();

  if (!esperado) {
    console.error("Falta CRON_SECRETO en el entorno.");
    return NextResponse.json({ mensaje: "No configurado." }, { status: 503 });
  }

  // Vercel Cron manda `authorization: Bearer <secreto>`; se acepta también una
  // cabecera propia, para poder dispararlo a mano.
  const cabecera =
    request.headers.get("x-cron-secreto") ??
    request.headers.get("authorization")?.replace(/^Bearer /, "") ??
    "";

  if (cabecera !== esperado) {
    return NextResponse.json({ mensaje: "No autorizado." }, { status: 401 });
  }

  const admin = clienteAdmin();

  const { data, error } = await admin.rpc("generar_clases", { p_dias: null });

  if (error) {
    console.error("No se pudieron generar las clases:", error);
    return NextResponse.json({ mensaje: error.message }, { status: 500 });
  }

  // El barrido va **después** y su fallo no tumba la generación, a propósito:
  // mientras la migración de PRD-0018 no esté aplicada, esta función no existe,
  // y el cron tiene que seguir creando clases igual. Una regla de orden que
  // alguien tiene que recordar es una regla que algún día no se recuerda.
  let expiradas: number | null = null;
  const barrido = await admin.rpc("expirar_reservas_pendientes", { p_clase_id: null });

  if (barrido.error) {
    console.error("No se pudo barrer las reservas vencidas:", barrido.error.message);
  } else {
    expiradas = typeof barrido.data === "number" ? barrido.data : 0;
  }

  return NextResponse.json({ ok: true, creadas: data ?? 0, expiradas });
}

// Vercel Cron dispara **GET**, no POST. El POST queda como alias para poder
// dispararlo a mano sin que un prefetch lo llame por accidente.
export const GET = generar;
export const POST = generar;
