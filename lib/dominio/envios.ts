/**
 * Reglas puras del correo transaccional (PRD-0019): cuándo se reintenta, cuándo
 * un aviso dejó de ser cierto, y cuándo se le borra el contenido a una fila.
 *
 * Acá no se manda nada ni se toca la base. El reparto es el de siempre: la base
 * guarda y bloquea, `lib/correo.ts` habla con Resend, y estos contratos —que
 * tienen tests— deciden.
 *
 * ---
 *
 * **EL BACKOFF ES POR TIEMPO, NO POR PASADA DEL CRON.** Es la decisión de
 * Felipe del 22/09/2026 escrita como código: hoy el barrido corre **una vez al
 * día** porque el plan de Vercel solo permite un cron diario, así que un envío
 * que falla se reintenta al otro día aunque su próximo intento dijera "en cinco
 * minutos".
 *
 * Lo que hace que subir de plan sea **solo editar `vercel.json`**: cada envío
 * guarda su `proximo_intento_at` calculado en tiempo real, y el barrido toma
 * todo lo que ya venció. Con un cron diario, las esperas cortas quedan
 * absorbidas por la espera hasta la próxima pasada; con `*\/5 * * * *`, las
 * mismas filas se toman a los cinco minutos, con las mismas esperas y sin
 * cambiar una línea de acá.
 *
 * Consecuencia que hay que tener clara mientras el cron sea diario: un aviso
 * que caduca en 24 h —el del cupo tomado— alcanza **un** reintento antes de que
 * se lo descarte. Por eso el texto en pantalla no promete que el correo llegue
 * pronto, solo que la reserva está hecha.
 */

export type EstadoEnvio = "pendiente" | "enviado" | "fallido" | "descartado";

/** Una por cada función de `lib/correo.ts`. */
export type Plantilla =
  | "transferenciaDeclarada"
  | "compraAprobada"
  | "compraRechazada"
  | "reserva"
  | "especialPendiente"
  | "especialConfirmada";

export type Envio = {
  estado: EstadoEnvio;
  /** Cuántas veces se intentó mandar. 0 = encolado y nunca intentado. */
  intentos: number;
  proximoIntentoAt: Date | null;
  /** Desde cuándo este aviso ya no es cierto. `null` = no caduca. */
  caducaAt: Date | null;
  creadoAt: Date;
  enviadoAt: Date | null;
  /** Si todavía guarda destinatario y cuerpo, o ya se purgó. */
  tieneContenido: boolean;
};

/** Las esperas del PRD §8.4, entre un intento y el siguiente. */
const ESPERAS_MINUTOS = [5, 30, 120, 720, 1440];

/** Cinco reintentos después del envío inicial: seis intentos en total. */
export const MAXIMO_REINTENTOS = ESPERAS_MINUTOS.length;

/**
 * Un `pendiente` más viejo que esto es un envío colgado: el proceso se murió
 * entre el insert y la llamada a Resend, y nadie lo marcó nunca.
 */
const MINUTOS_PENDIENTE_COLGADO = 15;

/** Lo que dura el contenido de un envío entregado antes de purgarse (§3.7). */
const DIAS_RETENCION = 30;

const MINUTO = 60 * 1000;
const sumarMinutos = (fecha: Date, minutos: number) =>
  new Date(fecha.getTime() + minutos * MINUTO);

/**
 * Cuándo toca el siguiente intento. `null` cuando ya se agotaron: un reintento
 * infinito contra un correo que no existe es ruido, y a esa altura lo que hace
 * falta es que una persona lo vea en el portal.
 */
export function proximoIntento(intentos: number, ahora: Date): Date | null {
  if (intentos <= 0) return ahora;
  if (intentos > MAXIMO_REINTENTOS) return null;
  return sumarMinutos(ahora, ESPERAS_MINUTOS[intentos - 1]);
}

export type ContextoDeCaducidad = {
  /** De la reserva pendiente de pago: hasta cuándo se le guarda el cupo. */
  expiraAt: Date | null;
  inicioClase: Date | null;
  encoladoAt: Date;
};

