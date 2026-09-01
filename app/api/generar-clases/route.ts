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

  const { data, error } = await clienteAdmin().rpc("generar_clases", {
    p_dias: null,
  });

  if (error) {
    console.error("No se pudieron generar las clases:", error);
    return NextResponse.json({ mensaje: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, creadas: data ?? 0 });
}

// Vercel Cron dispara **GET**, no POST. El POST queda como alias para poder
// dispararlo a mano sin que un prefetch lo llame por accidente.
export const GET = generar;
export const POST = generar;
