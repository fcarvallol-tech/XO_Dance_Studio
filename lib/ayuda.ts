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
 * Las que llevan `porConfirmar` son datos que **no están en ninguna parte del
 * proyecto** y que no se inventan: ropa, cómo llegar, y si se puede ir a mirar.
 * Se muestran marcadas en pantalla, no escondidas en un comentario, porque un
 * texto provisional que no se ve como tal es un texto que se publica sin que
 * nadie lo decida.
 */

export type Pregunta = {
  pregunta: string;
  respuesta: string;
  /** Lo tiene que completar Felipe. Se muestra marcado. */
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
          "salas. Tienes 60 días para ocuparlas desde que te las acreditamos.",
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
          "Las clases de la parrilla son de 15 años en adelante. XO Teens es el curso para " +
          "11 a 15, con su propio horario.",
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
          "En tres salas: Seducción Latina Experience y EB Dance Studio en Providencia, y el " +
          "Centro Comunitario Diaguitas en Las Condes. Las direcciones están en Nosotros, y " +
          "cada clase del calendario dice en cuál es.",
      },
      {
        pregunta: "¿Qué llevo a la clase?",
        respuesta:
          "PENDIENTE: ropa cómoda, qué calzado, si conviene llevar agua, si hay camarines " +
          "para cambiarse.",
        porConfirmar: true,
      },
      {
        pregunta: "¿Cómo llego? ¿Hay estacionamiento?",
        respuesta:
          "PENDIENTE: metro o micro más cercanos a cada sala, y si hay dónde estacionar.",
        porConfirmar: true,
      },
      {
        pregunta: "¿Puedo ir a mirar una clase antes de inscribirme?",
        respuesta: "PENDIENTE: si se puede, con quién se coordina y con cuánta anticipación.",
        porConfirmar: true,
      },
    ],
  },
];

/** Cuántas están sin completar. La página lo dice arriba si hay alguna. */
export function pendientes(): number {
  return PREGUNTAS.flatMap((b) => b.preguntas).filter((p) => p.porConfirmar).length;
}
