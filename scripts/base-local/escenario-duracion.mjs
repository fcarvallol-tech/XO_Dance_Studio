// La duración de las clases, contra la base local: el relleno, generar_clases(),
// que una de parrilla no quede sin fin, y lo que paga una de 90 minutos.
// node scripts/base-local/escenario-duracion.mjs   (ver base.mjs para instalar PGlite)
import { base } from "./base.mjs";
import { paso, resumen, assert, falla, uno } from "./util.mjs";
import { baseDeClase, horas, TARIFA_GENERAL } from "../../lib/dominio/liquidacion.ts";

const db = await base();

await paso("los 15 horarios tienen duración, 60, y la columna no tiene default", async () => {
  const r = await uno(db, "select count(*)::int n, min(duracion_min) a, max(duracion_min) b from horarios");
  assert.deepEqual([r.n, r.a, r.b], [15, 60, 60]);
  const c = await uno(db, `select column_default d, is_nullable n from information_schema.columns
    where table_name = 'horarios' and column_name = 'duracion_min'`);
  assert.deepEqual([c.d, c.n], [null, "NO"]);
});
await paso("un horario nuevo sin duración se rechaza", async () => {
  const h = await uno(db, "select curso_id, profesora_id, sede_id from horarios limit 1");
  await falla(db.query(`insert into horarios (curso_id, profesora_id, sede_id, dia_semana, hora, activo) values ($1, $2, $3, 7, '10:00', false)`,
    [h.curso_id, h.profesora_id, h.sede_id]), /duracion_min/);
});
await paso("ninguna clase de parrilla quedó sin fin, y todas duran lo de su horario", async () => {
  const r = await uno(db, `select count(*)::int total,
    count(*) filter (where cl.fin is null)::int sin_fin,
    count(*) filter (where cl.fin <> cl.inicio + make_interval(mins => h.duracion_min))::int distinta
    from clases cl join horarios h on h.id = cl.horario_id where cl.tipo = 'parrilla'`);
  assert.ok(r.total > 0);
  assert.deepEqual([r.sin_fin, r.distinta], [0, 0]);
});
await paso("generar_clases() crea con fin", async () => {
  await db.query("delete from clases where inicio > now() + interval '3 days' and tipo = 'parrilla'");
  const n = (await uno(db, "select public.generar_clases(30) n")).n;
  assert.ok(n > 0);
  assert.equal((await uno(db, "select count(*)::int n from clases where fin is null and tipo = 'parrilla'")).n, 0);
});
await paso("una clase de parrilla sin fin se rechaza, también por update", async () => {
  const c = await uno(db, "select id from clases where tipo = 'parrilla' limit 1");
  await falla(db.query("update clases set fin = null where id = $1", [c.id]), /clases_parrilla_con_fin/);
});
await paso("la regla no nombra a las especiales", async () => {
  const d = await uno(db, "select pg_get_constraintdef(oid) d from pg_constraint where conname = 'clases_parrilla_con_fin'");
  assert.match(d.d, /tipo <> 'parrilla'/);
});
await paso("un horario de 90 minutos crea clases de 90, y la base paga $27.000, no $18.000", async () => {
  const h = await uno(db, "update horarios set duracion_min = 90 where activo and id = (select id from horarios where activo limit 1) returning id");
  await db.query("delete from clases where horario_id = $1 and inicio > now() + interval '3 days'", [h.id]);
  await db.query("select public.generar_clases(30)");
  const c = await uno(db, "select inicio, fin from clases where horario_id = $1 and inicio > now() + interval '3 days' limit 1", [h.id]);
  assert.equal((new Date(c.fin) - new Date(c.inicio)) / 60000, 90);
  assert.equal(baseDeClase(horas(new Date(c.inicio).toISOString(), new Date(c.fin).toISOString()), TARIFA_GENERAL), 27_000);
});

resumen();
