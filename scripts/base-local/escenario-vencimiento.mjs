// PRD-0032 — el aviso de vencimiento: qué se encola, cuánto dice, y quién
// puede preguntar. Contra una base local con todas las migraciones.
// node scripts/base-local/escenario-vencimiento.mjs   (ver base.mjs para instalar PGlite)
//
// Las fechas son relativas a `now()` real: la función descarta lo ya vencido
// con `now()`, y `p_hoy` se calcula desde los lotes para que el escenario dé lo
// mismo el día que se corra.
import { base } from "./base.mjs";
import { paso, resumen, assert, persona, como, servidor, falla, uno, filas } from "./util.mjs";

const db = await base();
const owner = await persona(db, "owner@xo.test", "Felipe Carvallo", "owner");
const admin = await persona(db, "admin@xo.test", "Carla", "admin");
// Una profesora necesita su identidad (perfiles_profesora_con_identidad).
const profe = await persona(db, "pau@xo.test", "Pau");
await db.exec("alter table public.perfiles disable trigger user");
await db.query("update public.perfiles set rol = 'profesora', profesora_id = 'pau' where id = $1", [profe.perfilId]);
await db.exec("alter table public.perfiles enable trigger user");
const ana = await persona(db, "ana@xo.test", "Ana María Rojas");
const bea = await persona(db, "bea@xo.test", "Bea");
const cata = await persona(db, "cata@xo.test", "Cata");
const dani = await persona(db, "dani@xo.test", "Dani");
const emi = await persona(db, "emi@xo.test", "Emi");

// "Hoy" en Chile, y lotes que vencen a mediodía de Chile N días después.
const HOY = (await uno(db, "select (now() at time zone 'America/Santiago')::date::text d")).d;
const dia = async (n) => (await uno(db, "select ($1::date + $2::int)::text d", [HOY, n])).d;
const D3 = await dia(3), D10 = await dia(10), D15 = await dia(15);

async function lote(quien, disponible, enDias, inicial = disponible) {
  const r = await uno(db, `insert into creditos (perfil_id, cantidad_inicial, cantidad_disponible, fecha_vencimiento)
    values ($1, $2, $3, (($4::date + $5::int)::timestamp + time '12:00') at time zone 'America/Santiago') returning id`,
    [quien.perfilId, inicial, disponible, HOY, enDias]);
  return r.id;
}

await lote(ana, 2, 10);            // el caso del §9: 10 días, 2 clases
await lote(ana, 1, 10, 4);         // otro lote de Ana el mismo día: se suma → 3
await lote(ana, 2, 15);            // Ana, otra fecha: todavía no toca
await lote(bea, 0, 10, 4);         // usó todo: no hay fila
await lote(cata, 2, 9);            // barrido saltado: 9 días, sí
await lote(dani, 2, 2);            // 2 días: tarde, no
await lote(emi, 3, 3);             // 3 días: el último día que sí
await lote(profe, 5, 10);          // profesora con regalo: no

const pendientes = (hoy = HOY) => servidor(db, (tx) =>
  filas(tx, "select perfil_id, correo, nombre, vence::text, clases from public.avisos_de_vencimiento_pendientes($1)", [hoy]));
const cuanto = (quien, vence) => servidor(db, (tx) =>
  filas(tx, "select clases from public.avisos_de_vencimiento_pendientes($1, $2, $3)", [HOY, quien.perfilId, vence]));
const clave = (quien, vence) => `vencimiento:${quien.perfilId}:${vence}`;

console.log(`\nHoy (Chile): ${HOY}`);

console.log("\n1. Qué se encola hoy");
const hoy = await pendientes();
const de = (q) => hoy.filter((f) => f.perfil_id === q.perfilId);
await paso("Ana: una fila por la fecha de los 10 días, con la suma de sus dos lotes (3)", async () => {
  assert.deepEqual(de(ana).map((f) => [f.vence, f.clases]), [[D10, 3]]);
  assert.equal(de(ana)[0].correo, "ana@xo.test");
  assert.equal(de(ana)[0].nombre, "Ana María Rojas");
});
await paso("Bea, con 0 disponible, no aparece", async () => assert.equal(de(bea).length, 0));
await paso("Cata, con 9 días (barrido saltado), sí", async () =>
  assert.deepEqual(de(cata).map((f) => f.clases), [2]));
