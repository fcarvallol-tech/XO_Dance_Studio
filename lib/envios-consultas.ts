import { clienteServidor } from "./supabase/servidor";
import { comoTexto, type Lectura } from "./compras-consultas";
import type { EnvioFallido } from "./envios";

/**
 * Los correos que no salieron. **Solo servidor.**
 *
 * Se lee con la **sesión de quien mira**, no con la service role: la política
 * de `envios_correo` deja pasar solo a admin, así que si estuviera mal esto
 * devuelve vacío en vez de entregarle a cualquiera los correos y los nombres de
 * las alumnas.
 *
 * Esta pantalla existe por una razón concreta: el cron es el único que
 * reintenta, y **el cron de este proyecto ya se cayó una vez semanas sin que
 * nadie se enterara** (PRD-0018 §14). Si eso vuelve a pasar, los envíos se
 * acumulan acá y se ven, en vez de desaparecer como antes.
 */

type Fila = {
  id: string;
  plantilla: string;
  destinatario: string | null;
  estado: string;
  intentos: number;
  ultimo_error: string | null;
  motivo_descarte: string | null;
  created_at: string;
  proximo_intento_at: string | null;
  caduca_at: string | null;
};

const CAMPOS =
  "id, plantilla, destinatario, estado, intentos, ultimo_error, motivo_descarte, " +
  "created_at, proximo_intento_at, caduca_at";

const aEnvio = (f: Fila): EnvioFallido => ({
  id: f.id,
  plantilla: f.plantilla,
  destinatario: f.destinatario,
  estado: f.estado,
  intentos: f.intentos,
  ultimoError: f.ultimo_error,
  motivoDescarte: f.motivo_descarte,
  creadoAt: f.created_at,
  proximoIntentoAt: f.proximo_intento_at,
  caducaAt: f.caduca_at,
});

/** Los que todavía pueden salir: fallidos, esperando su próximo intento. */
export async function getEnviosFallidos(): Promise<Lectura<EnvioFallido[]>> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("envios_correo")
    .select(CAMPOS)
    .eq("estado", "fallido")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  return {
    datos: ((data ?? []) as unknown as Fila[]).map(aEnvio),
    error: comoTexto(error),
  };
}

/**
 * Los que ya no se van a mandar. Van en su propia lista **a propósito**: acá no
 * hay nada que reintentar, hay que hablarle a esa persona por otro lado.
 */
export async function getEnviosDescartados(): Promise<Lectura<EnvioFallido[]>> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("envios_correo")
    .select(CAMPOS)
    .eq("estado", "descartado")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  return {
    datos: ((data ?? []) as unknown as Fila[]).map(aEnvio),
    error: comoTexto(error),
  };
}

/**
 * Cuántos hay fallidos, para el menú. Es una llamada más por página de admin, y
 * se paga a propósito: un contador al lado del enlace es lo que hace que
 * alguien entre. Una sección que hay que acordarse de visitar no se visita.
 */
export async function contarEnviosFallidos(): Promise<number> {
  const supabase = await clienteServidor();
  const { count, error } = await supabase
    .from("envios_correo")
    .select("id", { count: "exact", head: true })
    .eq("estado", "fallido")
    .is("deleted_at", null);

  if (error) {
    console.error("No se pudo contar los correos fallidos:", error.message);
    return 0;
  }
  return count ?? 0;
}
