// PRD-0024 — revocar créditos: el escenario que pidió Felipe (sobra, justo,
// de más) más permisos por rol, candado de duplicados y el tablero.
// node scripts/base-local/escenario-revocar.mjs   (ver base.mjs para instalar PGlite)
import { base } from "./base.mjs";
import { paso, resumen, assert, persona, como, servidor, falla, uno, filas } from "./util.mjs";

const db = await base();
const owner = await persona(db, "owner@xo.test", "Felipe", "owner");
const admin = await persona(db, "admin@xo.test", "Carla", "admin");
const ana = await persona(db, "ana@xo.test", "Ana");
const bea = await persona(db, "bea@xo.test", "Bea");

/** Siembra un lote con su movimiento, para que libro = lotes desde el principio. */
async function lote(quien, cantidad, dias, tipo = "regalo") {
  const c = await uno(db, `insert into creditos (perfil_id, cantidad_inicial, cantidad_disponible, fecha_vencimiento)
    values ($1, $2, $2, now() + make_interval(days => $3)) returning id`, [quien.perfilId, cantidad, dias]);
  await db.query(`insert into movimientos_credito (perfil_id, credito_id, tipo, cantidad, saldo_resultante, motivo, creado_por)
    values ($1, $2, $3, $4, 0, 'semilla', $5)`, [quien.perfilId, c.id, tipo, cantidad, owner.perfilId]);
  return c.id;
}

const loteVencido = await lote(ana, 1, -1);  // vencido ayer: no se toca ni cuenta
const lotePronto = await lote(ana, 2, 10);   // vence primero
const loteTarde = await lote(ana, 3, 20);    // vence después
await lote(bea, 2, 15, "compra");

const revocar = (quien, cantidad, motivo, actor = owner) => servidor(db, (tx) =>
  uno(tx, "select public.revocar_creditos($1, $2, $3, $4) as lotes", [quien.perfilId, cantidad, motivo, actor.userId]));
const disponibles = async () => Object.fromEntries((await filas(db,
  "select id, cantidad_disponible from creditos where perfil_id = $1", [ana.perfilId])).map((r) => [r.id, r.cantidad_disponible]));
const vigente = async (quien) => (await uno(db, "select public.saldo_creditos($1) s", [quien.perfilId])).s;

async function coherente(quien) {
  const r = await uno(db, `select
      (select coalesce(sum(cantidad),0) from movimientos_credito where perfil_id = $1)::int libro,
      (select coalesce(sum(cantidad_disponible),0) from creditos where perfil_id = $1)::int lotes,
      (select saldo_resultante from movimientos_credito where perfil_id = $1 and tipo = 'revocacion'
         order by created_at desc, saldo_resultante asc limit 1) ultimo_saldo,
      public.saldo_creditos($1) saldo`, [quien.perfilId]);
  assert.equal(r.libro, r.lotes, `libro ${r.libro} ≠ lotes ${r.lotes}`);
  if (r.ultimo_saldo !== null) assert.equal(r.ultimo_saldo, r.saldo, "último saldo_resultante ≠ saldo_creditos()");
  assert.ok(r.saldo >= 0, "saldo negativo");
  return r;
}

const metricas = async () => (await como(db, owner, (tx) => uno(tx,
  "select public.metricas_resumen(now() - interval '1 day', now() + interval '1 day', now() - interval '3 days', now() - interval '1 day') m"))).m;
const antes = await metricas();

console.log("\nEstado inicial de Ana: 1 vencida, 2 que vencen en 10 días, 3 en 20 días → saldo vigente 5");
await paso("saldo vigente 5, libro = lotes", async () => { assert.equal(await vigente(ana), 5); await coherente(ana); });

