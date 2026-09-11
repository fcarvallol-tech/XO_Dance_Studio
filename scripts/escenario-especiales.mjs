/**
 * Escenario de PRD-0018 fase 3: las clases especiales probadas **con datos**,
 * en STAGING, antes de que exista una sola pantalla.
 *
 * Cada caso corre dentro de una transacción que se revierte, así que se puede
 * correr las veces que haga falta sobre el mismo escenario sembrado y el orden
 * entre casos no importa. Lo que no se revierte es nada: no hay `commit`.
 *
 * QUÉ PRUEBA ESTO Y QUÉ NO
 *
 * Prueba la capa que decide plata y cupo: las funciones, los estados, el
 * bloqueo y lo que ve `anon`. **No prueba el flujo de la persona** —el link del
 * correo, el botón, el formulario—: eso es la fase 6 y se hace con el artefacto
 * real, por la regla del magic link. Si un caso de acá pasa, lo que quedó
 * probado es que la base hace lo que el PRD dice, no que alguien pueda hacerlo.
 *
 * LOS TRES FINALES DE UNA PENDIENTE (§8.3.b)
 *
 * `liberada` (la alumna la soltó), `expirada` (se venció el plazo o cayó la
 * clase) y `cancelada` (se cayó una que ya estaba en pie) son estados distintos
 * y varios casos de acá existen solo para fijar esa diferencia: que se
 * arrepienta no es lo mismo que que no alcancemos a aprobarle.
 *
 * Se corre con el escenario ya sembrado:
 *   node scripts/sembrar-escenario.mjs && node scripts/escenario-especiales.mjs
 */
import { conectar, ES } from "./staging.mjs";
import { mesEnCurso } from "../lib/dominio/periodo.ts";

const U = {
  ana: "11111111-1111-4111-8111-000000000001",
  bea: "11111111-1111-4111-8111-000000000002",
  cata: "11111111-1111-4111-8111-000000000003",
  owner: "11111111-1111-4111-8111-000000000009",
  admin: "11111111-1111-4111-8111-000000000008",
};

const cliente = await conectar();
const q = (sql, params) => cliente.query(sql, params);
const una = async (sql, params) => (await q(sql, params)).rows[0];

/** El id de una especial del escenario, por título. */
const especial = (titulo) =>
  una(
    `select id, cupo_maximo, precio_clp, inicio, sede_id, curso_id, profesora_id
     from public.clases where tipo = 'especial' and titulo = $1`,
    [titulo],
  );

const perfilDe = async (userId) =>
  (await una(`select id from public.perfiles where user_id = $1`, [userId])).id;

const cupo = async (claseId) =>
  (await una(`select public.cupo_tomado($1) as n`, [claseId])).n;

/** Reserva y devuelve la fila, sin evaluar la función más de una vez. */
async function reservar(claseId, userId) {
  const { id } = await una(
    `select (public.reservar_especial($1, $2)).id as id`,
    [claseId, userId],
  );
  return una(`select * from public.reservas where id = $1`, [id]);
}

const laCompra = (compraId) =>
  una(`select * from public.compras where id = $1`, [compraId]);
const laReserva = (reservaId) =>
  una(`select * from public.reservas where id = $1`, [reservaId]);

/**
 * Lo que se espera que **falle**. Devuelve "código · mensaje" para poder
 * contrastarlo como texto, y deja la transacción usable con un savepoint: sin
 * eso, un error aborta todo lo que viene después dentro del mismo caso.
 */
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

