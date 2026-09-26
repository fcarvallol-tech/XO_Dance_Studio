import { Resend } from "resend";
import { clp } from "./planes";
import { sitio } from "./sitio";
import { clienteAdmin } from "./supabase/admin";
import {
  caducaAt as caducidadDe,
  claveDeEvento,
  esCorreoReal,
  proximoIntento,
  type Plantilla,
} from "./dominio/envios";

/**
 * Correo transaccional. Resend, por ADR-0007.
 *
 * **Regla que atraviesa todo este archivo: el correo nunca es parte de una
 * transacción.** Si el envío falla, la compra se aprobó igual y la reserva
 * existe igual. Por eso nada de acá lanza: registra el error y sigue. Revertir
 * plata por un problema de correo sería mucho peor que un aviso que no llegó.
 *
 * ---
 *
 * **Lo que cambió con PRD-0019: ahora queda registrado.** Antes el fallo se
 * atrapaba, se escribía en un log que nadie lee y se devolvía un `false` que
 * ninguno de los seis llamadores miraba; si Resend fallaba treinta segundos, se
 * perdía hasta el dato de a quién había que escribirle. Ahora cada correo se
 * **encola primero** en `envios_correo` y recién después se intenta.
 *
 * De ahí sale la forma de este archivo:
 *
 * - `CUERPOS` arma el asunto y el HTML **a partir de `datos`**, nada más. Es lo
 *   que hace posible reintentar: el barrido no tiene el contexto original, solo
 *   la fila, así que el cuerpo tiene que poder reconstruirse desde ella.
 * - `avisarX()` decide lo que sabe el momento —a quién, con qué clave, cuándo
 *   caduca, a qué se refiere— y delega en `despachar`.
 * - `despachar` encola, intenta y marca. Devuelve si salió, **y ahora alguien
 *   mira ese booleano**.
 */

const DESDE = process.env.CORREO_DESDE?.trim() || "XO Dance Studio <hola@xodancestudio.cl>";

function cliente(): Resend | null {
  const llave = process.env.RESEND_API_KEY?.trim();
  if (!llave) {
    console.error("Falta RESEND_API_KEY: el correo no se envía.");
    return null;
  }
  return new Resend(llave);
}

/** Lo que Resend necesita, ya armado. */
type Cuerpo = { asunto: string; html: string };

/** Lo que `avisarX` sabe y la fila no puede adivinar después. */
type Orden = {
  plantilla: Plantilla;
  para: string | null;
  datos: Record<string, unknown>;
  /** El hecho, no el intento: `reserva:<uuid>`. */
  clave: string;
  /** Para calcular la caducidad. Lo que no aplique va en null. */
  expiraAt?: string | null;
  inicioClase?: string | null;
  perfilId?: string | null;
  compraId?: string | null;
  reservaId?: string | null;
  claseId?: string | null;
};

/**
 * Encola, intenta y marca. **No lanza nunca.**
 *
 * El orden importa: si se encola después de intentar, un proceso que se muere
 * en el medio se lleva el dato de que había que escribirle a alguien, que es
 * exactamente lo que este PRD vino a arreglar.
 */
