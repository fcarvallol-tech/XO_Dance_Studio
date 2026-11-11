// PRD-0030, parte 1 — la reserva retroactiva: el crédito se evalúa con la fecha
// de la clase, el movimiento va fechado ese día, el vencimiento no se toca, el
// cupo no bloquea, solo owner, y un mes cerrado no se toca por el costado.
// node scripts/base-local/escenario-retroactiva.mjs   (ver base.mjs para instalar PGlite)
import { base } from "./base.mjs";
import { paso, resumen, assert, persona, como, servidor, falla, uno, filas } from "./util.mjs";

const db = await base();
const owner = await persona(db, "owner@xo.test", "Felipe", "owner");
const admin = await persona(db, "admin@xo.test", "Carla", "admin");
const ana = await persona(db, "ana@xo.test", "Ana");
const bea = await persona(db, "bea@xo.test", "Bea");
const cata = await persona(db, "cata@xo.test", "Cata");
const dani = await persona(db, "dani@xo.test", "Dani");

const h = await uno(db, "select id, curso_id, profesora_id, sede_id from horarios where deleted_at is null limit 1");
assert.ok(h, "la base no trae horarios");

/** Una clase de parrilla que empezó hace `dias` días (negativo = en el futuro). */
async function clase(dias, { cupo = 16, estado = "programada", tipo = "parrilla" } = {}) {
  const c = await uno(db, `insert into clases (horario_id, fecha, inicio, fin, curso_id, profesora_id, sede_id, cupo_maximo, estado, tipo)
    values ($1, (now() - make_interval(days => $2))::date, now() - make_interval(days => $2),
            now() - make_interval(days => $2) + interval '1 hour', $3, $4, $5, $6, $7, $8) returning id, inicio`,
    [h.id, dias, h.curso_id, h.profesora_id, h.sede_id, cupo, estado, tipo]);
  return c;
}

/** Un lote creado hace `creado` días que vence en `vence` días (negativo = ya venció), con su movimiento. */
async function lote(quien, cantidad, creado, vence) {
  const c = await uno(db, `insert into creditos (perfil_id, cantidad_inicial, cantidad_disponible, fecha_vencimiento, created_at)
    values ($1, $2, $2, now() + make_interval(days => $3), now() - make_interval(days => $4)) returning id, fecha_vencimiento`,
    [quien.perfilId, cantidad, vence, creado]);
  await db.query(`insert into movimientos_credito (perfil_id, credito_id, tipo, cantidad, saldo_resultante, motivo, creado_por, created_at)
    values ($1, $2, 'regalo', $3, 0, 'semilla', $4, now() - make_interval(days => $5))`,
    [quien.perfilId, c.id, cantidad, owner.perfilId, creado]);
  return c;
}

const retro = (quien, c, motivo, hoy = false, actor = owner) => servidor(db, (tx) =>
  uno(tx, "select public.reservar_retroactiva($1, $2, $3, $4, $5) r", [actor.userId, quien.perfilId, c.id, motivo, hoy])).then((x) => x.r);

const coherente = async () => {
  const r = await uno(db, `select (select coalesce(sum(cantidad),0) from movimientos_credito)::int libro,
    (select coalesce(sum(cantidad_disponible),0) from creditos)::int lotes,
    (select count(*) from creditos where cantidad_disponible < 0)::int negativos`);
  assert.equal(r.libro, r.lotes, `libro ${r.libro} ≠ lotes ${r.lotes}`);
  assert.equal(r.negativos, 0);
};
const metricas = async () => (await como(db, owner, (tx) => uno(tx,
  "select public.metricas_resumen(now() - interval '30 days', now() + interval '1 day', now() - interval '60 days', now() - interval '30 days') m"))).m;

// La clase del caso de Felipe: fue hace 7 días. El lote de Ana se creó hace 10
// días y venció hace 3: estaba vigente el día de la clase, hoy no.
const jueves = await clase(7);
const loteVencido = await lote(ana, 1, 10, -3);
const loteVigente = await lote(ana, 2, 10, 20);
const antes = await metricas();