console.log("\n1. Saldo de sobra: quitar 3 de 5");
await paso("toca dos lotes, empezando por el que vence primero; el vencido no se toca", async () => {
  assert.equal((await revocar(ana, 3, "Regalé 3 de más el 04/11")).lotes, 2);
  const d = await disponibles();
  assert.deepEqual([d[lotePronto], d[loteTarde], d[loteVencido]], [0, 2, 1]);
});
await paso("un movimiento revocacion por lote, negativos, con motivo y autor", async () => {
  const m = await filas(db, `select credito_id, cantidad, motivo, creado_por, saldo_resultante from movimientos_credito
    where perfil_id = $1 and tipo = 'revocacion' order by saldo_resultante desc`, [ana.perfilId]);
  assert.deepEqual(m.map((x) => [x.credito_id, x.cantidad, x.saldo_resultante]), [[lotePronto, -2, 3], [loteTarde, -1, 2]]);
  assert.ok(m.every((x) => x.motivo === "Regalé 3 de más el 04/11" && x.creado_por === owner.perfilId));
});
await paso("saldo 2 y libro coherente", async () => { assert.equal(await vigente(ana), 2); await coherente(ana); });

console.log("\n2. Candado de duplicados");
await paso("la misma revocación enseguida se rechaza y no quita dos veces", async () => {
  await falla(revocar(ana, 3, "Regalé 3 de más el 04/11"), /hace un momento/);
  assert.equal(await vigente(ana), 2);
});

console.log("\n3. Exactamente lo que hay: quitar 2 de 2");
await paso("queda en 0, ningún lote negativo", async () => {
  assert.equal((await revocar(ana, 2, "Corrige el regalo del 01/11")).lotes, 1);
  assert.equal(await vigente(ana), 0);
  const neg = await uno(db, "select count(*)::int n from creditos where cantidad_disponible < 0");
  assert.equal(neg.n, 0);
  await coherente(ana);
});

console.log("\n4. De más");
await paso("con saldo 0, quitar 1: se rechaza y no cambia nada", async () => {
  const libroAntes = await filas(db, "select id from movimientos_credito order by id");
  const lotesAntes = await disponibles();
  await falla(revocar(ana, 1, "Una más por si acaso"), /Tiene 0 clases vigentes: no se pueden quitar 1/);
  assert.deepEqual(await disponibles(), lotesAntes);
  assert.deepEqual(await filas(db, "select id from movimientos_credito order by id"), libroAntes);
  await coherente(ana);
});
await paso("Bea tiene 2, pedir 3: se rechaza entero, no quita las 2 que hay", async () => {
  await falla(revocar(bea, 3, "Pack mal cargado"), /Tiene 2 clases vigentes: no se pueden quitar 3/);
  assert.equal(await vigente(bea), 2);
  assert.equal((await uno(db, "select count(*)::int n from movimientos_credito where perfil_id = $1 and tipo = 'revocacion'", [bea.perfilId])).n, 0);
  await coherente(bea);
});

console.log("\n5. Validaciones");
await paso("motivo de menos de 5 caracteres", async () => { await falla(revocar(bea, 1, " ok  "), /al menos 5/); });
await paso("cantidad 0 o negativa", async () => {
  await falla(revocar(bea, 0, "Motivo largo"), /al menos 1/);
  await falla(revocar(bea, -2, "Motivo largo"), /al menos 1/);
});
await paso("persona que no existe", async () => {
  await falla(servidor(db, (tx) => tx.query("select public.revocar_creditos(gen_random_uuid(), 1, 'Motivo largo', $1)", [owner.userId])), /no existe/);
});
await paso("no se puede escribir a mano una revocación positiva o sin motivo", async () => {
  await falla(db.query(`insert into movimientos_credito (perfil_id, tipo, cantidad, saldo_resultante) values ($1, 'revocacion', 1, 0)`, [bea.perfilId]), /movimientos_revocacion_completa/);
});