await paso("Emi, con 3 días, sí; Dani, con 2, no", async () => {
  assert.equal(de(emi).length, 1);
  assert.equal(de(dani).length, 0);
});
await paso("la profesora con créditos no aparece", async () => assert.equal(de(profe).length, 0));
await paso("son exactamente tres filas: Ana, Cata y Emi", async () => assert.equal(hoy.length, 3));

console.log("\n2. Una vez y no más");
await paso("con la fila encolada, Ana ya no aparece en un segundo barrido del mismo día", async () => {
  await servidor(db, (tx) => tx.query("select public.encolar_correo('vencimientoProximo', 'ana@xo.test', '{}'::jsonb, $1)",
    [clave(ana, D10)]));
  const otra = await pendientes();
  assert.equal(otra.filter((f) => f.perfil_id === ana.perfilId).length, 0);
  assert.equal(otra.length, 2);
});
await paso("encolar dos veces la misma clave deja una sola fila", async () => {
  await servidor(db, (tx) => tx.query("select public.encolar_correo('vencimientoProximo', 'ana@xo.test', '{}'::jsonb, $1)",
    [clave(ana, D10)]));
  const n = await uno(db, "select count(*)::int n from envios_correo where clave_idempotencia = $1", [clave(ana, D10)]);
  assert.equal(n.n, 1);
});
await paso("un aviso descartado también cuenta como avisado", async () => {
  const f = await servidor(db, (tx) => uno(tx,
    "select (public.encolar_correo('vencimientoProximo', 'emi@xo.test', '{}'::jsonb, $1, null, 'prueba')).estado e",
    [clave(emi, D3)]));
  assert.equal(f.e, "descartado");
  assert.equal((await pendientes()).filter((x) => x.perfil_id === emi.perfilId).length, 0);
});

console.log("\n3. El otro lote de Ana, el día que le toque");
await paso("cinco días después, su lote de 15 días aparece solo, con su fecha", async () => {
  const despues = await uno(db, "select ($1::date + 5)::text d", [HOY]);
  const f = (await pendientes(despues.d)).filter((x) => x.perfil_id === ana.perfilId);
  assert.deepEqual(f.map((x) => [x.vence, x.clases]), [[D15, 2]]);
});

console.log("\n4. El chequeo al enviar: lo que le queda ahora");
await paso("Ana, con la fila ya encolada, sigue respondiendo 3", async () =>
  assert.deepEqual((await cuanto(ana, D10)).map((f) => f.clases), [3]));
await paso("si reserva una, dice 2", async () => {
  await db.query("update creditos set cantidad_disponible = cantidad_disponible - 1 where perfil_id = $1 and cantidad_disponible = 1",
    [ana.perfilId]);
  assert.deepEqual((await cuanto(ana, D10)).map((f) => f.clases), [2]);
});
await paso("si las usó todas, no hay fila (queda descartado)", async () => {
  await db.query("update creditos set cantidad_disponible = 0 where perfil_id = $1 and fecha_vencimiento < now() + interval '12 days'",
    [ana.perfilId]);
  assert.equal((await cuanto(ana, D10)).length, 0);
});
await paso("con persona y sin fecha, se niega", async () =>
  falla(servidor(db, (tx) => tx.query("select * from public.avisos_de_vencimiento_pendientes($1, $2)", [HOY, ana.perfilId])),
    /fecha de vencimiento/));

console.log("\n5. Quién la puede ejecutar: solo service_role");
for (const [nombre, quien] of [["owner", owner], ["admin", admin], ["alumna", bea], ["profesora", profe]]) {
  await paso(`${nombre}: sin permiso`, () =>
    falla(como(db, quien, (tx) => tx.query("select * from public.avisos_de_vencimiento_pendientes($1)", [HOY])),
      /permission denied/));
}
await paso("anon: sin permiso", () =>
  falla(db.transaction(async (tx) => {
    await tx.exec("set local role anon");
    await tx.query("select * from public.avisos_de_vencimiento_pendientes($1)", [HOY]);
  }), /permission denied/));
await paso("los privilegios escritos: execute solo para service_role (y el dueño)", async () => {
  const r = await uno(db, `select array_agg(distinct grantee::regrole::text order by grantee::regrole::text) quienes
    from (select (aclexplode(proacl)).grantee from pg_proc where proname = 'avisos_de_vencimiento_pendientes') a`);
  assert.ok(!r.quienes.includes("anon") && !r.quienes.includes("authenticated") && !r.quienes.includes("-"),
    `tiene: ${r.quienes}`);
  assert.ok(r.quienes.includes("service_role"), `tiene: ${r.quienes}`);
});

resumen();