async function despachar(orden: Orden): Promise<boolean> {
  const admin = clienteAdmin();
  const ahora = new Date();
  const real = esCorreoReal(orden.para);

  const { data, error } = await admin.rpc("encolar_correo", {
    p_plantilla: orden.plantilla,
    p_destinatario: orden.para ?? "(sin correo)",
    p_datos: orden.datos,
    p_clave: orden.clave,
    p_caduca_at:
      caducidadDe(orden.plantilla, {
        expiraAt: orden.expiraAt ? new Date(orden.expiraAt) : null,
        inicioClase: orden.inicioClase ? new Date(orden.inicioClase) : null,
        encoladoAt: ahora,
      })?.toISOString() ?? null,
    // Las alumnas importadas sin correo real: se registra que había algo que
    // decirles, y no se intenta. Antes ni siquiera quedaba la fila.
    p_motivo_descarte: real ? null : "sin correo real",
    p_perfil_id: orden.perfilId ?? null,
    p_compra_id: orden.compraId ?? null,
    p_reserva_id: orden.reservaId ?? null,
    p_clase_id: orden.claseId ?? null,
  });

  if (error) {
    // Ni siquiera se pudo registrar. Se intenta igual: un correo que sale sin
    // quedar anotado es mejor que uno que no sale.
    console.error("No se pudo encolar el correo:", error.message);
    if (!real) return false;
    return (await intentar(orden.plantilla, orden.para!, orden.datos)) === null;
  }

  const fila = data as { id: string; estado: string } | null;
  if (!fila || fila.estado === "descartado") return false;
  // Ya estaba enviado: el mismo hecho, un solo correo.
  if (fila.estado === "enviado") return true;

  return intentarYMarcar(fila.id, orden.plantilla, orden.para!, orden.datos, 0, ahora);
}

/** Manda de verdad. Devuelve el error, o `null` si salió. */
async function intentar(
  plantilla: Plantilla,
  para: string,
  datos: Record<string, unknown>,
): Promise<string | null> {
  const resend = cliente();
  if (!resend) return "Falta RESEND_API_KEY";

  let cuerpo: Cuerpo;
  try {
    cuerpo = CUERPOS[plantilla](datos);
  } catch (fallo) {
    return `No se pudo armar el cuerpo: ${(fallo as Error).message}`;
  }

  try {
    const { error } = await resend.emails.send({
      from: DESDE,
      to: para,
      subject: cuerpo.asunto,
      html: cuerpo.html,
    });
    return error ? `Resend rechazó el envío: ${error.message}` : null;
  } catch (fallo) {
    return `No se pudo enviar: ${(fallo as Error).message}`;
  }
}

/** Intenta y deja la fila como corresponda. */
async function intentarYMarcar(
  id: string,
  plantilla: Plantilla,
  para: string,
  datos: Record<string, unknown>,
  intentosPrevios: number,
  ahora: Date,
): Promise<boolean> {
  const admin = clienteAdmin();
  const fallo = await intentar(plantilla, para, datos);

  if (fallo === null) {
    await admin.rpc("marcar_enviado", { p_id: id });
    return true;
  }

  console.error(`Correo ${plantilla} no salió:`, fallo);
  const proximo = proximoIntento(intentosPrevios + 1, ahora);
  await admin.rpc("marcar_fallido", {
    p_id: id,
    p_error: fallo,
    p_proximo: proximo ? proximo.toISOString() : null,
  });
  return false;
}

/**
 * Reintentar un envío ya registrado. Lo usa el barrido: reconstruye el cuerpo
 * desde `datos` —por eso `CUERPOS` no puede depender de nada más— y vuelve a
 * marcar la fila.
 */
export async function reintentarEnvioRegistrado(fila: {
  id: string;
  plantilla: string;
  destinatario: string | null;
  datos: Record<string, unknown> | null;
  intentos: number;
}): Promise<boolean> {
  if (!esCorreoReal(fila.destinatario) || !(fila.plantilla in CUERPOS)) {
    await clienteAdmin().rpc("descartar_envio", {
      p_id: fila.id,
      p_motivo: esCorreoReal(fila.destinatario)
        ? `Plantilla desconocida: ${fila.plantilla}`
        : "sin correo real",
    });
    return false;
  }

  return intentarYMarcar(
    fila.id,
    fila.plantilla as Plantilla,
    fila.destinatario!,
    fila.datos ?? {},
    fila.intentos,
    new Date(),
  );
}

/**
 * Marco común. HTML de correo y no componentes: los clientes de correo
 * entienden tablas y estilos en línea, no hojas de estilo. Los colores son los
 * mismos tokens de BRAND.md, escritos a mano porque acá no llega Tailwind.
 */