/** Corre algo con la sesión de alguien, con RLS y grants puestos. */
async function comoUsuario(userId, sql, params) {
  await q("savepoint sesion");
  try {
    await q(
      `select set_config('request.jwt.claims',
                json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)`,
      [userId],
    );
    await q("set local role authenticated");
    const { rows } = await q(sql, params);
    return rows;
  } finally {
    await q("reset role").catch(() => {});
    await q("release savepoint sesion").catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Los casos. `esperado` sale del PRD, no de correr el código y copiar lo que dé.
// ---------------------------------------------------------------------------
const casos = [];
const caso = (nombre, esperado, fn) => casos.push({ nombre, esperado, fn });

caso(
  "reservar_especial() toma el cupo y deja la compra pendiente",
  "compra pendiente con clase · $15000 · reserva pendiente_pago · expira en 24 h · cupo 0→1",
  async () => {
    const e = await especial(ES.publicada);
    const antes = await cupo(e.id);
    const r = await reservar(e.id, U.ana);
    const c = await laCompra(r.compra_id);
    const { h } = await una(
      `select round(extract(epoch from ($1::timestamptz - now())) / 3600)::int as h`,
      [r.expira_at],
    );
    return (
      `compra ${c.estado} ${c.clase_id ? "con" : "sin"} clase · $${c.monto_clp} · ` +
      `reserva ${r.estado} · expira en ${h} h · cupo ${antes}→${await cupo(e.id)}`
    );
  },
);

caso(
  "con el cupo lleno de pendientes vigentes, la siguiente no entra",
  "23514 · La clase está llena",
  async () => {
    const e = await especial(ES.publicada); // cupo 2
    await reservar(e.id, U.ana);
    await reservar(e.id, U.bea);
    return rechazo(`select public.reservar_especial($1, $2)`, [e.id, U.cata]);
  },
);

caso(
  "una pendiente vencida suelta el cupo sola, sin esperar al cron",
  "la de Ana expirada · Cata entra · cupo 2",
  async () => {
    const e = await especial(ES.publicada);
    const rAna = await reservar(e.id, U.ana);
    await reservar(e.id, U.bea);
    // Se adelanta el vencimiento: es lo mismo que hacer pasar 24 horas.
    await q(`update public.reservas set expira_at = now() - interval '1 second' where id = $1`, [
      rAna.id,
    ]);
    const rCata = await reservar(e.id, U.cata);
    const ana = await laReserva(rAna.id);
    return `la de Ana ${ana.estado} · Cata ${rCata.estado === "pendiente_pago" ? "entra" : "no entra"} · cupo ${await cupo(e.id)}`;
  },
);

caso(
  "acreditar una compra de clase confirma la reserva y no crea ni un crédito",
  "reserva confirmada · compra pagada · lotes 0 · movimientos 0",
  async () => {
    const e = await especial(ES.publicada);
    const perfil = await perfilDe(U.ana);
    const r = await reservar(e.id, U.ana);
    const { lotes, movs } = await una(
      `select (select count(*) from public.creditos where perfil_id = $1) as lotes,
              (select count(*) from public.movimientos_credito where perfil_id = $1) as movs`,
      [perfil],
    );
    await q(`select public.acreditar_compra($1, $2)`, [r.compra_id, U.admin]);
    const despues = await una(
      `select (select count(*) from public.creditos where perfil_id = $1) as lotes,
              (select count(*) from public.movimientos_credito where perfil_id = $1) as movs`,
      [perfil],
    );
    const c = await laCompra(r.compra_id);
    return (
      `reserva ${(await laReserva(r.id)).estado} · compra ${c.estado} · ` +
      `lotes ${Number(despues.lotes) - Number(lotes)} · movimientos ${Number(despues.movs) - Number(movs)}`
    );
  },
);

caso(
  "si transfirió y nadie aprobó a tiempo, admin la reactiva cuando hay cupo",
  "reserva confirmada · compra pagada",
  async () => {
    const e = await especial(ES.publicada);
    const r = await reservar(e.id, U.ana);
    await q(`update public.reservas set expira_at = now() - interval '1 second' where id = $1`, [r.id]);
    await q(`select public.expirar_reservas_pendientes($1)`, [e.id]);
    await q(`select public.acreditar_compra($1, $2)`, [r.compra_id, U.admin]);
    return `reserva ${(await laReserva(r.id)).estado} · compra ${(await laCompra(r.compra_id)).estado}`;
  },
);

caso(
  "expirada y sin cupo: la plata queda registrada para devolver, no se inventa un lugar",
  "reserva expirada · compra por_reembolsar",
  async () => {
    const e = await especial(ES.publicada); // cupo 2
    const r = await reservar(e.id, U.ana);
    await q(`update public.reservas set expira_at = now() - interval '1 second' where id = $1`, [r.id]);
    await q(`select public.expirar_reservas_pendientes($1)`, [e.id]);
    await reservar(e.id, U.bea);
    await reservar(e.id, U.cata);
    await q(`select public.acreditar_compra($1, $2)`, [r.compra_id, U.admin]);
    return `reserva ${(await laReserva(r.id)).estado} · compra ${(await laCompra(r.compra_id)).estado}`;
  },
);

// --- §8.3.b: soltar el cupo tiene estado propio ------------------------------
caso(
  "la alumna suelta el cupo: queda `liberada`, no `cancelada` ni `expirada`",
  "reserva liberada · compra expirada · cupo 1→0",
  async () => {
    const e = await especial(ES.publicada);
    const r = await reservar(e.id, U.ana);
    const antes = await cupo(e.id);
    await q(`select public.cancelar_reserva($1, $2)`, [r.id, U.ana]);
    const c = await laCompra(r.compra_id);
    return (
      `reserva ${(await laReserva(r.id)).estado} · compra ${c.estado} · ` +
      `cupo ${antes}→${await cupo(e.id)}`
    );
  },
);

caso(
  "una liberada no se reactiva aunque sobre cupo: si transfirió, se le devuelve",
  "reserva liberada · compra por_reembolsar · cupo 0",
  async () => {
    const e = await especial(ES.publicada);
    const r = await reservar(e.id, U.ana);
    await q(`select public.cancelar_reserva($1, $2)`, [r.id, U.ana]);
    await q(`select public.acreditar_compra($1, $2)`, [r.compra_id, U.admin]);
    return (
      `reserva ${(await laReserva(r.id)).estado} · ` +
      `compra ${(await laCompra(r.compra_id)).estado} · cupo ${await cupo(e.id)}`
    );
  },
);

caso(
  "soltar no la deja afuera: puede volver a reservar la misma clase",
  "segunda reserva pendiente_pago · cupo 1",
  async () => {
    const e = await especial(ES.publicada);
    const primera = await reservar(e.id, U.ana);
    await q(`select public.cancelar_reserva($1, $2)`, [primera.id, U.ana]);
    const segunda = await reservar(e.id, U.ana);
    return `segunda reserva ${segunda.estado} · cupo ${await cupo(e.id)}`;
  },
);

caso(
  "cancelar una confirmada es `cancelada`, y la plata no se mueve sola",
  "reserva cancelada · compra pagada · sin reembolso · cupo 0",
  async () => {
    const e = await especial(ES.publicada);
    const r = await reservar(e.id, U.ana);
    await q(`select public.acreditar_compra($1, $2)`, [r.compra_id, U.admin]);
    await q(`select public.cancelar_reserva($1, $2)`, [r.id, U.ana]);
    const c = await laCompra(r.compra_id);
    return (
      `reserva ${(await laReserva(r.id)).estado} · compra ${c.estado} · ` +
      `${c.reembolso_monto_clp === null ? "sin reembolso" : `reembolso ${c.reembolso_monto_clp}`} · ` +
      `cupo ${await cupo(e.id)}`
    );
  },
);

caso(
  "el reembolso lo registra admin a mano, y la alumna no puede",
  "compra reembolsada $15000 con autor y fecha · alumna: 42501 · Se necesita rol admin o superior",
  async () => {
    const e = await especial(ES.publicada);
    const r = await reservar(e.id, U.ana);
    await q(`select public.acreditar_compra($1, $2)`, [r.compra_id, U.admin]);
    await q(`select public.cancelar_reserva($1, $2)`, [r.id, U.ana]);
    const negado = await rechazo(
      `select public.registrar_reembolso($1, $2, $3, $4)`,
      [r.compra_id, U.ana, 15000, "La alumna intentando devolverse la plata sola"],
    );
    await q(`select public.registrar_reembolso($1, $2, $3, $4)`, [
      r.compra_id, U.admin, 15000, "Escenario",
    ]);
    const c = await laCompra(r.compra_id);
    return (
      `compra ${c.estado} $${c.reembolso_monto_clp} ` +
      `${c.reembolsada_por ? "con autor" : "sin autor"} y ` +
      `${c.reembolsada_at ? "fecha" : "sin fecha"} · alumna: ${negado}`
    );
  },
);

caso(
  "cuando cancela la academia: la pagada queda por reembolsar y la pendiente expira, no liberada",
  "pagada → reserva cancelada + compra por_reembolsar · pendiente → reserva expirada + compra expirada",
  async () => {
    const e = await especial(ES.publicada);
    const pagada = await reservar(e.id, U.ana);
    await q(`select public.acreditar_compra($1, $2)`, [pagada.compra_id, U.admin]);
    const pendiente = await reservar(e.id, U.bea);
    await q(
      `update public.clases set estado = 'cancelada', motivo_cancelacion = 'Escenario' where id = $1`,
      [e.id],
    );
    return (
      `pagada → reserva ${(await laReserva(pagada.id)).estado} + ` +
      `compra ${(await laCompra(pagada.compra_id)).estado} · ` +
      `pendiente → reserva ${(await laReserva(pendiente.id)).estado} + ` +
      `compra ${(await laCompra(pendiente.compra_id)).estado}`
    );
  },
);

caso(
  "sin sesión se ve la publicada y no el borrador",
  "anon ve 1 de 2",
  async () => {
    await q("savepoint anonimo");
    try {
      await q("set local role anon");
      const { rows } = await q(
        `select count(*)::int as n from public.clases
         where tipo = 'especial' and titulo = any($1)`,
        [[ES.publicada, ES.borrador]],
      );
      return `anon ve ${rows[0].n} de 2`;
    } finally {
      await q("reset role").catch(() => {});
      await q("release savepoint anonimo").catch(() => {});
    }
  },
);

caso(
  "una especial que se pisa con la parrilla no se guarda (§9.3: la duración manda)",
  "23514 · Se pisa con otra clase en esa sede o de esa profesora a esa hora",
  async () => {
    // El caso del PRD es Diaguitas jueves 20:00 contra Reggaeton Femme 19:30.
    // Acá se toma la próxima clase de parrilla que haya y se intenta una media
    // hora después, en su misma sede: es la misma regla, sin depender de que
    // hoy sea un día concreto de la semana.
    const p = await una(
      `select id, sede_id, curso_id, profesora_id, inicio
       from public.clases
       where tipo = 'parrilla' and estado = 'programada' and inicio > now()
       order by inicio limit 1`,
    );
    if (!p) return "staging no tiene clases de parrilla futuras";
    return rechazo(
      `select public.crear_especial(
         p_actor_user_id => $1, p_titulo => 'La que se pisa',
         p_curso_id => $2, p_profesora_id => $3, p_sede_id => $4,
         p_inicio => $5::timestamptz + interval '30 minutes',
         p_precio_clp => 15000)`,
      [U.owner, p.curso_id, p.profesora_id, p.sede_id, p.inicio],
    );
  },
);

caso(
  "sin precio por defecto cargado, admin no puede crear y owner sí",
  "admin: 23514 · Falta el precio por defecto · owner: $15000",
  async () => {
    const e = await especial(ES.publicada);
    // Autocontenido: no depende de que la siembra haya borrado la fila. Esa
    // dependencia invisible se rompió el 11/09 apenas alguien la restituyó.
    await q(`delete from public.parametros where clave = 'especial_precio_default_clp'`);
    const negado = await rechazo(
      `select public.crear_especial(
         p_actor_user_id => $1, p_titulo => 'La de admin sin default',
         p_curso_id => $2, p_profesora_id => $3, p_sede_id => $4,
         p_inicio => now() + interval '20 days')`,
      [U.admin, e.curso_id, e.profesora_id, e.sede_id],
    );
    const { precio } = await una(
      `select (public.crear_especial(
         p_actor_user_id => $1, p_titulo => 'La de owner con precio',
         p_curso_id => $2, p_profesora_id => $3, p_sede_id => $4,
         p_inicio => now() + interval '21 days',
         p_precio_clp => 15000)).precio_clp as precio`,
      [U.owner, e.curso_id, e.profesora_id, e.sede_id],
    );
    return `admin: ${negado.slice(0, negado.indexOf(":"))} · owner: $${precio}`;
  },
);

caso(
  "con el default cargado, el precio que manda admin se ignora y el de owner no",
  "admin $12000 · owner $99000",
  async () => {
    const e = await especial(ES.publicada);
    await q(
      `insert into public.parametros (clave, valor, descripcion)
       values ('especial_precio_default_clp', '12000', 'Escenario')
       on conflict (clave) do update set valor = excluded.valor`,
    );
    const a = await una(
      `select (public.crear_especial(
         p_actor_user_id => $1, p_titulo => 'La de admin con default',
         p_curso_id => $2, p_profesora_id => $3, p_sede_id => $4,
         p_inicio => now() + interval '22 days',
         p_precio_clp => 99000)).precio_clp as precio`,
      [U.admin, e.curso_id, e.profesora_id, e.sede_id],
    );
    const o = await una(
      `select (public.crear_especial(
         p_actor_user_id => $1, p_titulo => 'La de owner con otro precio',
         p_curso_id => $2, p_profesora_id => $3, p_sede_id => $4,
         p_inicio => now() + interval '23 days',
         p_precio_clp => 99000)).precio_clp as precio`,
      [U.owner, e.curso_id, e.profesora_id, e.sede_id],
    );
    return `admin $${a.precio} · owner $${o.precio}`;
  },
);

caso(
  "expirar_reservas_pendientes() cuenta reservas, no compras",
  "expiró 1",
  async () => {
    // La compra se pone en un estado que el barrido no toca: si la función
    // contara el update de `compras`, acá devolvería 0 y diría que no expiró
    // nada, con la reserva expirada igual.
    const e = await especial(ES.publicada);
    const r = await reservar(e.id, U.ana);
    await q(
      `update public.compras
       set estado = 'rechazada', motivo_rechazo = 'No llegó la transferencia'
       where id = $1`,
      [r.compra_id],
    );
    await q(`update public.reservas set expira_at = now() - interval '1 second' where id = $1`, [r.id]);
    const { n } = await una(`select public.expirar_reservas_pendientes($1) as n`, [e.id]);
    return `expiró ${n}`;
  },
);

caso(
  "cancelar una reserva de la parrilla sigue devolviendo el crédito a su lote",
  "crédito +1 · 1 movimiento de cancelacion",
  async () => {
    // Regresión del bloqueo que se agregó en cancelar_reserva (PRD-0017 §18):
    // lo que no puede pasar es que devolver deje de devolver.
    const r = await una(
      `select r.id, r.credito_id, r.perfil_id
       from public.reservas r
       join public.clases c on c.id = r.clase_id
       where r.estado = 'confirmada' and r.credito_id is not null
         and c.inicio > now() + interval '1 hour'
       limit 1`,
    );
    if (!r) return "el escenario no tiene una reserva futura con crédito";
    const { d: antes } = await una(
      `select cantidad_disponible as d from public.creditos where id = $1`,
      [r.credito_id],
    );
    await q(`select public.cancelar_reserva($1, $2)`, [r.id, U.ana]);
    const { d: despues } = await una(
      `select cantidad_disponible as d from public.creditos where id = $1`,
      [r.credito_id],
    );
    const { n } = await una(
      `select count(*)::int as n from public.movimientos_credito
       where reserva_id = $1 and tipo = 'cancelacion'`,
      [r.id],
    );
    return `crédito ${despues - antes > 0 ? "+" : ""}${despues - antes} · ${n} movimiento${n === 1 ? "" : "s"} de cancelacion`;
  },
);

caso(
  "el tablero separa lo que la alumna soltó de lo que dejamos vencer",
  "soltadas 1 · expiradas 1 · por clase cancelada 0",
  async () => {
    const e = await especial(ES.publicada);
    const soltada = await reservar(e.id, U.ana);
    await q(`select public.cancelar_reserva($1, $2)`, [soltada.id, U.ana]);
    const vencida = await reservar(e.id, U.bea);
    await q(`update public.reservas set expira_at = now() - interval '1 second' where id = $1`, [
      vencida.id,
    ]);
    await q(`select public.expirar_reservas_pendientes($1)`, [e.id]);

    const { desde, hasta } = mesEnCurso();
    const [{ metricas_demanda: D }] = await comoUsuario(
      U.owner,
      `select public.metricas_demanda($1, $2)`,
      [desde.toISOString(), hasta.toISOString()],
    );
    return (
      `soltadas ${D.pendientes.soltadas} · expiradas ${D.pendientes.expiradas} · ` +
      `por clase cancelada ${D.pendientes.expiradas_por_clase_cancelada}`
    );
  },
);

caso(
  "una compra de especial entra en los ingresos y no descuadra la conciliación de créditos",
  "ingresos +15000 · conciliación cuadra",
  async () => {
    const e = await especial(ES.publicada);
    const { desde, hasta } = mesEnCurso();
    const periodo = [desde.toISOString(), hasta.toISOString(), desde.toISOString(), hasta.toISOString()];
    const antes = (
      await comoUsuario(U.owner, `select public.metricas_resumen($1, $2, $3, $4)`, periodo)
    )[0].metricas_resumen;

    const r = await reservar(e.id, U.ana);
    await q(`select public.acreditar_compra($1, $2)`, [r.compra_id, U.admin]);

    const despues = (
      await comoUsuario(U.owner, `select public.metricas_resumen($1, $2, $3, $4)`, periodo)
    )[0].metricas_resumen;
    const delta = despues.venta.ingresos_clp - antes.venta.ingresos_clp;
    const cuadra = despues.conciliacion.libro === despues.conciliacion.lotes;
    return `ingresos +${delta} · conciliación ${cuadra ? "cuadra" : "descuadra"}`;
  },
);

// ---------------------------------------------------------------------------
// Corrida
// ---------------------------------------------------------------------------
console.log("\nPRD-0018 fase 3 — escenario de clases especiales en staging\n");
console.log("| Caso | Esperado | Real | |");
console.log("|---|---|---|---|");

let fallas = 0;
for (const { nombre, esperado, fn } of casos) {
  let real;
  await q("begin");
  try {
    real = await fn();
  } catch (e) {
    real = `ERROR ${e.code ?? ""} ${e.message}`;
  } finally {
    await q("rollback").catch(() => {});
  }
  // Los mensajes de Postgres traen el texto completo; alcanza con que el
  // esperado esté contenido, para no fijar en el escenario la puntuación exacta.
  const ok = real === esperado || real.includes(esperado);
  if (!ok) fallas++;
  console.log(`| ${nombre} | ${esperado} | ${real} | ${ok ? "✓" : "✗"} |`);
}

console.log(`\n${casos.length - fallas}/${casos.length} casos como los dice el PRD.`);
if (fallas) console.log("Los ✗ se resuelven antes de tocar producción.");

await cliente.end();
process.exitCode = fallas ? 1 : 0;