console.log("\n1. Tenía crédito el día que bailó, aunque hoy esté vencido");
let r;
await paso("se registra, del lote que vencía primero entre los vigentes ese día (el que hoy está vencido)", async () => {
  r = await retro(ana, jueves, "Fue a la clase de Pau del jueves sin reservar");
  assert.equal(r.ok, true);
  assert.equal(r.credito_id, loteVencido.id);
  assert.equal(r.credito_de, "dia_de_la_clase");
  assert.equal(r.lote_vencido_hoy, true);
});
await paso("la fecha de vencimiento del lote no se tocó y el lote vigente de hoy quedó entero", async () => {
  const l = await filas(db, "select id, cantidad_disponible, fecha_vencimiento from creditos where perfil_id = $1", [ana.perfilId]);
  const v = l.find((x) => x.id === loteVencido.id), g = l.find((x) => x.id === loteVigente.id);
  assert.equal(v.cantidad_disponible, 0);
  assert.equal(new Date(v.fecha_vencimiento).getTime(), new Date(loteVencido.fecha_vencimiento).getTime());
  assert.equal(g.cantidad_disponible, 2);
});
await paso("reserva asistio, origen retroactiva, con autor y motivo; registrada hoy", async () => {
  const x = await uno(db, "select estado, origen, creada_por, motivo, credito_id, created_at from reservas where id = $1", [r.reserva_id]);
  assert.deepEqual([x.estado, x.origen, x.creada_por, x.credito_id], ["asistio", "retroactiva", owner.perfilId, loteVencido.id]);
  assert.ok(Date.now() - new Date(x.created_at).getTime() < 60_000);
});
await paso("el movimiento del libro va fechado al inicio de la clase, con motivo y autor", async () => {
  const m = await uno(db, "select tipo, cantidad, created_at, motivo, creado_por from movimientos_credito where reserva_id = $1", [r.reserva_id]);
  assert.deepEqual([m.tipo, m.cantidad, m.creado_por], ["reserva", -1, owner.perfilId]);
  assert.equal(new Date(m.created_at).getTime(), new Date(jueves.inicio).getTime());
});
await paso("libro = lotes, sin negativos", coherente);
await paso("tablero: vencidas_sin_usar baja en 1, consumidas sube en 1, disponibles (vigentes) no cambia", async () => {
  const d = await metricas();
  assert.equal(d.creditos.vencidas_sin_usar, antes.creditos.vencidas_sin_usar - 1);
  assert.equal(d.creditos.consumidas, antes.creditos.consumidas + 1);
  assert.equal(d.creditos.vigentes_regaladas, antes.creditos.vigentes_regaladas);
  assert.equal(d.conciliacion.libro, d.conciliacion.lotes);
});
await paso("la liquidación la cuenta: tiene crédito, no devuelto, y no es pendiente", async () => {
  const n = await uno(db, `select count(*)::int n from reservas r where r.clase_id = $1 and r.credito_id is not null
    and r.credito_devuelto = false and r.estado not in ('pendiente_pago', 'expirada', 'liberada')`, [jueves.id]);
  assert.equal(n.n, 1);
});

console.log("\n2. Entre dos lotes vigentes ese día, el que vencía primero");
const sabado = await clase(5);
const bTarde = await lote(bea, 1, 20, 30);
const bPronto = await lote(bea, 1, 20, 10);
await paso("descuenta el que vence antes", async () => {
  const x = await retro(bea, sabado, "Bailó el sábado, no alcanzó a reservar");
  assert.equal(x.credito_id, bPronto.id);
  assert.notEqual(x.credito_id, bTarde.id);
});

console.log("\n3. Sin crédito ese día: la pregunta vuelve al owner");
const cLoteNuevo = await lote(cata, 4, 2, 28); // compró después de la clase del jueves
await paso("responde sin_credito_ese_dia con lo vigente hoy, y no escribe nada", async () => {
  const antesMov = (await uno(db, "select count(*)::int n from movimientos_credito")).n;
  const x = await retro(cata, jueves, "Bailó el jueves, pagó después");
  assert.deepEqual([x.ok, x.motivo, x.vigentes_hoy], [false, "sin_credito_ese_dia", 4]);
  assert.equal((await uno(db, "select count(*)::int n from movimientos_credito")).n, antesMov);
  assert.equal((await uno(db, "select count(*)::int n from reservas where perfil_id = $1", [cata.perfilId])).n, 0);
});
await paso("si el owner decide usar uno de hoy, sale del lote vigente hoy y queda dicho", async () => {
  const x = await retro(cata, jueves, "Bailó el jueves, pagó después", true);
  assert.deepEqual([x.ok, x.credito_id, x.credito_de], [true, cLoteNuevo.id, "hoy"]);
  await coherente();
});
await paso("sin ningún crédito, ni ese día ni hoy: sin_credito, y nada escrito", async () => {
  const x = await retro(dani, jueves, "Bailó el jueves sin pack", true);
  assert.deepEqual([x.ok, x.motivo], [false, "sin_credito"]);
  assert.equal((await uno(db, "select count(*)::int n from reservas where perfil_id = $1", [dani.perfilId])).n, 0);
});