function plantilla(titulo: string, cuerpo: string): string {
  // `lang` va **también en la tabla**, y no solo en el <html>, porque los
  // clientes de correo tiran el documento y se quedan con lo de adentro: Gmail
  // borra <html> y <body>, así que el idioma declarado ahí no le llega y ofrece
  // traducir un correo que ya está en español (Felipe lo vio, 26/09/2026).
  return `<!doctype html>
<html lang="es-CL"><body style="margin:0;padding:0;background:#1a1a1a;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" lang="es-CL" dir="ltr" width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" lang="es-CL" dir="ltr" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#232323;border-radius:8px;padding:32px;">
        <tr><td>
          <p style="margin:0 0 24px;font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#f7adbf;">XO Dance Studio</p>
          <h1 style="margin:0 0 20px;font-size:24px;line-height:1.2;color:#f7f7f7;">${titulo}</h1>
          ${cuerpo}
        </td></tr>
      </table>
      <p style="margin:24px 0 0;font-size:12px;color:#f7f7f7;opacity:.5;">XO Dance Studio · Providencia y Las Condes, Santiago</p>
    </td></tr>
  </table>
</body></html>`;
}

const P = 'style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#f7f7f7;"';

// ---------------------------------------------------------------------------
// Los cuerpos
// ---------------------------------------------------------------------------
// **Solo dependen de `datos`.** Es lo que hace posible el reintento: el barrido
// corre al otro día, sin el contexto original, y lo único que tiene es la fila.
// Si un cuerpo necesitara algo de fuera, ese correo no se podría reintentar.
//
// El copy no cambió con PRD-0019: es el mismo que ya se leía.

type Cuerpos = { [K in Plantilla]: (d: Record<string, unknown>) => Cuerpo };

