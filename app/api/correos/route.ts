import { NextResponse } from "next/server";
import { clienteAdmin } from "@/lib/supabase/admin";
import { reintentarEnvioRegistrado } from "@/lib/correo";
import { caduco, debeReintentar } from "@/lib/dominio/envios";

/**
 * El barrido de correo: reintenta lo que falló, descarta lo que ya no es cierto
 * y purga el contenido viejo (PRD-0019 fases 5 y §3.7).
 *
 * **Hoy corre una vez al día**, porque el plan de Vercel permite un cron diario
 * y Vercel Pro se paga antes de publicar la primera clase especial, no ahora
 * (decisión de Felipe, 22/09/2026). Subir a cada cinco minutos es **solo
 * cambiar el `schedule` en `vercel.json`**: cada envío guarda la hora real de su
 * próximo intento y acá se toma todo lo que ya venció, así que una pasada más
 * frecuente simplemente los encuentra antes. No hay nada que tocar en el código.
 *
 * Si algún día el plan no admitiera dos crons, esto se llama desde
 * `/api/generar-clases` y la lógica no cambia: por eso vive en una ruta propia
 * y no dentro de aquella.
 *
 * Mismo patrón de secreto en cabecera que `/api/generar-clases` y
 * `/api/revalidar`: no la llama una persona.
 */

/** Lo que devuelve la base, traducido a lo que entiende lib/dominio. */
type Fila = {
  id: string;
  plantilla: string;
  destinatario: string | null;
  datos: Record<string, unknown> | null;
  estado: string;
  intentos: number;
  proximo_intento_at: string | null;
  caduca_at: string | null;
  created_at: string;
  enviado_at: string | null;
  purgado_at: string | null;
};

const aDominio = (f: Fila) => ({
  estado: f.estado as "pendiente" | "enviado" | "fallido" | "descartado",
  intentos: f.intentos,
  proximoIntentoAt: f.proximo_intento_at ? new Date(f.proximo_intento_at) : null,
  caducaAt: f.caduca_at ? new Date(f.caduca_at) : null,
  creadoAt: new Date(f.created_at),
  enviadoAt: f.enviado_at ? new Date(f.enviado_at) : null,
  tieneContenido: f.purgado_at === null,
});

async function barrer(request: Request) {
  const esperado = process.env.CRON_SECRETO?.trim();

  if (!esperado) {
    console.error("Falta CRON_SECRETO en el entorno.");
    return NextResponse.json({ mensaje: "No configurado." }, { status: 503 });
  }

  const cabecera =
    request.headers.get("x-cron-secreto") ??
    request.headers.get("authorization")?.replace(/^Bearer /, "") ??
    "";

  if (cabecera !== esperado) {
    return NextResponse.json({ mensaje: "No autorizado." }, { status: 401 });
  }

  const admin = clienteAdmin();
  const { data, error } = await admin.rpc("envios_por_intentar", { p_limite: 200 });

  if (error) {
    console.error("No se pudo leer la cola de correo:", error.message);
    return NextResponse.json({ mensaje: error.message }, { status: 500 });
  }

  const ahora = new Date();
  const filas = (data ?? []) as Fila[];
  let descartados = 0;
  let reintentados = 0;
  let salieron = 0;

  for (const fila of filas) {
    const envio = aDominio(fila);

    // Caducado gana sobre fallido: un aviso con plazo que llega tarde manda a
    // transferir por un cupo que ya se soltó. Se descarta con motivo y queda a
    // la vista en el portal, porque a esa persona hay que hablarle por otro lado.
    if (caduco(envio, ahora)) {
      await admin.rpc("descartar_envio", {
        p_id: fila.id,
        p_motivo: "El aviso caducó antes de poder mandarlo",
      });
      descartados++;
      continue;
    }

    if (!debeReintentar(envio, ahora)) continue;

    reintentados++;
    if (await reintentarEnvioRegistrado(fila)) salieron++;
  }

  // La purga va en la misma pasada: es barata y no tiene sentido darle su
  // propio cron.
  const purga = await admin.rpc("purgar_envios_viejos", { p_dias: 30 });
  if (purga.error) console.error("No se pudo purgar:", purga.error.message);

  return NextResponse.json({
    ok: true,
    mirados: filas.length,
    descartados,
    reintentados,
    salieron,
    purgados: typeof purga.data === "number" ? purga.data : null,
  });
}

// Vercel Cron dispara GET. El POST queda para poder llamarlo a mano.
export const GET = barrer;
export const POST = barrer;
