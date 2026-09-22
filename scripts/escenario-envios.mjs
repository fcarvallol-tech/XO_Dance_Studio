/**
 * Escenario de PRD-0019 fase 3: el registro de envíos probado **con datos**,
 * en STAGING, antes de que `lib/correo.ts` dependa de él.
 *
 * Cada caso corre dentro de una transacción que se revierte: se puede correr
 * las veces que haga falta y no deja una sola fila. Eso no es prolijidad, es
 * una lección de la fase 6 de PRD-0018: una prueba que deja rastro en los datos
 * de otra prueba ensucia el escenario de métricas y se descubre cuatro corridas
 * después.
 *
 * QUÉ PRUEBA Y QUÉ NO
 *
 * Prueba las funciones, los estados y quién puede leer la tabla. **No prueba
 * que un correo llegue**: eso necesita Resend y un buzón de verdad, y es la
 * fase 7. Acá se prueba que cuando no llegue, quede registrado.
 *
 * LAS DECISIONES NO SE REIMPLEMENTAN ACÁ
 *
 * El backoff y el "¿se reintenta?" los calcula `lib/dominio/envios.ts`, que es
 * el mismo código que va a usar el barrido. Reimplementarlos en el verificador
 * probaría que dos copias coinciden, no que la que se usa está bien.
 */
import { conectar } from "./staging.mjs";
import {
  MAXIMO_REINTENTOS,
  debeReintentar,
  proximoIntento,
} from "../lib/dominio/envios.ts";

const U = {
  ana: "11111111-1111-4111-8111-000000000001",
  owner: "11111111-1111-4111-8111-000000000009",
  admin: "11111111-1111-4111-8111-000000000008",
};

const cliente = await conectar();
const q = (sql, params) => cliente.query(sql, params);
const una = async (sql, params) => (await q(sql, params)).rows[0];

const resultados = [];
const caso = (nombre, esperado, fn) => resultados.push({ nombre, esperado, fn });

/** Encola un envío de prueba y devuelve la fila. */
async function encolar(extra = {}) {
  const {
    plantilla = "reserva",
    destinatario = "prueba@ejemplo.test",
    clave = `prueba:${Math.random().toString(36).slice(2)}`,
    caduca = null,
    motivo = null,
  } = extra;
  const { encolar_correo: texto } = await una(
    `select (public.encolar_correo(
       p_plantilla => $1, p_destinatario => $2,
       p_datos => '{"titulo":"Coreo de prueba"}'::jsonb,
       p_clave => $3, p_caduca_at => $4, p_motivo_descarte => $5)).id as encolar_correo`,
    [plantilla, destinatario, clave, caduca, motivo],
  );
  return una(`select * from public.envios_correo where id = $1`, [texto]);
}

/** Lo que devuelve la base, traducido a lo que espera lib/dominio. */
const aDominio = (fila) => ({
  estado: fila.estado,
  intentos: fila.intentos,
  proximoIntentoAt: fila.proximo_intento_at,
  caducaAt: fila.caduca_at,
  creadoAt: fila.created_at,
  enviadoAt: fila.enviado_at,
  tieneContenido: fila.purgado_at === null,
});

async function rechazo(sql, params) {
  await q("savepoint intento");
  try {
    await q(sql, params);
    await q("release savepoint intento");
    return "NO RECHAZÓ";
  } catch (e) {
    await q("rollback to savepoint intento");
    return `${e.code} · ${e.message}`;
  }
}