const CUERPOS: Cuerpos = {
  transferenciaDeclarada: (d) => {
    const alumna = String(d.alumna ?? "Alguien");
    const monto = Number(d.monto ?? 0);
    return {
      asunto: `Transferencia declarada: ${alumna} · ${clp(monto)}`,
      html: plantilla(
        "Hay una transferencia por revisar",
        `<p ${P}><strong>${alumna}</strong> declaró haber transferido <strong>${clp(monto)}</strong> por el plan de ${d.plan}.</p>
       ${d.titular ? `<p ${P}>Transfirió a nombre de: <strong>${d.titular}</strong>.</p>` : ""}
       ${d.correoAlumna ? `<p ${P}>Su correo: ${d.correoAlumna}</p>` : ""}
       <p ${P}>Revisa la cuenta y aprueba o rechaza desde la bandeja.</p>
       <p style="margin:24px 0 0;"><a href="${sitio()}/admin/compras" style="display:inline-block;background:#f7adbf;color:#1a1a1a;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;">Ir a la bandeja</a></p>
       <p style="margin:20px 0 0;font-size:13px;color:#f7f7f7;opacity:.6;">Si este correo no llegó a tiempo, la compra igual está en la bandeja: el aviso no es el mecanismo.</p>`,
      ),
    };
  },

  compraAprobada: (d) => {
    const clases = Number(d.clases ?? 0);
    const palabra = clases === 1 ? "clase" : "clases";
    return {
      asunto: `Listo: tienes ${clases} ${palabra} para reservar`,
      html: plantilla(
        `Quedaste con ${clases} ${palabra}`,
        `<p ${P}>${d.nombre ? `${d.nombre}, confirmamos` : "Confirmamos"} tu transferencia. Ya puedes reservar.</p>
       <p ${P}>Sirven para <strong>cualquier clase de la parrilla</strong>, con cualquier profe y en cualquiera de las dos salas.</p>
       <p ${P}>Tienes hasta el <strong>${d.vence}</strong> para usarlas.</p>
       <p style="margin:24px 0 0;"><a href="${sitio()}/reservar" style="display:inline-block;background:#f7adbf;color:#1a1a1a;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;">Reservar mis clases</a></p>`,
      ),
    };
  },

  compraRechazada: (d) => ({
    asunto: "No pudimos confirmar tu transferencia",
    html: plantilla(
      "No pudimos confirmar tu transferencia",
      `<p ${P}>${d.nombre ? `${d.nombre}, revisamos` : "Revisamos"} la cuenta y no encontramos tu pago.</p>
       <p ${P}><strong>Motivo:</strong> ${d.motivo}</p>
       <p ${P}>Si crees que es un error, respóndenos este correo con el comprobante y lo revisamos de nuevo. No se te cobró nada.</p>`,
    ),
  }),

  reserva: (d) => ({
    asunto: `Reservaste ${d.curso} · ${d.cuando}`,
    html: plantilla(
      "Tu clase está reservada",
      `<p ${P}><strong>${d.curso}</strong> con ${d.profesora}</p>
       <p ${P}>${d.cuando}</p>
       <p ${P}>${d.sede}<br>${d.direccion}</p>
       <p style="margin:20px 0 0;font-size:13px;color:#f7f7f7;opacity:.6;">Puedes cancelar hasta 30 minutos antes y recuperas tu clase.</p>`,
    ),
  }),

  especialPendiente: (d) => ({
    asunto: `Te guardamos el cupo: ${d.titulo}`,
    html: plantilla(
      "Tu cupo está tomado",
      `<p ${P}>${d.nombre ? `${d.nombre}, te` : "Te"} guardamos un lugar en <strong>${d.titulo}</strong>.</p>
       <p ${P}>${d.cuando} · ${d.sede}</p>
       <p ${P}>Transfiere <strong>${clp(Number(d.monto ?? 0))}</strong> con los datos que viste al reservar. Apenas confirmemos el abono, tu lugar queda cerrado.</p>
       <p style="margin:20px 0 0;padding:14px 16px;background:#1a1a1a;border-left:3px solid #f7adbf;font-size:15px;line-height:1.6;color:#f7f7f7;">
         Tienes hasta el <strong style="color:#f2d0dc;">${d.expira}</strong> para transferir. Después el cupo se libera.
       </p>`,
    ),
  }),

  especialConfirmada: (d) => ({
    asunto: `Confirmada: ${d.titulo} · ${d.cuando}`,
    html: plantilla(
      "Tu clase especial está confirmada",
      `<p ${P}>${d.nombre ? `${d.nombre}, confirmamos` : "Confirmamos"} tu transferencia. Tu lugar en <strong>${d.titulo}</strong> quedó cerrado.</p>
       <p ${P}>${d.cuando}</p>
       <p ${P}>Con ${d.profesora}<br>${d.sede}<br>${d.direccion}</p>
       <p style="margin:20px 0 0;font-size:13px;color:#f7f7f7;opacity:.6;">Si no puedes ir, avísanos: el cupo se libera para otra persona. La devolución del dinero la vemos caso a caso por WhatsApp.</p>`,
    ),
  }),
};

// ---------------------------------------------------------------------------
// Los avisos
// ---------------------------------------------------------------------------
// Cada uno sabe tres cosas que la fila no puede deducir después: **qué hecho
// es** (la clave de idempotencia), **cuándo deja de ser cierto** y **a qué se
// refiere**. El resto lo pone el cuerpo.

/** A la academia: alguien declaró una transferencia y hay que revisarla. */
export async function avisarTransferenciaDeclarada(datos: {
  para: string;
  alumna: string;
  correoAlumna: string | null;
  plan: string;
  monto: number;
  titular: string | null;
  compraId?: string | null;
}): Promise<boolean> {
  const { para, compraId, ...cuerpo } = datos;
  return despachar({
    plantilla: "transferenciaDeclarada",
    para,
    datos: cuerpo,
    clave: claveDeEvento("transferencia-declarada", compraId ?? `${datos.alumna}:${Date.now()}`),
    compraId,
  });
}