console.log("\n6. Quién puede");
await paso("admin no puede revocar (la función lo rechaza adentro)", async () => {
  await falla(revocar(bea, 1, "Intento de admin", admin), /Solo el owner/);
  assert.equal(await vigente(bea), 2);
});
await paso("alumna no puede revocar aunque pase su propio user_id", async () => {
  await falla(revocar(bea, 1, "Me quito una", bea), /Solo el owner/);
});
await paso("ninguna sesión llama la función directo: owner, admin, alumna, anon", async () => {
  for (const quien of [owner, admin, bea]) {
    await falla(como(db, quien, (tx) => tx.query("select public.revocar_creditos($1, 1, 'Motivo largo', $2)", [bea.perfilId, owner.userId])), /permission denied/);
  }
  await falla(db.transaction(async (tx) => { await tx.exec("set local role anon");
    await tx.query("select public.revocar_creditos($1, 1, 'Motivo largo', $2)", [bea.perfilId, owner.userId]); }), /permission denied/);
});
await paso("revocaciones_recientes: owner ve una fila por revocación, con motivo y autor", async () => {
  const r = await como(db, owner, (tx) => filas(tx, "select * from public.revocaciones_recientes()"));
  assert.deepEqual(r.map((x) => [x.alumna, x.cantidad, x.lotes, x.motivo, x.autor]),
    [["Ana", 2, 1, "Corrige el regalo del 01/11", "Felipe"], ["Ana", 3, 2, "Regalé 3 de más el 04/11", "Felipe"]]);
});
await paso("revocaciones_recientes: admin y alumna rechazados, anon sin permiso", async () => {
  await falla(como(db, admin, (tx) => tx.query("select * from public.revocaciones_recientes()")), /Solo el owner/);
  await falla(como(db, ana, (tx) => tx.query("select * from public.revocaciones_recientes()")), /Solo el owner/);
  await falla(db.transaction(async (tx) => { await tx.exec("set local role anon");
    await tx.query("select * from public.revocaciones_recientes()"); }), /permission denied/);
});
await paso("Ana ve sus movimientos de revocación, pero no el motivo", async () => {
  const r = await como(db, ana, (tx) => filas(tx, "select cantidad from movimientos_credito where tipo = 'revocacion'"));
  assert.equal(r.length, 3);
  await falla(como(db, ana, (tx) => tx.query("select motivo from movimientos_credito")), /permission denied/);
});
await paso("Bea no ve las revocaciones de Ana", async () => {
  const r = await como(db, bea, (tx) => filas(tx, "select 1 from movimientos_credito where tipo = 'revocacion'"));
  assert.equal(r.length, 0);
});

console.log("\n7. El tablero, antes y después");
await paso("revocadas es línea propia; vendidas, regaladas y consumidas no cambian; el pasivo baja; el libro concilia", async () => {
  const despues = await metricas();
  const c = (m) => m.creditos;
  assert.equal(c(antes).revocadas, 0);
  assert.equal(c(despues).revocadas, 5);
  assert.equal(c(despues).revocadas_historico, 5);
  assert.equal(despues.creditos_anterior.revocadas, 0);
  for (const k of ["vendidas", "regaladas", "consumidas"]) assert.equal(c(despues)[k], c(antes)[k], k);
  assert.equal(c(antes).vigentes_regaladas - c(despues).vigentes_regaladas, 5);
  assert.equal(c(despues).vigentes_vendidas, c(antes).vigentes_vendidas);
  assert.equal(despues.conciliacion.libro, despues.conciliacion.lotes);
  assert.equal(despues.venta.ingresos_clp, antes.venta.ingresos_clp);
  console.log("      antes:", JSON.stringify({ vendidas: c(antes).vendidas, regaladas: c(antes).regaladas, revocadas: c(antes).revocadas, vigentes_regaladas: c(antes).vigentes_regaladas, conciliacion: antes.conciliacion }));
  console.log("      después:", JSON.stringify({ vendidas: c(despues).vendidas, regaladas: c(despues).regaladas, revocadas: c(despues).revocadas, vigentes_regaladas: c(despues).vigentes_regaladas, conciliacion: despues.conciliacion }));
});

resumen();