/** Lee la tabla como un rol concreto, con RLS y grants puestos. */
async function comoRol(rol, userId = null) {
  await q("savepoint sesion");
  try {
    if (userId) {
      await q(
        `select set_config('request.jwt.claims',
                  json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)`,
        [userId],
      );
    }
    await q(`set local role ${rol}`);
    const { rows } = await q(`select count(*)::int as n from public.envios_correo`);
    return `${rows[0].n} filas`;
  } catch (e) {
    // Un permiso denegado aborta la transacción entera: sin este rollback, todo
    // lo que venga después del caso falla por arrastre y el ✗ apunta al lugar
    // equivocado.
    await q("rollback to savepoint sesion").catch(() => {});
    return `${e.code} · ${e.message.split("\n")[0]}`;
  } finally {
    await q("reset role").catch(() => {});
    await q("release savepoint sesion").catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Los casos
// ---------------------------------------------------------------------------

caso("encolar deja el envío pendiente y listo para salir ya", "pendiente · 0 intentos · con hora", async () => {
  const e = await encolar();
  return `${e.estado} · ${e.intentos} intentos · ${e.proximo_intento_at ? "con hora" : "sin hora"}`;
});

caso("el mismo hecho dos veces deja una sola fila", "1 fila · mismo id", async () => {
  const clave = "reserva:la-misma-de-siempre";
  const a = await encolar({ clave });
  const b = await encolar({ clave });
  const { n } = await una(
    `select count(*)::int as n from public.envios_correo where clave_idempotencia = $1`,
    [clave],
  );
  return `${n} fila · ${a.id === b.id ? "mismo id" : "ids distintos"}`;
});

caso("un correo .invalid se registra descartado, sin intentarse", "descartado · sin correo real · sin hora", async () => {
  const e = await encolar({ destinatario: "ana@ejemplo.invalid", motivo: "sin correo real" });
  return `${e.estado} · ${e.motivo_descarte} · ${e.proximo_intento_at ? "con hora" : "sin hora"}`;
});

caso("marcar_fallido suma el intento, guarda el error y agenda el próximo", "fallido · 1 intento · error guardado · +5 min", async () => {
  const e = await encolar();
  const ahora = new Date();
  const proximo = proximoIntento(e.intentos + 1, ahora);
  const f = await una(
    `select * from public.marcar_fallido($1, $2, $3)`,
    [e.id, "Resend respondió 503", proximo.toISOString()],
  );
  const minutos = Math.round((new Date(f.proximo_intento_at) - ahora) / 60000);
  return `${f.estado} · ${f.intentos} intento · ${f.ultimo_error ? "error guardado" : "sin error"} · +${minutos} min`;
});

caso("marcar_enviado cierra el envío y le saca la hora de reintento", "enviado · con enviado_at · sin hora · sin error", async () => {
  const e = await encolar();
  await q(`select public.marcar_fallido($1, $2, now())`, [e.id, "un fallo previo"]);
  const f = await una(`select * from public.marcar_enviado($1)`, [e.id]);
  return `${f.estado} · ${f.enviado_at ? "con enviado_at" : "sin enviado_at"} · ${f.proximo_intento_at ? "con hora" : "sin hora"} · ${f.ultimo_error ? "con error" : "sin error"}`;
});

caso("agotados los reintentos, lib/dominio deja de tomarlo", `${MAXIMO_REINTENTOS + 1} intentos · no se reintenta`, async () => {
  const e = await encolar();
  await q(
    `update public.envios_correo set intentos = $2, estado = 'fallido', proximo_intento_at = now() - interval '1 hour' where id = $1`,
    [e.id, MAXIMO_REINTENTOS + 1],
  );
  const f = await una(`select * from public.envios_correo where id = $1`, [e.id]);
  return `${f.intentos} intentos · ${debeReintentar(aDominio(f), new Date()) ? "se reintenta" : "no se reintenta"}`;
});

caso("un caducado que tocaba reintentar no se manda: se descarta", "no se reintenta · descartado · con motivo", async () => {
  const e = await encolar({ caduca: new Date(Date.now() - 60_000).toISOString() });
  await q(
    `update public.envios_correo set estado = 'fallido', intentos = 1, proximo_intento_at = now() - interval '1 minute' where id = $1`,
    [e.id],
  );
  const f = await una(`select * from public.envios_correo where id = $1`, [e.id]);
  const seReintenta = debeReintentar(aDominio(f), new Date());
  const d = await una(`select * from public.descartar_envio($1, $2)`, [e.id, "El cupo ya se soltó"]);
  return `${seReintenta ? "se reintenta" : "no se reintenta"} · ${d.estado} · ${d.motivo_descarte ? "con motivo" : "sin motivo"}`;
});

caso("un pendiente colgado hace una hora se trata como fallido", "se reintenta", async () => {
  const e = await encolar();
  await q(
    `update public.envios_correo set created_at = now() - interval '1 hour', proximo_intento_at = null where id = $1`,
    [e.id],
  );
  const f = await una(`select * from public.envios_correo where id = $1`, [e.id]);
  return debeReintentar(aDominio(f), new Date()) ? "se reintenta" : "no se reintenta";
});

caso("la purga vacía el contenido y deja la fila", "1 purgado · fila viva · sin destinatario · sin datos", async () => {
  const e = await encolar();
  await q(
    `update public.envios_correo set estado = 'enviado', enviado_at = now() - interval '31 days' where id = $1`,
    [e.id],
  );
  const { purgar_envios_viejos: n } = await una(`select public.purgar_envios_viejos(30)`);
  const f = await una(`select * from public.envios_correo where id = $1`, [e.id]);
  return `${n} purgado · ${f ? "fila viva" : "fila borrada"} · ${f.destinatario ? "con destinatario" : "sin destinatario"} · ${f.datos ? "con datos" : "sin datos"}`;
});

caso("el botón de reintentar: admin sí, alumna no", "alumna: 42501 · admin: fallido con 0 intentos y hora nueva", async () => {
  const e = await encolar();
  await q(
    `update public.envios_correo set estado = 'fallido', intentos = $2, proximo_intento_at = now() + interval '12 hours' where id = $1`,
    [e.id, MAXIMO_REINTENTOS + 1],
  );
  const negado = await rechazo(`select public.reintentar_envio($1, $2)`, [e.id, U.ana]);
  const f = await una(`select * from public.reintentar_envio($1, $2)`, [e.id, U.admin]);
  const alDia = new Date(f.proximo_intento_at) <= new Date();
  return `alumna: ${negado.slice(0, negado.indexOf(" ·"))} · admin: ${f.estado} con ${f.intentos} intentos y hora ${alDia ? "nueva" : "vieja"}`;
});

caso("un descartado no se reintenta desde el portal", "22023 · Un envío descartado no se reintenta", async () => {
  const e = await encolar();
  await q(`select public.descartar_envio($1, $2)`, [e.id, "El cupo ya se soltó"]);
  const r = await rechazo(`select public.reintentar_envio($1, $2)`, [e.id, U.admin]);
  return r.slice(0, r.indexOf(":"));
});

caso("quién puede leer la tabla", "anon: no · alumna: 0 filas · admin: ve · service_role: ve", async () => {
  await encolar();
  const anon = await comoRol("anon");
  const alumna = await comoRol("authenticated", U.ana);
  const admin = await comoRol("authenticated", U.admin);
  const servidor = await comoRol("service_role");
  const leyo = (r) => (r.includes("filas") ? (r === "0 filas" ? "0 filas" : "ve") : "no");
  return `anon: ${leyo(anon)} · alumna: ${alumna === "0 filas" ? "0 filas" : leyo(alumna)} · admin: ${leyo(admin)} · service_role: ${leyo(servidor)}`;
});

// ---------------------------------------------------------------------------
// Corrida
// ---------------------------------------------------------------------------
console.log("\nPRD-0019 fase 3 — escenario del registro de envíos en staging\n");
console.log("| Caso | Esperado | Obtenido | |");
console.log("|---|---|---|---|");

let fallas = 0;
for (const { nombre, esperado, fn } of resultados) {
  let real;
  await q("begin");
  try {
    real = await fn();
  } catch (e) {
    real = `ERROR ${e.code ?? ""} ${e.message.split("\n")[0]}`;
  } finally {
    await q("rollback").catch(() => {});
  }
  const ok = real === esperado || real.includes(esperado);
  if (!ok) fallas++;
  console.log(`| ${nombre} | ${esperado} | ${real} | ${ok ? "✓" : "✗"} |`);
}

console.log(`\n${resultados.length - fallas}/${resultados.length} casos como los dice el PRD.`);
await cliente.end();
process.exitCode = fallas ? 1 : 0;
