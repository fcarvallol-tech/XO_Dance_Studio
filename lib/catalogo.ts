/**
 * El catálogo. Desde PRD-0015 vive en la base, no en el código.
 *
 * Los slugs (`"teens"`, `"drimy"`) siguen siendo la identidad pública: los
 * guardan `leads`, `perfiles` y las URLs, y son inmutables por trigger.
 *
 * **Este archivo no importa nada de servidor y es a propósito.** Lo usan
 * componentes cliente —Lineup, Formulario, CambiarRol— y si acá entrara el
 * cliente de Supabase con `next/headers`, se arrastraría al bundle del
 * navegador. Las consultas viven en `catalogo-consultas.ts`.
 */

export type Profesora = {
  slug: string;
  nombre: string;
  estilo: string;
  bio: string | null;
  instagram: string | null;
  foto: string | null;
  video: string | null;
  activa: boolean;
  /** Slugs de los cursos que dicta. Solo los activos en las consultas públicas. */
  cursos: string[];
};

export type Curso = {
  slug: string;
  nombre: string;
  publico: string;
  estilo: string;
  descripcion: string;
  formato: string | null;
  horario: string | null;
  cupos: number | null;
  activo: boolean;
  /** Slugs de las profesoras que lo dictan. */
  profesoras: string[];
};

export type Catalogo = { cursos: Curso[]; profesoras: Profesora[] };

/** Busca por slug en una lista ya cargada. Reemplaza a getCurso/getProfesora. */
export function porSlug<T extends { slug: string }>(
  lista: T[],
  slug: string | null | undefined,
): T | undefined {
  if (!slug) return undefined;
  return lista.find((item) => item.slug === slug);
}

/** El nombre, o el slug pelado si ya no está en el catálogo. */
export function nombreDe<T extends { slug: string; nombre: string }>(
  lista: T[],
  slug: string | null | undefined,
): string | null {
  if (!slug) return null;
  return porSlug(lista, slug)?.nombre ?? slug;
}

export function nombresDe(profesoras: Profesora[], slugs: string[]): string[] {
  return slugs
    .map((slug) => porSlug(profesoras, slug)?.nombre)
    .filter((nombre): nombre is string => Boolean(nombre));
}
