// PRD-0026 — escenario completo del pack de amigas contra la base local.
// node scripts/base-local/escenario-pack-amigas.mjs   (ver base.mjs para instalar PGlite)
import { base } from "./base.mjs";
import { paso, resumen, assert, persona, como, servidor, falla, uno, filas } from "./util.mjs";

const db = await base();
const owner = await persona(db, "owner@xo.test", "Felipe", "owner");
const admin = await persona(db, "admin@xo.test", "Carla", "admin");
const ana = await persona(db, "ana@xo.test", "Ana Compradora");
const bea = await persona(db, "Bea@XO.test", "Bea Amiga");     // mayúsculas a propósito
const caro = await persona(db, "caro@xo.test", "Caro Curiosa");
const dani = await persona(db, "dani@xo.test", "Dani");

const buscar = (quien, correo) => servidor(db, (tx) =>
  uno(tx, "select public.buscar_invitada($1, $2) as id", [quien.userId, correo]));
const declarar = (quien, correo, monto = 16000) => servidor(db, (tx) =>
  uno(tx, "select public.declarar_pack_amigas($1, 'pack-amigas', $2, $3, null, null) as r",
    [quien.userId, monto, correo]));
const acreditar = (compraId) => servidor(db, (tx) =>
  uno(tx, "select * from public.acreditar_compra($1, $2, null)", [compraId, admin.userId]));

console.log("\n1. El plan");
await paso("pack-amigas: 2 clases, $16.000, 30 días, activo, 1 para la amiga", async () => {
  const p = await uno(db, "select * from planes where slug = 'pack-amigas'");
  assert.deepEqual([p.cantidad_clases, p.precio_clp, p.vigencia_dias, p.activo, p.clases_para_invitada, p.nombre],
    [2, 16000, 30, true, 1, "Pack de amigas"]);
});
await paso("los planes de antes quedan con 0 para invitada", async () => {
  const r = await filas(db, "select slug from planes where slug <> 'pack-amigas' and clases_para_invitada <> 0");
  assert.equal(r.length, 0);
});
await paso("anon ve el plan nuevo (la vitrina es pública)", async () => {
  const r = await db.transaction(async (tx) => { await tx.exec("set local role anon");
    return filas(tx, "select slug from planes where slug = 'pack-amigas'"); });
  assert.equal(r.length, 1);
});

console.log("\n2. Buscar a la amiga");
await paso("su propio correo se rechaza", async () => {
  await falla(buscar(ana, "  ANA@xo.test "), /tu propio correo/);
});
await paso("un correo sin cuenta devuelve null", async () => {
  assert.equal((await buscar(ana, "nadie@xo.test")).id, null);
});
await paso("un correo con cuenta devuelve su perfil, sin importar mayúsculas ni espacios", async () => {
  assert.equal((await buscar(ana, " bea@xo.TEST ")).id, bea.perfilId);
});
await paso("cada pregunta queda contada, sin el correo", async () => {
  const r = await filas(db, "select encontrada from consultas_invitada where perfil_id = $1 order by created_at", [ana.perfilId]);
  assert.deepEqual(r.map((x) => x.encontrada), [false, true]);
  const cols = await filas(db, "select column_name from information_schema.columns where table_name = 'consultas_invitada'");
  assert.ok(!cols.some((c) => /correo|email/.test(c.column_name)));
});
await paso("límite: la sexta pregunta en una hora se rechaza, y no cuenta", async () => {
  for (let i = 0; i < 5; i++) await buscar(caro, `prueba${i}@xo.test`);
  await falla(buscar(caro, "bea@xo.test"), /demasiadas consultas/);
  const n = await uno(db, "select count(*)::int as n from consultas_invitada where perfil_id = $1", [caro.perfilId]);
  assert.equal(n.n, 5);
});
await paso("límite diario: con 10 en el día, aunque sean viejas de más de una hora", async () => {
  await db.query(`insert into consultas_invitada (perfil_id, encontrada, created_at)
    select $1, false, now() - interval '3 hours' from generate_series(1, 10)`, [dani.perfilId]);
  await falla(buscar(dani, "bea@xo.test"), /demasiadas consultas/);
});
await paso("una sesión no puede llamar buscar_invitada ni leer consultas_invitada", async () => {
  await falla(como(db, ana, (tx) => tx.query("select public.buscar_invitada($1, 'bea@xo.test')", [ana.userId])), /permission denied/);
  await falla(como(db, ana, (tx) => tx.query("select * from consultas_invitada")), /permission denied/);
});
await paso("anon tampoco", async () => {
  await falla(db.transaction(async (tx) => { await tx.exec("set local role anon");
    await tx.query("select public.buscar_invitada($1, 'bea@xo.test')", [ana.userId]); }), /permission denied/);
});