console.log("\n4. El cupo no bloquea en una clase pasada");
const llena = await clase(3, { cupo: 1 });
await lote(dani, 2, 10, 20);
await servidor(db, (tx) => tx.query("select public.reservar_retroactiva($1, $2, $3, 'Primera de la sala llena', false)", [owner.userId, bea.perfilId, llena.id]));
await paso("con la sala llena, la siguiente se registra igual: fueron las que fueron", async () => {
  const x = await retro(dani, llena, "Fueron 17 en una sala de 16");
  assert.equal(x.ok, true);
  assert.equal((await uno(db, "select public.cupo_tomado($1) n", [llena.id])).n, 2);
});

console.log("\n5. Lo que se rechaza");
await paso("la misma alumna dos veces en la misma clase", () => falla(retro(ana, jueves, "Otra vez la misma"), /Ya tiene una reserva/));
await paso("una clase que todavía no empieza", async () => falla(retro(ana, await clase(-2), "Futura, no corresponde"), /todavía no empieza/));
await paso("una clase cancelada", async () => falla(retro(ana, await clase(4, { estado: "cancelada" }), "Cancelada, nadie bailó"), /se canceló/));
await paso("motivo de menos de 5 caracteres", async () => falla(retro(ana, sabado, "ok"), /al menos 5/));
await paso("admin no puede: 42501, sin escribir nada", async () => {
  await falla(retro(ana, sabado, "Lo intenta la admin", false, admin), /Solo el owner/);
  assert.equal((await uno(db, "select count(*)::int n from reservas where perfil_id = $1 and clase_id = $2", [ana.perfilId, sabado.id])).n, 0);
});
await paso("con sesión de alumna, ni siquiera puede ejecutarla", () =>
  falla(como(db, ana, (tx) => tx.query("select public.reservar_retroactiva($1, $2, $3, 'yo misma', false)", [ana.userId, ana.perfilId, sabado.id])), /permission denied/));
await paso("con sesión de owner tampoco: se llama desde el servidor, que verifica antes", () =>
  falla(como(db, owner, (tx) => tx.query("select public.reservar_retroactiva($1, $2, $3, 'desde el cliente', false)", [owner.userId, ana.perfilId, sabado.id])), /permission denied/));

console.log("\n6. Mes cerrado: se anula el cierre primero");
// La tabla real de la liquidación (20261105140000, en `main` desde el 11/11):
// un cierre con lo mínimo que exigen sus checks.
const mesDe = (await uno(db, "select date_trunc('month', $1::timestamptz at time zone 'America/Santiago')::date m", [sabado.inicio])).m;
const liq = await uno(db, "insert into public.liquidaciones_profesoras (profesora_id, mes, monto_clp, detalle, huella) values ($1, $2, 1000, '{}'::jsonb, 'prueba') returning id", [h.profesora_id, mesDe]);
await paso("con la liquidación de ese mes cerrada, se rechaza y dice qué hacer", () =>
  falla(retro(ana, sabado, "Después del cierre"), /ya está cerrada. Anula el cierre/));
await paso("con ese cierre anulado, se puede", async () => {
  await db.query("update public.liquidaciones_profesoras set anulada_at = now(), deleted_at = now(), anulada_por = $2, motivo_anulacion = 'Prueba local' where id = $1", [liq.id, owner.perfilId]);
  assert.equal((await retro(ana, sabado, "Después de anular el cierre")).ok, true);
});

console.log("\n7. La lista del owner");
await paso("el owner ve las del mes con motivo y autor", async () => {
  const l = await como(db, owner, (tx) => filas(tx, "select * from public.reservas_retroactivas(now() - interval '30 days', now())"));
  assert.equal(l.length, 6);
  assert.ok(l.every((x) => x.autor === "Felipe" && x.motivo.length >= 5));
  assert.equal(l.filter((x) => x.lote_vencido_hoy).length, 1);
});
await paso("admin no la ve", () => falla(como(db, admin, (tx) => tx.query("select * from public.reservas_retroactivas(now() - interval '30 days', now())")), /Solo el owner/));
await paso("una alumna no la ve", () => falla(como(db, ana, (tx) => tx.query("select * from public.reservas_retroactivas(now() - interval '30 days', now())")), /Solo el owner/));
await paso("anon no puede ni ejecutarla", () => falla(db.transaction(async (tx) => {
  await tx.exec("set local role anon");
  await tx.query("select * from public.reservas_retroactivas(now() - interval '30 days', now())");
}), /permission denied/));
await paso("libro = lotes al final", coherente);

resumen();
