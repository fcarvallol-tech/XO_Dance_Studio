import { clienteAdmin } from "./supabase/admin";
import { clienteServidor } from "./supabase/servidor";
import { comoTexto, type Lectura } from "./compras-consultas";

/**
 * Lo que el portal de administración necesita de las clases especiales.
 *
 * Separado de `especiales-consultas.ts` a propósito: allá se sirve lo público
 * —publicadas, futuras, con URL firmada— y acá se ven **también los borradores
 * y las que ya pasaron**, que es justo lo que no debe salir por la puerta de
 * adelante.
 *
 * Se lee con la **sesión de quien mira**, no con la service role: si la
 * política de RLS estuviera mal, esto devuelve vacío en vez de entregarle los
 * borradores a cualquiera. Lo único que va con la service role es firmar la
 * portada, porque el bucket es privado.
 */

const BUCKET = "portadas-especiales";
const VIGENCIA_VISTA_PREVIA_S = 60 * 10;

export type EspecialAdmin = {
  id: string;
  slug: string | null;
  titulo: string;
  cancion: string | null;
  descripcion: string | null;
  inicio: string;
  fin: string | null;
  duracionMin: number | null;
  precioClp: number | null;
  cupoMaximo: number;
  minimoAlumnas: number | null;
  dificultad: string | null;
  reelCodigo: string | null;
  portadaUrl: string | null;
  tienePortada: boolean;
  publicada: boolean;
  estado: string;
  cursoId: string | null;
  profesoraId: string | null;
  sedeId: string | null;
  curso: string;
  profesora: string;
  sede: string;
  reservas: number;
};

type Fila = {
  id: string;
  slug: string | null;
  titulo: string | null;
  cancion: string | null;
  descripcion: string | null;
  inicio: string;
  fin: string | null;
  precio_clp: number | null;
  cupo_maximo: number;
  minimo_alumnas: number | null;
  dificultad: string | null;
  reel_codigo: string | null;
  portada_path: string | null;
  publicada_at: string | null;
  estado: string;
  curso_id: string | null;
  profesora_id: string | null;
  sede_id: string | null;
  cursos: { nombre: string } | null;
  profesoras: { nombre: string } | null;
  sedes: { nombre: string } | null;
};

const CAMPOS =
  "id, slug, titulo, cancion, descripcion, inicio, fin, precio_clp, cupo_maximo, " +
  "minimo_alumnas, dificultad, reel_codigo, portada_path, publicada_at, estado, " +
  "curso_id, profesora_id, sede_id, " +
  "cursos ( nombre ), profesoras ( nombre ), sedes ( nombre )";

async function firmar(ruta: string | null): Promise<string | null> {
  if (!ruta) return null;
  const { data, error } = await clienteAdmin()
    .storage.from(BUCKET)
    .createSignedUrl(ruta, VIGENCIA_VISTA_PREVIA_S);
  if (error) {
    console.error("No se pudo firmar la portada:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

function aEspecial(fila: Fila, portadaUrl: string | null, reservas = 0): EspecialAdmin {
  const fin = fila.fin ? new Date(fila.fin).getTime() : null;
  const inicio = new Date(fila.inicio).getTime();

  return {
    id: fila.id,
    slug: fila.slug,
    titulo: fila.titulo ?? "(sin título)",
    cancion: fila.cancion,
    descripcion: fila.descripcion,
    inicio: fila.inicio,
    fin: fila.fin,
    duracionMin: fin ? Math.round((fin - inicio) / 60000) : null,
    precioClp: fila.precio_clp,
    cupoMaximo: fila.cupo_maximo,
    minimoAlumnas: fila.minimo_alumnas,
    dificultad: fila.dificultad,
    reelCodigo: fila.reel_codigo,
    portadaUrl,
    tienePortada: Boolean(fila.portada_path),
    publicada: fila.publicada_at !== null,
    estado: fila.estado,
    cursoId: fila.curso_id,
    profesoraId: fila.profesora_id,
    sedeId: fila.sede_id,
    curso: fila.cursos?.nombre ?? "",
    profesora: fila.profesoras?.nombre ?? "",
    sede: fila.sedes?.nombre ?? "",
    reservas,
  };
}

/** Todas las especiales, borradores incluidos, la más próxima primero. */
export async function getEspecialesAdmin(): Promise<Lectura<EspecialAdmin[]>> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("clases")
    .select(CAMPOS)
    .eq("tipo", "especial")
    .order("inicio", { ascending: false });

  const filas = (data ?? []) as unknown as Fila[];
  return { datos: filas.map((f) => aEspecial(f, null)), error: comoTexto(error) };
}

/**
 * Una especial para editarla, con su portada firmada y **cuántas reservas
 * tiene**: el formulario avisa antes de mover la fecha (PRD-0018 §6).
 */
export async function getEspecialAdmin(id: string): Promise<Lectura<EspecialAdmin | null>> {
  const supabase = await clienteServidor();
  const { data, error } = await supabase
    .from("clases")
    .select(CAMPOS)
    .eq("id", id)
    .eq("tipo", "especial")
    .maybeSingle();

  if (error || !data) return { datos: null, error: comoTexto(error) };

  const fila = data as unknown as Fila;
  const admin = clienteAdmin();
  const [portadaUrl, conteo] = await Promise.all([
    firmar(fila.portada_path),
    admin.rpc("cupo_tomado", { p_clase_id: fila.id }),
  ]);

  return {
    datos: aEspecial(fila, portadaUrl, typeof conteo.data === "number" ? conteo.data : 0),
    error: null,
  };
}

export type OpcionesEspecial = {
  cursos: { id: string; nombre: string }[];
  profesoras: { id: string; nombre: string }[];
  sedes: { id: string; nombre: string; comuna: string }[];
  /** El valor con el que nace el formulario. `null` si nadie lo cargó. */
  precioDefault: number | null;
};

/**
 * Lo que el formulario ofrece elegir. **Teens no aparece**: las especiales son
 * para 15+ y la base también lo rechaza, así que no se ofrece algo que va a
 * fallar al guardar.
 */
export async function getOpcionesEspecial(): Promise<OpcionesEspecial> {
  const supabase = await clienteServidor();
  const [cursos, profesoras, sedes, parametro] = await Promise.all([
    supabase.from("cursos").select("id, nombre, slug").eq("activo", true).order("orden"),
    supabase.from("profesoras").select("id, nombre").eq("activa", true).order("orden"),
    supabase.from("sedes").select("id, nombre, comuna").eq("activa", true).order("orden"),
    supabase.from("parametros").select("valor").eq("clave", "especial_precio_default_clp").maybeSingle(),
  ]);

  const valor = Number(parametro.data?.valor);

  return {
    cursos: ((cursos.data ?? []) as { id: string; nombre: string; slug: string }[])
      .filter((c) => c.slug !== "teens")
      .map((c) => ({ id: c.id, nombre: c.nombre })),
    profesoras: (profesoras.data ?? []) as { id: string; nombre: string }[],
    sedes: (sedes.data ?? []) as { id: string; nombre: string; comuna: string }[],
    precioDefault: Number.isFinite(valor) ? valor : null,
  };
}
