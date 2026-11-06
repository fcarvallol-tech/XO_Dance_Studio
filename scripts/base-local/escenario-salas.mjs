// PRD-0027 §7.5 — "otra sala", contra la base local: la capacidad obligatoria, la
// comparación por dirección, que no se liste como sede y que el costo no salga.
// node scripts/base-local/escenario-salas.mjs   (ver base.mjs para instalar PGlite)
import { base } from "./base.mjs";
import { paso, resumen, assert, persona, como, servidor, falla, uno } from "./util.mjs";

const db = await base();
const owner = await persona(db, "owner@xo.test", "Felipe", "owner");
const admin = await persona(db, "admin@xo.test", "Carla", "admin");
const pau = await persona(db, "pau@xo.test", "Pau");
const ana = await persona(db, "ana@xo.test", "Ana");
await db.exec("alter table public.perfiles disable trigger user");
await db.query("update perfiles set rol = 'profesora', profesora_id = 'pau' where id = $1", [pau.perfilId]);
await db.exec("alter table public.perfiles enable trigger user");

const crear = (actor, nombre, direccion, capacidad = 12, costo = 15000, comuna = "Ñuñoa", esOtra = false) =>
  servidor(db, (tx) => uno(tx,
    "select * from public.crear_sala_ocasional($1, $2, $3, $4, $5, $6, $7)",
    [actor.userId, nombre, direccion, comuna, capacidad, costo, esOtra]));
const comparable = (d) => uno(db, "select public.direccion_comparable($1) d", [d]).then((r) => r.d);

console.log("\n1. Comparar por dirección");
await paso("las direcciones reales: Studio 98 escrita de tres formas es la misma", async () => {
  const a = await comparable("Barros Borgoño 71, oficina 101");
  assert.equal(a, "barros borgono 71");
  assert.equal(await comparable("Barros Borgoño 71 of. 101"), a);
  assert.equal(await comparable("barros borgono #71"), a);
  assert.equal(await comparable("Calle Barros Borgoño N° 71"), a);
});
await paso("Los Leones: el prefijo y el local no cambian la dirección", async () => {
  assert.equal(await comparable("Av. Nueva Providencia 2260, local 130, piso 3"), await comparable("Nueva Providencia 2260"));
  assert.equal(await comparable("Avenida Nueva Providencia 2260"), "nueva providencia 2260");
});
await paso("otro número es otra dirección", async () => {
  assert.notEqual(await comparable("Barros Borgoño 71"), await comparable("Barros Borgoño 710"));
});
await paso("Studio 98 por otro nombre: no crea, ofrece la que existe y no trae costo", async () => {
  const antes = (await uno(db, "select count(*)::int n from sedes")).n;
  const r = await crear(admin, "Manuel Montt", "Barros Borgoño 71");
  assert.equal(r.creada, false);
  assert.equal(r.nombre, "Studio 98");
  assert.equal(r.ocasional, false);
  assert.ok(!("costo_hora_clp" in r));
  assert.equal((await uno(db, "select count(*)::int n from sedes")).n, antes);
});
await paso("'Es otra sala': con la misma dirección, crea igual", async () => {
  const r = await crear(admin, "Sala B del edificio", "Barros Borgoño 71, oficina 305", 10, 9000, "Providencia", true);
  assert.equal(r.creada, true);
  await db.query("delete from sedes where id = $1", [r.id]);
});
await paso("una retirada no se ofrece ni se duplica", async () => {
  await db.query("update sedes set activa = false where slug = 'eb-dance-studio'");
  await falla(crear(admin, "EB", "Chucre Manzur 7"), /retirada/);
  await db.query("update sedes set activa = true where slug = 'eb-dance-studio'");
});

console.log("\n2. Lo obligatorio");
await paso("sin capacidad no se guarda, aunque la columna tenga default", async () => {
  await falla(crear(admin, "Sala X", "Irarrázaval 100", null), /capacidad/);
  await falla(crear(admin, "Sala X", "Irarrázaval 100", 0), /capacidad/);
});
await paso("sin precio no se guarda", async () => {
  await falla(crear(admin, "Sala X", "Irarrázaval 100", 12, null), /precio/);
});
await paso("sin dirección no se guarda", async () => {
  await falla(crear(admin, "Sala X", "  "), /dirección/);
});

console.log("\n3. Crearla");
let sala;
await paso("admin la crea: capacidad 12, precio guardado, ocasional y activa", async () => {
  sala = await crear(admin, "Sala Ñuñoa", "Irarrázaval 100, piso 2");
  assert.deepEqual([sala.creada, sala.capacidad, sala.ocasional], [true, 12, true]);
  const f = await uno(db, "select slug, costo_hora_clp, activa, ocasional from sedes where id = $1", [sala.id]);
  assert.deepEqual([f.slug, f.costo_hora_clp, f.activa, f.ocasional], ["sala-nunoa", 15000, true, true]);
});
await paso("la segunda vez, la que se ofrece es la ocasional", async () => {
  const r = await crear(owner, "Ñuñoa de nuevo", "Av. Irarrázaval 100");
  assert.deepEqual([r.creada, r.id], [false, sala.id]);
});
await paso("una alumna y una profesora no pueden crearla, ni con la service role", async () => {
  await falla(crear(ana, "Sala Y", "Grecia 1"), /rol admin/);
  await falla(crear(pau, "Sala Y", "Grecia 1"), /rol admin/);
});

console.log("\n4. Lo que ve cada rol");
for (const [nombre, quien] of [["alumna", ana], ["profesora", pau], ["admin", admin], ["owner", owner]]) {
  await paso(`${nombre}: no ejecuta la función ni lee el costo`, async () => {
    await falla(como(db, quien, (tx) => tx.query(
      "select * from public.crear_sala_ocasional($1, 'x', 'y 1', 'z', 1, 1)", [quien.userId])), /permission denied/);
    await falla(como(db, quien, (tx) => tx.query("select costo_hora_clp from sedes")), /permission denied/);
  });
}
await paso("anon: no lee el costo ni ejecuta, pero sí puede filtrar por ocasional", async () => {
  const anon = async (sql) => db.transaction(async (tx) => { await tx.exec("set local role anon"); return tx.query(sql); });
  await falla(anon("select costo_hora_clp from sedes"), /permission denied/);
  await falla(anon("select public.direccion_comparable('x')"), /permission denied/);
  const r = await anon("select slug from sedes where ocasional = false");
  assert.ok(r.rows.length >= 3);
  assert.ok(!r.rows.some((x) => x.slug === "sala-nunoa"));
});
await paso("la fila sí se lee sin filtro: la clase necesita decir dónde es", async () => {
  const r = await db.transaction(async (tx) => {
    await tx.exec("set local role anon");
    return tx.query("select direccion from sedes where id = $1", [sala.id]);
  });
  assert.equal(r.rows.length, 1);
});
await paso("una ocasional sirve para crear una especial, con el cupo de la sala", async () => {
  const curso = await uno(db, "select id from cursos where activo and slug <> 'teens' limit 1");
  const profe = await uno(db, "select id from profesoras where activa limit 1");
  const c = await servidor(db, (tx) => uno(tx,
    `select * from public.crear_especial($1, 'Coreo en sala arrendada', $2, $3, $4, now() + interval '10 days')`,
    [owner.userId, curso.id, profe.id, sala.id]).catch((e) => { throw e; }));
  assert.equal(c.cupo_maximo, 12);
});

resumen();
