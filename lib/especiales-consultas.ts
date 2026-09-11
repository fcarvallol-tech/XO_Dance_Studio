import { clienteAdmin } from "./supabase/admin";
import { clientePublico } from "./supabase/publico";
import { desdePrecio } from "./dominio/especiales";

/**
 * Las clases especiales que ve cualquiera. **Solo servidor.**
 *
 * DOS CLIENTES, Y CADA UNO POR UNA RAZÓN
 *
 * - La ficha se lee con el **cliente público** (rol `anon`, sin cookies): así
 *   estas páginas se siguen prerenderizando, y RLS decide qué es visible. La
 *   política deja pasar la parrilla y las especiales publicadas, nada más.
 * - La **consulta filtra igual** —publicada, programada, futura—, aunque RLS ya
 *   lo haga. Confiar solo en RLS deja el sistema a merced de haber razonado
 *   bien sobre la composición de políticas, que en este proyecto ya falló una
 *   vez (PRD-0008 §12). Van las dos.
 * - La **portada** y el **conteo de cupos** van con la service role: el bucket
 *   es privado (PRD-0018 §7.6) y `cupo_tomado` no se le concede a `anon` a
 *   propósito. Lo que sale de acá es una URL firmada y un número, nunca quién
 *   reservó.
 *
 * CUÁNTAS LLAMADAS
 *
 * La lista son dos: un select y una firma en lote para todas las portadas. La
 * página propia son tres: select, firma y el conteo de cupo. Cada una es una
 * ida y vuelta HTTP que se cuenta de a una.
 *
 * SI LA MIGRACIÓN NO ESTÁ APLICADA, ESTO FALLA FUERTE Y CLARO
 *
 * A propósito, y es la misma decisión que tomó PRD-0017 con `planes`: una
 * lectura que se cae y se ve como "no hay clases especiales" no se distingue
 * del caso normal, así que nadie la reporta (PRD-0017 §17).
 */

const BUCKET = "portadas-especiales";
/** 30 días: más de lo que una especial pasa publicada, y la página se revalida antes. */
const VIGENCIA_PORTADA_S = 60 * 60 * 24 * 30;

export type EspecialPublica = {
  slug: string;
  titulo: string;
  cancion: string | null;
  descripcion: string | null;
  /** ISO en UTC. Se renderiza en `America/Santiago`. */
  inicio: string;
  fin: string | null;
  precioClp: number;
  dificultad: string | null;
  cupoMaximo: number;
  /** Solo el código: la URL del embed se arma con `urlDeEmbed`, y recién al tocar. */
  reelCodigo: string | null;
  /** URL firmada, o `null` si no se pudo firmar. Nunca la ruta cruda del bucket. */
  portadaUrl: string | null;
  curso: string;
  profesora: string;
  profesoraSlug: string;
  sede: string;
  direccion: string;
  comuna: string;
};

type Fila = {
  slug: string | null;
  titulo: string | null;
  cancion: string | null;
  descripcion: string | null;
  inicio: string;
  fin: string | null;
  precio_clp: number | null;
  dificultad: string | null;
  cupo_maximo: number;
  reel_codigo: string | null;
  portada_path: string | null;
  publicada_at: string | null;
  estado: string;
  cursos: { nombre: string } | null;
  profesoras: { nombre: string; slug: string } | null;
  sedes: { nombre: string; direccion: string; comuna: string } | null;
};

const COLUMNAS =
  "slug, titulo, cancion, descripcion, inicio, fin, precio_clp, dificultad, " +
  "cupo_maximo, reel_codigo, portada_path, publicada_at, estado, " +
  "cursos ( nombre ), profesoras ( nombre, slug ), sedes ( nombre, direccion, comuna )";

async function leerEspeciales(filtro?: { slug: string }): Promise<Fila[]> {
  const supabase = clientePublico();

  let consulta = supabase
    .from("clases")
    .select(COLUMNAS)
    .eq("tipo", "especial")
    .eq("estado", "programada")
    .not("publicada_at", "is", null)
    .gt("inicio", new Date().toISOString())
    .order("inicio");

  if (filtro) consulta = consulta.eq("slug", filtro.slug);

  const { data, error } = await consulta;

  if (error) {
    throw new Error(
      `No se pudo leer las clases especiales: ${error.message}. Si habla de una ` +
        "columna que no existe, falta aplicar " +
        "supabase/migrations/20260910120000_clases_especiales.sql con `supabase db push`.",
    );
  }

  return (data ?? []) as unknown as Fila[];
}

/**
 * Firma las portadas en una sola llamada. Una portada que no se pueda firmar
 * deja la ficha en pie sin imagen: no se cae la página por una foto.
 */
async function firmarPortadas(rutas: string[]): Promise<Map<string, string>> {
  const firmadas = new Map<string, string>();
  if (rutas.length === 0) return firmadas;

  const { data, error } = await clienteAdmin()
    .storage.from(BUCKET)
    .createSignedUrls(rutas, VIGENCIA_PORTADA_S);

  if (error) {
    console.error("No se pudieron firmar las portadas:", error.message);
    return firmadas;
  }

  for (const item of data ?? []) {
    if (item.signedUrl && item.path) firmadas.set(item.path, item.signedUrl);
  }
  return firmadas;
}