console.log("\n3. Declarar sin pasar por la función");
const planAmigas = (await uno(db, "select id from planes where slug = 'pack-amigas'")).id;
const planPack2 = (await uno(db, "select id from planes where slug = 'pack-2'")).id;
await paso("insert directo del plan de amigas: se rechaza (le falta la amiga)", async () => {
  await falla(como(db, ana, (tx) => tx.query(
    "insert into compras (perfil_id, plan_id, cantidad_clases, monto_clp) values ($1, $2, 2, 16000)",
    [ana.perfilId, planAmigas])), /necesita el correo de tu amiga/);
});
await paso("insert directo nombrando invitada: sin permiso de columna", async () => {
  await falla(como(db, ana, (tx) => tx.query(
    "insert into compras (perfil_id, plan_id, cantidad_clases, monto_clp, perfil_invitada_id, cantidad_invitada) values ($1, $2, 2, 16000, $3, 1)",
    [ana.perfilId, planAmigas, bea.perfilId])), /permission denied/);
});
await paso("un pack-2 normal se sigue declarando igual que antes", async () => {
  await como(db, ana, (tx) => tx.query(
    "insert into compras (perfil_id, plan_id, cantidad_clases, monto_clp) values ($1, $2, 2, 16000)",
    [ana.perfilId, planPack2]), { revertir: true });
});

console.log("\n4. Declarar, aprobar, y los dos lotes");
let compraId;
await paso("declarar con un correo sin cuenta: no crea compra, y cuenta el intento", async () => {
  const antes = (await uno(db, "select count(*)::int n from consultas_invitada where perfil_id = $1", [ana.perfilId])).n;
  const r = (await declarar(ana, "nadie2@xo.test")).r;
  assert.deepEqual(r, { ok: false, motivo: "sin_cuenta" });
  assert.equal((await uno(db, "select count(*)::int n from compras where perfil_id = $1", [ana.perfilId])).n, 0);
  assert.equal((await uno(db, "select count(*)::int n from consultas_invitada where perfil_id = $1", [ana.perfilId])).n, antes + 1);
});
await paso("declarar con el correo de Bea: una compra pendiente, invitada y cantidad congeladas", async () => {
  const r = (await declarar(ana, "bea@xo.test")).r;
  assert.equal(r.ok, true);
  compraId = r.compra_id;
  const c = await uno(db, "select * from compras where id = $1", [compraId]);
  assert.deepEqual([c.estado, c.perfil_id, c.perfil_invitada_id, c.cantidad_clases, c.cantidad_invitada, c.monto_clp],
    ["pendiente", ana.perfilId, bea.perfilId, 2, 1, 16000]);
});
await paso("la invitada no se puede cambiar después de declarada", async () => {
  await falla(db.query("update compras set perfil_invitada_id = $1 where id = $2", [caro.perfilId, compraId]), /no se cambia/);
});
await paso("aprobar: dos lotes, mismo compra_id, uno por perfil, 1 clase cada uno, mismo vencimiento ~30 días", async () => {
  const c = await acreditar(compraId);
  assert.equal(c.estado, "pagada");
  const lotes = await filas(db, `select perfil_id, cantidad_inicial, cantidad_disponible, fecha_vencimiento,
    extract(epoch from fecha_vencimiento - now())/86400 as dias from creditos where compra_id = $1 order by perfil_id = $2 desc`,
    [compraId, ana.perfilId]);
  assert.equal(lotes.length, 2);
  assert.deepEqual(lotes.map((l) => [l.perfil_id, l.cantidad_inicial, l.cantidad_disponible]),
    [[ana.perfilId, 1, 1], [bea.perfilId, 1, 1]]);
  assert.equal(String(lotes[0].fecha_vencimiento), String(lotes[1].fecha_vencimiento));
  assert.ok(Math.abs(lotes[0].dias - 30) < 0.01, `vence en ${lotes[0].dias} días`);
});
await paso("dos movimientos tipo compra, cada uno con el saldo de su dueña", async () => {
  const m = await filas(db, `select m.perfil_id, m.tipo, m.cantidad, m.saldo_resultante from movimientos_credito m
    join creditos c on c.id = m.credito_id where c.compra_id = $1 order by m.perfil_id = $2 desc`, [compraId, ana.perfilId]);
  assert.deepEqual(m.map((x) => [x.perfil_id, x.tipo, x.cantidad, x.saldo_resultante]),
    [[ana.perfilId, "compra", 1, 1], [bea.perfilId, "compra", 1, 1]]);
});
await paso("aprobar de nuevo no crea nada (idempotente)", async () => {
  await acreditar(compraId);
  assert.equal((await uno(db, "select count(*)::int n from creditos where compra_id = $1", [compraId])).n, 2);
  assert.equal((await uno(db, "select count(*)::int n from movimientos_credito where tipo = 'compra'")).n, 2);
});
await paso("libro = lotes, por persona y en total", async () => {
  const r = await filas(db, `select p.id, coalesce((select sum(cantidad) from movimientos_credito where perfil_id = p.id),0)::int libro,
    coalesce((select sum(cantidad_disponible) from creditos where perfil_id = p.id),0)::int lotes from perfiles p`);
  for (const x of r) assert.equal(x.libro, x.lotes, x.id);
});

