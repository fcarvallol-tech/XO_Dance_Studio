import { clientePublico } from "./supabase/publico";
import { clienteServidor } from "./supabase/servidor";
import type { Catalogo, Curso, Profesora } from "./catalogo";

/**
 * Las consultas del catálogo. **Solo servidor**: importan clientes de Supabase,
 * y el de sesión usa `next/headers`.
 *
 * Los tipos y los helpers puros viven en `catalogo.ts`, que sí pueden importar
 * los componentes cliente.
 */

// Lo que se pide en cada consulta. El join trae la relación en una sola vuelta.
const CAMPOS_CURSO =
  "slug, nombre, publico, estilo, descripcion, formato, horario, cupos, activo, orden, cursos_profesoras ( profesoras ( slug, activa ) )";
const CAMPOS_PROFESORA =
  "slug, nombre, estilo, bio, instagram, foto_url, video_url, activa, orden, cursos_profesoras ( cursos ( slug, activo ) )";

type FilaCurso = {
  slug: string;
  nombre: string;
  publico: string;
  estilo: string;
  descripcion: string;
  formato: string | null;
  horario: string | null;
  cupos: number | null;
  activo: boolean;
  cursos_profesoras: { profesoras: { slug: string; activa: boolean } | null }[];
};

type FilaProfesora = {
  slug: string;
  nombre: string;
  estilo: string;
  bio: string | null;
  instagram: string | null;
  foto_url: string | null;
  video_url: string | null;
  activa: boolean;
  cursos_profesoras: { cursos: { slug: string; activo: boolean } | null }[];
};

function aCurso(fila: FilaCurso, soloActivas: boolean): Curso {
  return {
    slug: fila.slug,
    nombre: fila.nombre,
    publico: fila.publico,
    estilo: fila.estilo,
    descripcion: fila.descripcion,
    formato: fila.formato,
    horario: fila.horario,
    cupos: fila.cupos,
    activo: fila.activo,
    profesoras: fila.cursos_profesoras
      .map((par) => par.profesoras)
      .filter((p) => p !== null && (!soloActivas || p.activa))
      .map((p) => p!.slug),
  };
}

function aProfesora(fila: FilaProfesora, soloActivos: boolean): Profesora {
  return {
    slug: fila.slug,
    nombre: fila.nombre,
    estilo: fila.estilo,
    bio: fila.bio,
    instagram: fila.instagram,
    foto: fila.foto_url,
    video: fila.video_url,
    activa: fila.activa,
    // Un curso fuera de catálogo no se nombra en la ficha de una profesora,
    // aunque la relación siga existiendo. Es el filtro que antes hacía
    // getCursoActivo.
    cursos: fila.cursos_profesoras
      .map((par) => par.cursos)
      .filter((c) => c !== null && (!soloActivos || c.activo))
      .map((c) => c!.slug),
  };
}

/**
 * El catálogo no está: se corta el build a propósito.
 *
 * Publicar la landing sin cursos ni profesoras es peor que no publicar. Y como
 * ahora el build depende de la base, conviene que el mensaje diga qué pasó: las
 * dos causas probables son que falte aplicar la migración, o que el proyecto de
 * Supabase esté pausado por inactividad, que en plan gratuito ocurre solo tras
 * ~1 semana (CONTEXT.md §11).
 */
function fallar(tabla: string, error: { message: string; code?: string }): never {
  const noExiste =
    error.code === "PGRST205" || error.message.includes("schema cache");

  throw new Error(
    noExiste
      ? `La tabla public.${tabla} no existe. Falta aplicar ` +
        `supabase/migrations/20260828120000_catalogo_en_base_de_datos.sql con ` +
        `\`supabase db push\`. Ver PRD-0015.`
      : `No se pudo leer ${tabla}: ${error.message}. Si el proyecto de Supabase ` +
        `está pausado por inactividad, reanúdalo y vuelve a desplegar.`,
  );
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

  const [cursos, profesoras] = await Promise.all([
    supabase.from("cursos").select(CAMPOS_CURSO).order("orden"),
    supabase.from("profesoras").select(CAMPOS_PROFESORA).order("orden"),
  ]);

  if (cursos.error) fallar("cursos", cursos.error);
  if (profesoras.error) fallar("profesoras", profesoras.error);

  return {
    cursos: (cursos.data as unknown as FilaCurso[]).map((f) => aCurso(f, true)),
    profesoras: (profesoras.data as unknown as FilaProfesora[]).map((f) =>
      aProfesora(f, true),
    ),
  };
}

/** Una profesora del sitio público. `null` si no existe o está inactiva. */
export async function getProfesoraPublica(
  slug: string,
): Promise<Profesora | null> {
  const supabase = clientePublico();

  const { data } = await supabase
    .from("profesoras")
    .select(CAMPOS_PROFESORA)
    .eq("slug", slug)
    .maybeSingle();

  return data ? aProfesora(data as unknown as FilaProfesora, true) : null;
}

/**
 * El catálogo completo, inactivos incluidos. Lee con la sesión de quien mira,
 * así que solo devuelve todo si esa persona es admin o superior: es lo que
 * hace falta para mostrar un lead histórico que apunta a XO Kids sin huecos.
 */
export async function getCatalogoCompleto(): Promise<Catalogo> {
  const supabase = await clienteServidor();

  const [cursos, profesoras] = await Promise.all([
    supabase.from("cursos").select(CAMPOS_CURSO).order("orden"),
    supabase.from("profesoras").select(CAMPOS_PROFESORA).order("orden"),
  ]);

  return {
    cursos: ((cursos.data ?? []) as unknown as FilaCurso[]).map((f) => aCurso(f, false)),
    profesoras: ((profesoras.data ?? []) as unknown as FilaProfesora[]).map((f) =>
      aProfesora(f, false),
    ),
  };
}