/** A la alumna: sus clases quedaron acreditadas. */
export async function avisarCompraAprobada(datos: {
  para: string;
  nombre: string | null;
  clases: number;
  vence: string;
  compraId: string;
  perfilId?: string | null;
}): Promise<boolean> {
  const { para, compraId, perfilId, ...cuerpo } = datos;
  return despachar({
    plantilla: "compraAprobada",
    para,
    datos: cuerpo,
    clave: claveDeEvento("compra-aprobada", compraId),
    compraId,
    perfilId,
  });
}

/** A la alumna: no encontramos la transferencia, y por qué. */
export async function avisarCompraRechazada(datos: {
  para: string;
  nombre: string | null;
  motivo: string;
  compraId: string;
  perfilId?: string | null;
}): Promise<boolean> {
  const { para, compraId, perfilId, ...cuerpo } = datos;
  return despachar({
    plantilla: "compraRechazada",
    para,
    datos: cuerpo,
    clave: claveDeEvento("compra-rechazada", compraId),
    compraId,
    perfilId,
  });
}

/** A la alumna: comprobante de reserva. Caduca cuando la clase empieza. */
export async function avisarReserva(datos: {
  para: string;
  curso: string;
  cuando: string;
  profesora: string;
  sede: string;
  direccion: string;
  reservaId: string;
  claseId?: string | null;
  perfilId?: string | null;
  inicioClase?: string | null;
}): Promise<boolean> {
  const { para, reservaId, claseId, perfilId, inicioClase, ...cuerpo } = datos;
  return despachar({
    plantilla: "reserva",
    para,
    datos: cuerpo,
    clave: claveDeEvento("reserva", reservaId),
    inicioClase,
    reservaId,
    claseId,
    perfilId,
  });
}

/**
 * A la alumna: reservó una clase especial y tiene un plazo para transferir
 * (PRD-0018 §8.2).
 *
 * **El texto dice que lo que vence es el plazo para transferir, no el cupo de la
 * clase.** La primera versión decía "el cupo te queda tomado hasta el domingo
 * 27" para una clase del 20 de noviembre, y eso se lee como si la clase fuera el
 * domingo. Felipe lo cazó abriendo el correo de verdad (26/09/2026): es
 * exactamente el tipo de cosa que no se ve leyendo código.
 *
 * **Es el correo que motivó PRD-0019.** Lleva un plazo, así que caduca con
 * `expira_at`: si el reintento cae después, no se manda. Mandar el viernes un
 * aviso con el plazo del jueves hace transferir por un lugar que ya se soltó.
 */
export async function avisarEspecialPendiente(datos: {
  para: string;
  nombre: string | null;
  titulo: string;
  cuando: string;
  sede: string;
  monto: number;
  expira: string;
  reservaId: string;
  expiraAt: string;
  claseId?: string | null;
  compraId?: string | null;
  perfilId?: string | null;
}): Promise<boolean> {
  const { para, reservaId, expiraAt, claseId, compraId, perfilId, ...cuerpo } = datos;
  return despachar({
    plantilla: "especialPendiente",
    para,
    datos: cuerpo,
    clave: claveDeEvento("especial-pendiente", reservaId),
    expiraAt,
    reservaId,
    claseId,
    compraId,
    perfilId,
  });
}

/** A la alumna: confirmamos su transferencia y la clase especial quedó reservada. */
export async function avisarEspecialConfirmada(datos: {
  para: string;
  nombre: string | null;
  titulo: string;
  cuando: string;
  profesora: string;
  sede: string;
  direccion: string;
  reservaId: string;
  claseId?: string | null;
  compraId?: string | null;
  perfilId?: string | null;
  inicioClase?: string | null;
}): Promise<boolean> {
  const { para, reservaId, claseId, compraId, perfilId, inicioClase, ...cuerpo } = datos;
  return despachar({
    plantilla: "especialConfirmada",
    para,
    datos: cuerpo,
    clave: claveDeEvento("especial-confirmada", reservaId),
    inicioClase,
    reservaId,
    claseId,
    compraId,
    perfilId,
  });
}