function aPublica(fila: Fila, portadaUrl: string | null): EspecialPublica {
  return {
    slug: fila.slug ?? "",
    titulo: fila.titulo ?? "Clase especial",
    cancion: fila.cancion,
    descripcion: fila.descripcion,
    inicio: fila.inicio,
    fin: fila.fin,
    precioClp: fila.precio_clp ?? 0,
    dificultad: fila.dificultad,
    cupoMaximo: fila.cupo_maximo,
    reelCodigo: fila.reel_codigo,
    portadaUrl,
    curso: fila.cursos?.nombre ?? "",
    profesora: fila.profesoras?.nombre ?? "",
    profesoraSlug: fila.profesoras?.slug ?? "",
    sede: fila.sedes?.nombre ?? "",
    direccion: fila.sedes?.direccion ?? "",
    comuna: fila.sedes?.comuna ?? "",
  };
}

/** Las publicadas que todavía no pasan, en orden de fecha (PRD-0018 §3.6). */
export async function getEspecialesPublicadas(): Promise<EspecialPublica[]> {
  const filas = await leerEspeciales();
  const firmadas = await firmarPortadas(
    filas.map((f) => f.portada_path).filter((p): p is string => Boolean(p)),
  );
  return filas.map((f) =>
    aPublica(f, f.portada_path ? (firmadas.get(f.portada_path) ?? null) : null),
  );
}

export type EspecialConCupo = {
  especial: EspecialPublica;
  /** Cupos que quedan, contando las pendientes de pago vigentes. */
  lugaresLibres: number;
};

/** Una especial por su slug, con cuántos lugares quedan. `null` si no existe. */
export async function getEspecialPorSlug(slug: string): Promise<EspecialConCupo | null> {
  const filas = await leerEspeciales({ slug });
  const fila = filas[0];
  if (!fila) return null;

  const [firmadas, tomados] = await Promise.all([
    firmarPortadas(fila.portada_path ? [fila.portada_path] : []),
    cupoTomadoEnBase(slug),
  ]);

  return {
    especial: aPublica(
      fila,
      fila.portada_path ? (firmadas.get(fila.portada_path) ?? null) : null,
    ),
    lugaresLibres: Math.max(0, fila.cupo_maximo - tomados),
  };
}

/**
 * El conteo lo hace la base con `cupo_tomado()`, no la aplicación: es la misma
 * función que usan `reservar` y `reservar_especial`, y replicarla acá sería el
 * sexto lugar donde el cupo se cuenta distinto (PRD-0018 §7.3).
 */
async function cupoTomadoEnBase(slug: string): Promise<number> {
  const admin = clienteAdmin();

  const { data: clase, error: errorClase } = await admin
    .from("clases")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (errorClase || !clase) {
    if (errorClase) console.error("No se pudo ubicar la clase:", errorClase.message);
    return 0;
  }

  const { data, error } = await admin.rpc("cupo_tomado", { p_clase_id: clase.id });
  if (error) {
    console.error("No se pudo contar el cupo:", error.message);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

/**
 * El "desde $X" de la fila de Planes. `null` cuando no hay ninguna publicada
 * futura, y entonces la fila no aparece (PRD-0018 §3.8).
 *
 * Decide `desdePrecio()` de `lib/dominio`, que tiene tests, aunque la consulta
 * ya haya filtrado: el mínimo es una regla de negocio, no un `order by`.
 */
export async function getDesdePrecioEspecial(): Promise<number | null> {
  const filas = await leerEspeciales();
  return desdePrecio(
    filas.map((f) => ({
      precioClp: f.precio_clp ?? 0,
      inicio: new Date(f.inicio),
      publicadaAt: f.publicada_at ? new Date(f.publicada_at) : null,
      cancelada: f.estado === "cancelada",
    })),
    new Date(),
  );
}

/**
 * La portada en crudo, para la imagen de Open Graph.
 *
 * `opengraph-image.tsx` la compone con satori en el servidor, así que **no
 * usa URL**: descarga el objeto con la service role y lo incrusta como data
 * URI. Una URL firmada dentro de una imagen cacheada vencería sin que nadie se
 * entere (PRD-0018 §7.6).
 *
 * La ruta del bucket no sale de este módulo: entra un slug, sale una imagen.
 */
export async function getPortadaComoDataUri(slug: string): Promise<string | null> {
  const admin = clienteAdmin();

  const { data: clase, error } = await admin
    .from("clases")
    .select("portada_path")
    .eq("slug", slug)
    .maybeSingle();

  const ruta = (clase as { portada_path: string | null } | null)?.portada_path;
  if (error || !ruta) return null;

  const { data, error: errorDescarga } = await admin.storage.from(BUCKET).download(ruta);
  if (errorDescarga || !data) {
    console.error("No se pudo descargar la portada:", errorDescarga?.message);
    return null;
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const tipo = data.type || (ruta.endsWith(".webp") ? "image/webp" : "image/jpeg");
  return `data:${tipo};base64,${buffer.toString("base64")}`;
}
