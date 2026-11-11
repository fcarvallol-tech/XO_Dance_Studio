// PRD-0030 en staging: quién puede ejecutar las dos funciones, preguntado con
// la sesión de cada rol (CLAUDE.md). Todo dentro de transacciones revertidas.
//   node scripts/verificar-retroactiva-permisos.mjs
import { conectar } from "./staging.mjs";

const db = await conectar();
const uno = async (q, p) => (await db.query(q, p)).rows[0];
const quien = async (where) => uno(`select p.id, p.user_id, p.rol from perfiles p where ${where} and p.deleted_at is null limit 1`);
const personas = {
  owner: await quien("p.email = 'owner@ejemplo.invalid'"),
  admin: await quien("p.email = 'admin@ejemplo.invalid'"),
  profesora: await quien("p.email = 'profe.pau@ejemplo.invalid'"),
  alumna: await quien("p.email like 'prueba.%@ejemplo.invalid' and p.rol = 'alumna'"),
};
const [clase] = (await db.query(`select id from clases where inicio < now() and estado = 'programada' order by inicio desc limit 1`)).rows;

async function probar(nombre, persona, consulta, args) {
  await db.query("begin");
  try {
    if (persona) {
      await db.query("select set_config('request.jwt.claims', $1, true)",
        [JSON.stringify({ sub: persona.user_id, role: "authenticated" })]);
      await db.query("set local role authenticated");
    } else {
      await db.query("set local role anon");
    }
    const r = await db.query(consulta, args);
    return `${nombre}: ejecuta (${r.rowCount} filas)`;
  } catch (e) {
    return `${nombre}: ${e.code === "42501" ? "negado" : "error"} — ${e.message.split("\n")[0]}`;
  } finally {
    await db.query("rollback");
  }
}

let mal = 0;
for (const [fn, consulta, args, esperado] of [
  ["reservas_retroactivas (lista)", "select * from public.reservas_retroactivas(now() - interval '45 days', now())", [], { owner: "ejecuta" }],
  ["reservar_retroactiva (registrar)", "select public.reservar_retroactiva($1, $2, $3, 'prueba de permisos', false)",
    [personas.owner.user_id, personas.alumna.id, clase.id], {}],
]) {
  console.log(`\n${fn}`);
  for (const [nombre, persona] of [...Object.entries(personas), ["anon", null]]) {
    const r = await probar(nombre, persona, consulta, args);
    const ok = (esperado[nombre] ?? "negado") === r.split(": ")[1].split(" ")[0];
    if (!ok) mal++;
    console.log(`  ${ok ? "✔" : "✘"} ${r}`);
  }
}
console.log(mal ? `\n${mal} mal` : "\ntodo como se espera");
await db.end();
