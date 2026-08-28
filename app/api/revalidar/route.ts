import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Lo que hace que un cambio en el Table Editor se vea en segundos.
 *
 * La llama un Database Webhook de Supabase cuando cambia `cursos`,
 * `profesoras` o `cursos_profesoras`. No la llama una persona, así que no se
 * protege con sesión sino con un secreto compartido en cabecera.
 *
 * Sin esto el sitio igual se actualiza solo, por el `revalidate` de cada
 * página, pero puede tardar hasta una hora. Ver PRD-0015 §5.
 */
export async function POST(request: Request) {
  const esperado = process.env.REVALIDAR_SECRETO?.trim();

  // Sin secreto configurado la ruta queda cerrada, no abierta: un endpoint que
  // acepta a cualquiera porque falta una variable es peor que uno que no anda.
  if (!esperado) {
    console.error("Falta REVALIDAR_SECRETO en el entorno.");
    return NextResponse.json({ mensaje: "No configurado." }, { status: 503 });
  }

  if (request.headers.get("x-revalidar-secreto") !== esperado) {
    return NextResponse.json({ mensaje: "No autorizado." }, { status: 401 });
  }

  // El catálogo se usa en la landing y en cada perfil de profesora. Se
  // invalidan los dos: `revalidatePath` marca la ruta como vencida y la
  // siguiente visita la regenera. No hay regeneración ansiosa en App Router.
  revalidatePath("/");
  revalidatePath("/profesoras/[slug]", "page");

  return NextResponse.json({ ok: true, revalidado: ["/", "/profesoras/[slug]"] });
}