/**
 * Desde cuándo un aviso deja de ser cierto (§8.3).
 *
 * Es la regla menos obvia del PRD y la razón de que exista `descartado`: si el
 * correo que dice "tu cupo queda tomado hasta el jueves a las 18:00" se
 * reintenta el viernes, manda a transferir por un cupo que ya se soltó. Mejor
 * no mandarlo y que alguien la llame.
 *
 * `null` significa que no caduca. Y cuando falta el dato con que caducaría
 * —una reserva sin `expira_at`, por ejemplo— también devuelve `null`: no se
 * inventa una fecha, y el envío queda sujeto solo al tope de reintentos.
 */
export function caducaAt(plantilla: Plantilla, contexto: ContextoDeCaducidad): Date | null {
  switch (plantilla) {
    case "especialPendiente":
      return contexto.expiraAt;
    case "reserva":
    case "especialConfirmada":
      return contexto.inicioClase;
    case "transferenciaDeclarada":
      // Aviso operativo a la academia: a las 24 h la bandeja ya lo muestra.
      return sumarMinutos(contexto.encoladoAt, 24 * 60);
    case "compraAprobada":
    case "compraRechazada":
      // Siguen siendo ciertos la semana que viene.
      return null;
  }
}

/** La comparación es estricta: el que vence exactamente ahora ya no se manda. */
export function caduco(envio: Pick<Envio, "caducaAt">, ahora: Date): boolean {
  return envio.caducaAt !== null && envio.caducaAt.getTime() <= ahora.getTime();
}

/**
 * Si el barrido tiene que tomar este envío.
 *
 * **Caducado gana sobre fallido**: un aviso vencido no se reintenta, se
 * descarta con motivo y se muestra en el portal.
 */
export function debeReintentar(envio: Envio, ahora: Date): boolean {
  if (envio.estado === "enviado" || envio.estado === "descartado") return false;
  if (caduco(envio, ahora)) return false;
  if (envio.intentos > MAXIMO_REINTENTOS) return false;

  if (envio.estado === "pendiente") {
    // Nunca se marcó: se le da un rato por si el envío está en curso.
    return sumarMinutos(envio.creadoAt, MINUTOS_PENDIENTE_COLGADO).getTime() <= ahora.getTime();
  }

  // Un fallido sin hora agendada se toma igual: quedarse esperando para siempre
  // es peor que reintentar una vez de más.
  if (envio.proximoIntentoAt === null) return true;
  return envio.proximoIntentoAt.getTime() <= ahora.getTime();
}

/**
 * Si a este envío hay que borrarle el contenido.
 *
 * Se va el cuerpo y el destinatario; **la fila queda**, con a quién se le
 * escribió, cuándo y con qué resultado. Es lo que permite contestar "se te
 * mandó el 3 a las 18:04" sin guardar para siempre datos de una menor.
 */
export function aPurgar(envio: Envio, ahora: Date): boolean {
  if (envio.estado !== "enviado" || !envio.tieneContenido || envio.enviadoAt === null) {
    return false;
  }
  const limite = sumarMinutos(ahora, -DIAS_RETENCION * 24 * 60);
  return envio.enviadoAt.getTime() <= limite.getTime();
}

/**
 * La clave que evita el duplicado: identifica **el hecho**, no el intento. Dos
 * clics en "Ya transferí" son el mismo hecho y tienen que dar un solo correo.
 */
export function claveDeEvento(tipo: string, id: string): string {
  return `${tipo}:${id}`;
}

/**
 * A las alumnas importadas sin correo real no se les escribe: `.invalid` es un
 * TLD reservado y el rebote está garantizado. Igual se **registra** el envío
 * como `descartado`, para que quede dicho que había algo que decirle a alguien.
 */
export function esCorreoReal(direccion: string | null | undefined): boolean {
  const limpio = (direccion ?? "").trim().toLowerCase();
  if (limpio === "" || !limpio.includes("@")) return false;
  return !limpio.endsWith(".invalid");
}
