import { clientePublico } from "./supabase/publico";
import { clienteServidor } from "./supabase/servidor";
import { DIFICULTADES, type Catalogo, type Dificultad } from "./catalogo";

/**
 * Las consultas del catálogo. **Solo servidor**: importan clientes de Supabase,
 * y el de sesión usa `next/headers`.
 *
 * Los tipos y los helpers puros viven en `catalogo.ts`, que sí pueden importar
 * los componentes cliente.
 */

const CAMPOS_CURSO =
  "slug, nombre, publico, estilo, descripcion, cupos, dificultad, activo, orden";
const CAMPOS_PROFESORA =
  "slug, nombre, estilo, bio, instagram, foto_url, video_url, activa, orden";
const CAMPOS_SEDE = "slug, nombre, direccion, comuna, referencia, activa, orden";
// El join trae los slugs de las tres puntas en una sola vuelta.
const CAMPOS_HORARIO =
  "id, dia_semana, hora, cursos ( slug ), profesoras ( slug ), sedes ( slug )";

type FilaHorario = {
  id: string;
  dia_semana: number;
  hora: string;
  cursos: { slug: string } | null;
  profesoras: { slug: string } | null;
  sedes: { slug: string } | null;
};

function esDificultad(valor: unknown): valor is Dificultad {
  return DIFICULTADES.includes(valor as Dificultad);
}

/**
 * El catálogo no está: se corta el build a propósito.
 *
 * Publicar la landing sin cursos ni profesoras es peor que no publicar. Y como
 * el build depende de la base, conviene que el mensaje diga qué pasó: las dos
 * causas probables son que falte aplicar una migración, o que el proyecto de
 * Supabase esté pausado por inactividad, que en plan gratuito ocurre solo tras
 * ~1 semana (CONTEXT.md §11).
 */
function fallar(tabla: string, error: { message: string; code?: string }): never {
  const noExiste =
    error.code === "PGRST205" ||
    error.code === "42703" ||
    error.message.includes("schema cache");

  throw new Error(
    noExiste
      ? `No se pudo leer public.${tabla}: ${error.message}. Falta aplicar las ` +
        `migraciones de supabase/migrations/ con \`supabase db push\`.`
      : `No se pudo leer ${tabla}: ${error.message}. Si el proyecto de Supabase ` +
        `está pausado por inactividad, reanúdalo y vuelve a desplegar.`,
  );
}

type Filas = {
  cursos: { data: unknown; error: { message: string; code?: string } | null };
  profesoras: { data: unknown; error: { message: string; code?: string } | null };
  sedes: { data: unknown; error: { message: string; code?: string } | null };
  horarios: { data: unknown; error: { message: string; code?: string } | null };
};

function armar(filas: Filas, estricto: boolean): Catalogo {
  if (estricto) {
    if (filas.cursos.error) fallar("cursos", filas.cursos.error);
    if (filas.profesoras.error) fallar("profesoras", filas.profesoras.error);
    if (filas.sedes.error) fallar("sedes", filas.sedes.error);
    if (filas.horarios.error) fallar("horarios", filas.horarios.error);
  }

  return {
    cursos: ((filas.cursos.data ?? []) as Record<string, unknown>[]).map((f) => ({
      slug: f.slug as string,
      nombre: f.nombre as string,
      publico: f.publico as string,
      estilo: f.estilo as string,
      descripcion: f.descripcion as string,
      cupos: (f.cupos as number | null) ?? null,
      dificultad: esDificultad(f.dificultad) ? f.dificultad : "principiante",
      activo: f.activo as boolean,
    })),
    profesoras: ((filas.profesoras.data ?? []) as Record<string, unknown>[]).map(
      (f) => ({
        slug: f.slug as string,
        nombre: f.nombre as string,
        estilo: f.estilo as string,
        bio: (f.bio as string | null) ?? null,
        instagram: (f.instagram as string | null) ?? null,
        foto: (f.foto_url as string | null) ?? null,
        video: (f.video_url as string | null) ?? null,
        activa: f.activa as boolean,
      }),
    ),
    sedes: ((filas.sedes.data ?? []) as Record<string, unknown>[]).map((f) => ({
      slug: f.slug as string,
      nombre: f.nombre as string,
      direccion: f.direccion as string,
      comuna: f.comuna as string,
      referencia: (f.referencia as string | null) ?? null,
      activa: f.activa as boolean,
    })),
    // Un horario cuyo curso, profesora o sede no vino —porque RLS lo ocultó por
    // estar inactivo— se descarta: mostrarlo a medias sería peor que no
    // mostrarlo. Es el caso que el PRD deja anotado en §7.5.
    horarios: ((filas.horarios.data ?? []) as unknown as FilaHorario[])
      .filter((f) => f.cursos && f.profesoras && f.sedes)
      .map((f) => ({
        id: f.id,
        cursoSlug: f.cursos!.slug,
        profesoraSlug: f.profesoras!.slug,
        sedeSlug: f.sedes!.slug,
        diaSemana: f.dia_semana,
        // Postgres devuelve "20:00:00"; en pantalla sobra el segundo.
        hora: f.hora.slice(0, 5),
      })),
  };
}

/**
 * Lo que ve la visitante.
 *
 * Va con el cliente público, que **no toca cookies**: si usara el de sesión,
 * la landing saldría del prerender y dejaría de ser estática. RLS le entrega
 * solo lo activo, así que el filtro es del motor y no de la aplicación.
 */
export async function getCatalogoPublico(): Promise<Catalogo> {
  const supabase = clientePublico();

  const [cursos, profesoras, sedes, horarios] = await Promise.all([
    supabase.from("cursos").select(CAMPOS_CURSO).order("orden"),
    supabase.from("profesoras").select(CAMPOS_PROFESORA).order("orden"),
    supabase.from("sedes").select(CAMPOS_SEDE).order("orden"),
    supabase.from("horarios").select(CAMPOS_HORARIO).order("dia_semana"),
  ]);

  return armar({ cursos, profesoras, sedes, horarios }, true);
}

/**
 * El catálogo completo, inactivos incluidos. Lee con la sesión de quien mira,
 * así que solo devuelve todo si esa persona es admin o superior: es lo que
 * hace falta para mostrar un lead histórico que apunta a XO Kids sin huecos.
 */
export async function getCatalogoCompleto(): Promise<
  Catalogo & { error: string | null }
> {
  const supabase = await clienteServidor();

  const [cursos, profesoras, sedes, horarios] = await Promise.all([
    supabase.from("cursos").select(CAMPOS_CURSO).order("orden"),
    supabase.from("profesoras").select(CAMPOS_PROFESORA).order("orden"),
    supabase.from("sedes").select(CAMPOS_SEDE).order("orden"),
    supabase.from("horarios").select(CAMPOS_HORARIO).order("dia_semana"),
  ]);

  // No lanza como la pública —una página de admin a medias sigue sirviendo—
  // pero el error viaja para que se pueda mostrar en vez de parecer un
  // catálogo vacío. Mismo criterio que `Lectura<T>` en compras-consultas.
  const fallo =
    cursos.error ?? profesoras.error ?? sedes.error ?? horarios.error ?? null;
  if (fallo) console.error("Error leyendo el catálogo completo:", fallo);

  return {
    ...armar({ cursos, profesoras, sedes, horarios }, false),
    error: fallo ? `${fallo.message} (${fallo.code ?? "sin código"})` : null,
  };
}
