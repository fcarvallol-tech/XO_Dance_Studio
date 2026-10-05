import { enumerar, type Sede } from "./catalogo.ts";

/**
 * Las preguntas frecuentes.
 *
 * **En el código y no en la base** a propósito (PRD-0022 §7): son una docena de
 * textos que cambian dos veces al año, y una tabla para eso es infraestructura
 * que hay que mantener —con su RLS, su revalidación y su pantalla de edición—
 * sin nada a cambio. Si algún día se quieren editar desde el Table Editor, se
 * mueven; pero entonces hay que resolver también la revalidación, y hoy el
 * webhook que la dispara **ni siquiera existe** (`ARCHITECTURE.md` §10).
 *
 * Las respuestas las confirmó Felipe el 29/09/2026. `porConfirmar` sigue
 * existiendo en el tipo —no cuesta nada y el día que se agregue una pregunta sin
 * respuesta definitiva hay dónde marcarla— pero hoy no la usa ninguna.
 */

export type Pregunta = {
  pregunta: string;
  respuesta: string;
  /** Un enlace que acompaña la respuesta, cuando decirlo con palabras no basta. */
  enlace?: { texto: string; url: string };
  /** Para una pregunta cuya respuesta todavía no está decidida. Se ve marcada. */
  porConfirmar?: boolean;
};

export type BloqueDePreguntas = { titulo: string; preguntas: Pregunta[] };

export const PREGUNTAS: BloqueDePreguntas[] = [
  {
    titulo: "Cómo funcionan las clases",
    preguntas: [
      {
        pregunta: "¿Cómo funcionan los packs?",
        respuesta:
          "Compras clases, no un mes. Un pack de 4 son cuatro clases que usas cuando quieras, " +
          "en cualquier horario de la parrilla, con cualquier profe y en cualquiera de las " +
          "salas. {vigencia}",
      },
      {
        pregunta: "¿Tengo que venir siempre el mismo día?",
        respuesta:
          "No. Puedes gastar las cuatro clases de un pack en la misma semana yendo a una de " +
          "cada profe, o una por semana durante un mes. Reservas la que te acomode, cuando te " +
          "acomode.",
      },
      {
        pregunta: "¿Necesito experiencia para empezar?",
        respuesta:
          "No. Los cursos de la parrilla son de nivel principiante, y están pensados para que " +
          "alguien que nunca bailó pueda llegar y seguir la clase.",
      },
      {
        pregunta: "¿Desde qué edad se puede?",
        respuesta:
          "Desde los 15 años. Todos los cursos que dictamos hoy son para esa edad en adelante.",
      },
      {
        pregunta: "¿Cuánto dura una clase?",
        respuesta:
          "Una hora las de la parrilla. Las clases especiales lo dicen en su página, porque " +
          "algunas duran más.",
      },
    ],
  },
  {
    titulo: "Pagar y reservar",
    preguntas: [
      {
        pregunta: "¿Cómo pago?",
        respuesta:
          "Por transferencia. Eliges el pack, te mostramos los datos de la cuenta y nos avisas " +
          "cuando hayas transferido. Cuando confirmamos el abono te acreditamos las clases y " +
          "ya puedes reservar. Te llega un correo cuando estén listas.",
      },
      {
        pregunta: "¿Qué pasa si no puedo ir a una clase que reservé?",
        respuesta:
          "Puedes cancelar hasta 30 minutos antes y recuperas la clase para usarla en otra. " +
          "Si cancelas después, la clase se consume igual. Y si la clase la cancelamos " +
          "nosotras, te la devolvemos siempre, sin importar cuándo.",
      },
      {
        pregunta: "¿Qué son las clases especiales?",
        respuesta:
          "Una coreografía completa, en una fecha puntual, fuera del horario de siempre. " +
          "Tienen su propio precio y se pagan aparte: no usan las clases de tu pack.",
      },
    ],
  },
  {
    titulo: "Antes de venir",
    preguntas: [
      {
        pregunta: "¿Dónde son las clases?",
        respuesta:
          "{sedes} Las direcciones están en Nosotros, y cada clase del calendario dice en " +
          "cuál es.",
      },
      {
        pregunta: "¿Qué llevo a la clase?",
        respuesta:
          "Ropa cómoda con la que puedas moverte y zapatillas deportivas. Si tienes " +
          "rodilleras acolchadas, tráelas: en algunos estilos se agradecen, pero no son " +
          "obligatorias. Y trae agua.",
      },
      {
        pregunta: "¿Cómo llego?",
        respuesta:
          "Las salas están cerca del metro. El Centro Comunitario Diaguitas, en Las Condes, " +
          "tiene un video que muestra cómo llegar. Seducción Latina queda en Av. Nueva " +
          "Providencia 2260, local 130, piso 3, en el sector Los Leones.",
        // El video vive acá y no dentro del texto: así el componente lo puede
        // mostrar como enlace sin que haya que parsear la respuesta.
        enlace: {
          texto: "Ver cómo llegar a Diaguitas",
          url: "https://www.instagram.com/reel/Dcw4N64g9fi/",
        },
      },
    ],
  },
];

/** Cuántas están sin completar. La página lo dice arriba si hay alguna. */
export function pendientes(): number {
  return PREGUNTAS.flatMap((b) => b.preguntas).filter((p) => p.porConfirmar).length;
}

/**
 * La frase de la vigencia, con los días que dice la base (`planes.vigencia_dias`).
 * Estaba escrita a mano —"60 días"— y se habría quedado mintiendo cuando la
 * vigencia pasó a 45 (05/10/2026). Sin el dato, la frase se omite: nunca un
 * número inventado.
 */
/**
 * Dónde son las clases, desde la tabla `sedes`. Antes estaban escritas a mano
 * —"en tres salas"— y quedaron viejas el día que llegó Studio 98 (05/10/2026).
 * Agrupadas por comuna, en el orden de la tabla.
 */
export function conSedes(respuesta: string, sedes: Pick<Sede, "nombre" | "comuna">[]): string {
  const comunas = new Map<string, string[]>();
  for (const s of sedes) comunas.set(s.comuna, [...(comunas.get(s.comuna) ?? []), s.nombre]);
  const frase = [...comunas].map(([comuna, nombres]) => `En ${comuna}: ${enumerar(nombres)}.`).join(" ");
  return respuesta.replace("{sedes}", frase).trim();
}

export function conVigencia(respuesta: string, dias: number | null): string {
  const frase = dias ? `Tienes ${dias} días para ocuparlas desde que te las acreditamos.` : "";
  return respuesta.replace("{vigencia}", frase).trim();
}