console.log("\n5. Lo que ve cada una");
await paso("Bea ve su lote (1 clase) y su saldo, pero no la compra de Ana", async () => {
  const r = await como(db, bea, async (tx) => ({
    lotes: await filas(tx, "select cantidad_disponible from creditos"),
    compras: await filas(tx, "select id from compras"),
  }));
  assert.deepEqual(r.lotes.map((l) => l.cantidad_disponible), [1]);
  assert.equal(r.compras.length, 0);
});
await paso("Ana ve su compra y solo su lote, no el de Bea", async () => {
  const r = await como(db, ana, async (tx) => ({
    lotes: await filas(tx, "select perfil_id from creditos"),
    compras: await filas(tx, "select id from compras"),
  }));
  assert.equal(r.compras.length, 1);
  assert.deepEqual(r.lotes.map((l) => l.perfil_id), [ana.perfilId]);
});
await paso("Caro (otra alumna) no ve nada de esto", async () => {
  const r = await como(db, caro, async (tx) => ({
    lotes: await filas(tx, "select 1 from creditos"), compras: await filas(tx, "select 1 from compras") }));
  assert.equal(r.lotes.length + r.compras.length, 0);
});

console.log("\n6. El tablero");
await paso("metricas_resumen: una compra, $16.000, dos vendidas, cero regaladas", async () => {
  const m = (await como(db, owner, (tx) => uno(tx,
    "select public.metricas_resumen(now() - interval '1 day', now() + interval '1 day', now() - interval '3 days', now() - interval '1 day') m"))).m;
  assert.equal(m.venta.compras, 1);
  assert.equal(Number(m.venta.ingresos_clp), 16000);
  assert.equal(m.creditos.vendidas, 2);
  assert.equal(m.creditos.regaladas, 0);
  assert.equal(m.creditos.vigentes_vendidas, 2);
  assert.equal(m.creditos.vigentes_regaladas, 0);
  assert.deepEqual(m.venta.por_plan.map((p) => [p.slug, p.compras, Number(p.monto_clp)]), [["pack-amigas", 1, 16000]]);
  assert.equal(m.conciliacion.libro, m.conciliacion.lotes);
  console.log("     ", JSON.stringify({ venta: { compras: m.venta.compras, ingresos: m.venta.ingresos_clp }, creditos: { vendidas: m.creditos.vendidas, regaladas: m.creditos.regaladas }, conciliacion: m.conciliacion, con_compra: m.alumnas.con_compra }));
});

console.log("\n7. Rechazo y anulación");
// El límite de 5 por hora ya se gastó arriba: cada compra son dos preguntas
// (comprobar y declarar). Se limpian para seguir probando otra cosa.
const limpiar = () => db.query("delete from consultas_invitada where perfil_id = $1", [ana.perfilId]);
await limpiar();
await paso("rechazar antes de aprobar: ningún lote para nadie", async () => {
  const r = (await declarar(ana, "bea@xo.test")).r;
  await servidor(db, (tx) => tx.query("select public.rechazar_compra($1, $2, 'No llegó la plata')", [r.compra_id, admin.userId]));
  assert.equal((await uno(db, "select count(*)::int n from creditos where compra_id = $1", [r.compra_id])).n, 0);
  assert.equal((await uno(db, "select estado from compras where id = $1", [r.compra_id])).estado, "rechazada");
});
await paso("anular una compra pendiente: se puede", async () => {
  const r = (await declarar(ana, "bea@xo.test")).r;
  await db.query("update compras set deleted_at = now() where id = $1", [r.compra_id]);
});
// Anular una compra con clases vivas: el candado vive en la migración de
// PRD-0024 y se prueba en escenario-revocar.mjs.

console.log("\n8. Bordes");
await limpiar();
await paso("si la amiga borró su cuenta antes de la aprobación, no se acredita nada", async () => {
  const r = (await declarar(dani.perfilId ? ana : ana, "caro@xo.test")).r;
  await db.query("update perfiles set deleted_at = now() where id = $1", [caro.perfilId]);
  await falla(acreditar(r.compra_id), /ya no existe/);
  assert.equal((await uno(db, "select count(*)::int n from creditos where compra_id = $1", [r.compra_id])).n, 0);
  assert.equal((await uno(db, "select estado from compras where id = $1", [r.compra_id])).estado, "pendiente");
});
await paso("un pack-2 normal aprobado: un solo lote de 2, como siempre", async () => {
  const c = await uno(db, "insert into compras (perfil_id, plan_id, cantidad_clases, monto_clp) values ($1, $2, 2, 16000) returning id", [bea.perfilId, planPack2]);
  await acreditar(c.id);
  const l = await filas(db, "select perfil_id, cantidad_inicial from creditos where compra_id = $1", [c.id]);
  assert.deepEqual(l.map((x) => [x.perfil_id, x.cantidad_inicial]), [[bea.perfilId, 2]]);
});
await paso("declarar con un plan que no es para dos: se rechaza", async () => {
  await falla(servidor(db, (tx) => tx.query("select public.declarar_pack_amigas($1, 'pack-2', 16000, 'bea@xo.test')", [ana.userId])), /no es para dos/);
});

resumen();
