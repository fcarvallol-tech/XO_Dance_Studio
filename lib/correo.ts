import { Resend } from "resend";
import { clp } from "./planes";
import { sitio } from "./sitio";

/**
 * Correo transaccional. Resend, por ADR-0007.
 *
 * **Regla que atraviesa todo este archivo: el correo nunca es parte de una
 * transacción.** Si el envío falla, la compra se aprobó igual y la reserva
 * existe igual. Por eso `enviar` no lanza nunca: registra el error y sigue.
 * Revertir plata por un problema de correo sería mucho peor que un aviso que
 * no llegó.
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

async function enviar(opciones: {
  para: string;
  asunto: string;
  html: string;
}): Promise<boolean> {
  const resend = cliente();
  if (!resend) return false;

  try {
    const { error } = await resend.emails.send({
      from: DESDE,
      to: opciones.para,
      subject: opciones.asunto,
      html: opciones.html,
    });
    if (error) {
      console.error("Resend rechazó el envío:", error);
      return false;
    }
    return true;
  } catch (fallo) {
    console.error("No se pudo enviar el correo:", fallo);
    return false;
  }
}

/**
 * Marco común. HTML de correo y no componentes: los clientes de correo
 * entienden tablas y estilos en línea, no hojas de estilo. Los colores son los
 * mismos tokens de BRAND.md, escritos a mano porque acá no llega Tailwind.
 */
function plantilla(titulo: string, cuerpo: string): string {
  return `<!doctype html>
<html lang="es-CL"><body style="margin:0;padding:0;background:#1a1a1a;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#232323;border-radius:8px;padding:32px;">
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

/** A la academia: alguien declaró una transferencia y hay que revisarla. */
export async function avisarTransferenciaDeclarada(datos: {
  para: string;
  alumna: string;
  correoAlumna: string | null;
  plan: string;
  monto: number;
  titular: string | null;
}): Promise<boolean> {
  return enviar({
    para: datos.para,
    asunto: `Transferencia declarada: ${datos.alumna} · ${clp(datos.monto)}`,
    html: plantilla(
      "Hay una transferencia por revisar",
      `<p ${P}><strong>${datos.alumna}</strong> declaró haber transferido <strong>${clp(datos.monto)}</strong> por el plan de ${datos.plan}.</p>
       ${datos.titular ? `<p ${P}>Transfirió a nombre de: <strong>${datos.titular}</strong>.</p>` : ""}
       ${datos.correoAlumna ? `<p ${P}>Su correo: ${datos.correoAlumna}</p>` : ""}
       <p ${P}>Revisa la cuenta y aprueba o rechaza desde la bandeja.</p>
       <p style="margin:24px 0 0;"><a href="${sitio()}/admin/compras" style="display:inline-block;background:#f7adbf;color:#1a1a1a;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;">Ir a la bandeja</a></p>
       <p style="margin:20px 0 0;font-size:13px;color:#f7f7f7;opacity:.6;">Si este correo no llegó a tiempo, la compra igual está en la bandeja: el aviso no es el mecanismo.</p>`,
    ),
  });
}

/** A la alumna: sus clases quedaron acreditadas. */
export async function avisarCompraAprobada(datos: {
  para: string;
  nombre: string | null;
  clases: number;
  vence: string;
}): Promise<boolean> {
  return enviar({
    para: datos.para,
    asunto: `Listo: tienes ${datos.clases} ${datos.clases === 1 ? "clase" : "clases"} para reservar`,
    html: plantilla(
      `Quedaste con ${datos.clases} ${datos.clases === 1 ? "clase" : "clases"}`,
      `<p ${P}>${datos.nombre ? `${datos.nombre}, confirmamos` : "Confirmamos"} tu transferencia. Ya puedes reservar.</p>
       <p ${P}>Sirven para <strong>cualquier clase de la parrilla</strong>, con cualquier profe y en cualquiera de las dos salas.</p>
       <p ${P}>Tienes hasta el <strong>${datos.vence}</strong> para usarlas.</p>
       <p style="margin:24px 0 0;"><a href="${sitio()}/reservar" style="display:inline-block;background:#f7adbf;color:#1a1a1a;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;">Reservar mis clases</a></p>`,
    ),
  });
}

/** A la alumna: no encontramos la transferencia, y por qué. */
export async function avisarCompraRechazada(datos: {
  para: string;
  nombre: string | null;
  motivo: string;
}): Promise<boolean> {
  return enviar({
    para: datos.para,
    asunto: "No pudimos confirmar tu transferencia",
    html: plantilla(
      "No pudimos confirmar tu transferencia",
      `<p ${P}>${datos.nombre ? `${datos.nombre}, revisamos` : "Revisamos"} la cuenta y no encontramos tu pago.</p>
       <p ${P}><strong>Motivo:</strong> ${datos.motivo}</p>
       <p ${P}>Si crees que es un error, respóndenos este correo con el comprobante y lo revisamos de nuevo. No se te cobró nada.</p>`,
    ),
  });
}

/** A la alumna: comprobante de reserva. */
export async function avisarReserva(datos: {
  para: string;
  curso: string;
  cuando: string;
  profesora: string;
  sede: string;
  direccion: string;
}): Promise<boolean> {
  return enviar({
    para: datos.para,
    asunto: `Reservaste ${datos.curso} · ${datos.cuando}`,
    html: plantilla(
      "Tu clase está reservada",
      `<p ${P}><strong>${datos.curso}</strong> con ${datos.profesora}</p>
       <p ${P}>${datos.cuando}</p>
       <p ${P}>${datos.sede}<br>${datos.direccion}</p>
       <p style="margin:20px 0 0;font-size:13px;color:#f7f7f7;opacity:.6;">Puedes cancelar hasta 30 minutos antes y recuperas tu clase.</p>`,
    ),
  });
}
