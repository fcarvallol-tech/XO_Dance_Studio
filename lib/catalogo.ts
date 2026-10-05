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

export const DIFICULTADES = ["principiante", "intermedio", "avanzado"] as const;

export type Dificultad = (typeof DIFICULTADES)[number];

export type Sede = {
  slug: string;
  nombre: string;
  direccion: string;
  comuna: string;
  /** Cómo la ubica alguien de Santiago: "sector Los Leones". */
  referencia: string | null;
  activa: boolean;
};

/**
 * Una clase en la semana. Desde PRD-0016 es la única fuente de quién dicta
 * qué: reemplazó a `cursos.horario` y a la tabla `cursos_profesoras`.
 */
export type Horario = {
  id: string;
  cursoSlug: string;
  profesoraSlug: string;
  sedeSlug: string;
  /** ISO 8601: 1 = lunes … 7 = domingo. */
  diaSemana: number;
  /** `"20:00"`. Ya viene recortada a hora y minutos. */
  hora: string;
};

export type Profesora = {
  slug: string;
  nombre: string;
  estilo: string;
  bio: string | null;
  instagram: string | null;
  foto: string | null;
  video: string | null;
  activa: boolean;
};

export type Curso = {
  slug: string;
  nombre: string;
  publico: string;
  estilo: string;
  descripcion: string;
  cupos: number | null;
  dificultad: Dificultad;
  activo: boolean;
};

export type Catalogo = {
  cursos: Curso[];
  profesoras: Profesora[];
  sedes: Sede[];
  horarios: Horario[];
};

/** Lunes primero, como se lee un horario. Índice = número ISO. */
const DIAS = [
  "",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
];

export function nombreDia(dia: number): string {
  return DIAS[dia] ?? "";
}

/** "Lunes 17:00": el mismo, con el día en mayúscula inicial, para una lista. */
export function cuandoConMayuscula(horario: Horario): string {
  const texto = cuando(horario);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Las comunas donde una profesora dicta **de verdad**, sacadas de sus horarios.
 *
 * Antes la ficha mostraba la ubicación general de la academia —"Providencia y
 * Las Condes"— a todas, y eso podía mandar a una alumna a la comuna equivocada:
 * Pau solo dicta en Las Condes. Sin repetir, en el orden en que aparecen.
 */
export function comunasDeProfesora(
  horarios: Horario[],
  sedes: Sede[],
  slug: string,
): string[] {
  const comunas = horarios
    .filter((h) => h.profesoraSlug === slug)
    .map((h) => sedes.find((s) => s.slug === h.sedeSlug)?.comuna)
    .filter((c): c is string => Boolean(c));
  return [...new Set(comunas)];
}

/**
 * Qué enseña una profesora: los cursos que dicta, sacados de sus horarios.
 *
 * Reemplaza a `profesoras.estilo`, un texto suelto que nadie mantenía —en
 * staging decía "urbano teens" de profesoras que no dictan Teens— y que no se
 * actualizaba cuando cambiaba la parrilla. Si no tiene horarios, se usa ese
 * texto, que es lo único que hay.
 */
export function estiloDeProfesora(
  horarios: Horario[],
  cursos: { slug: string; nombre: string }[],
  profesora: { slug: string; estilo: string },
): string {
  const nombres = horarios
    .filter((h) => h.profesoraSlug === profesora.slug)
    .map((h) => cursos.find((c) => c.slug === h.cursoSlug)?.nombre)
    .filter((n): n is string => Boolean(n));
  return nombres.length > 0 ? [...new Set(nombres)].join(" · ") : profesora.estilo;
}

/** "lunes 17:00". Lo que se muestra en una tarjeta. */
export function cuando(horario: Horario): string {
  return `${nombreDia(horario.diaSemana)} ${horario.hora}`;
}

/** Ordena la semana: primero el día, después la hora. */
export function porDiaYHora(a: Horario, b: Horario): number {
  return a.diaSemana - b.diaSemana || a.hora.localeCompare(b.hora);
}

/** Busca por slug en una lista ya cargada. */
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

export function horariosDeCurso(horarios: Horario[], slug: string): Horario[] {
  return horarios.filter((h) => h.cursoSlug === slug).sort(porDiaYHora);
}

export function horariosDeProfesora(
  horarios: Horario[],
  slug: string,
): Horario[] {
  return horarios.filter((h) => h.profesoraSlug === slug).sort(porDiaYHora);
}

/**
 * Quién dicta un curso, derivado de los horarios.
 *
 * Antes esto era la tabla `cursos_profesoras`. Se eliminó en PRD-0016 porque no
 * tenía ningún hecho que `horarios` no tuviera, y dos fuentes para el mismo
 * dato se desincronizan. Un curso sin horarios queda sin profesoras a la vista,
 * y eso es correcto: un curso que nadie dicta no debería estar publicado.
 */
export function profesorasDeCurso(
  horarios: Horario[],
  profesoras: Profesora[],
  slug: string,
): Profesora[] {
  const slugs = new Set(
    horarios.filter((h) => h.cursoSlug === slug).map((h) => h.profesoraSlug),
  );
  return profesoras.filter((p) => slugs.has(p.slug));
}

/** Los cursos que dicta una profesora, derivado igual que el anterior. */
export function cursosDeProfesora(
  horarios: Horario[],
  cursos: Curso[],
  slug: string,
): Curso[] {
  const slugs = new Set(
    horarios.filter((h) => h.profesoraSlug === slug).map((h) => h.cursoSlug),
  );
  return cursos.filter((c) => slugs.has(c.slug));
}
