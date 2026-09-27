/**
 * PRD-0021 fase 6.b: quién ve qué clases, **preguntado con cada sesión**.
 *
 * Existe por una lección concreta (26/09/2026): se afirmó que una clase sin
 * publicar "sí aparece en la grilla de la profesora, que no filtra por
 * publicada", y era falso —la consulta no filtra, pero RLS sí—. El error fue
 * describir el comportamiento de una política **leyéndola** en vez de
 * preguntárselo a la base con la sesión correspondiente. Es la tercera vez que
 * las políticas de este repo se comportan distinto de lo que parecía al leerlas.
 *
 * Así que esto no lee ninguna política: abre una sesión por rol y cuenta filas.
 */
import { conectar } from "./staging.mjs";

const TMP = "11111111-1111-4111-8111-0000000000cf";
const OTRA = "11111111-1111-4111-8111-0000000000ce";
const ALUMNA = "11111111-1111-4111-8111-000000000001";
const ADMIN = "11111111-1111-4111-8111-000000000008";

const c = await conectar();
const q = (s, p) => c.query(s, p).then((r) => r.rows);

const r = [];
const caso = (n, esperado, real) =>
  r.push({ n, esperado, real, ok: String(real) === String(esperado) });

/** Cuenta, con la sesión de alguien, las clases que cumplen `filtro`. */
async function comoUsuario(userId, filtro, params = []) {
  await q("savepoint s");
  try {
    if (userId) {
      await q(
        `select set_config('request.jwt.claims',
           json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)`,
        [userId],
      );
      await q("set local role authenticated");
    } else {
      await q("set local role anon");
    }
    const [{ n }] = await q(`select count(*)::int as n from public.clases where ${filtro}`, params);
    return n;
  } catch (e) {
    await q("rollback to savepoint s").catch(() => {});
    return `error ${e.code}`;
  } finally {
    await q("reset role").catch(() => {});
    await q("release savepoint s").catch(() => {});
  }
}

async function crearProfesora(uid, slug, correo) {
  await q(`delete from public.perfiles where user_id = $1`, [uid]).catch(() => {});
  await q(`delete from auth.users where id = $1`, [uid]).catch(() => {});
  await q(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
       email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
       confirmation_token, recovery_token, email_change, email_change_token_new,
       email_change_token_current, phone_change, phone_change_token, reauthentication_token)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2,
       extensions.crypt('x', extensions.gen_salt('bf')), now(), now(), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
       '', '', '', '', '', '', '', '')`,
    [uid, correo],
  );
  await q(
    `update public.perfiles set rol = 'profesora', profesora_id = $2, perfil_completo_at = now()
     where user_id = $1`, [uid, slug]);
}

await q("begin");
try {
  await crearProfesora(TMP, "carli", "carli.rls@ejemplo.invalid");
  await crearProfesora(OTRA, "pau", "pau.rls@ejemplo.invalid");

  const [carli] = await q(`select id from public.profesoras where slug = 'carli'`);
  const suyasSinPublicar =
    `profesora_id = $1 and tipo = 'especial' and publicada_at is null`;

  const enLaBase = (await q(
    `select count(*)::int as n from public.clases where ${suyasSinPublicar}`, [carli.id]))[0].n;
  caso("en la base hay especiales sin publicar de Carli", true, enLaBase > 0);

  caso("Carli ve sus especiales sin publicar", String(enLaBase),
       String(await comoUsuario(TMP, suyasSinPublicar, [carli.id])));

  caso("otra profesora NO las ve", "0",
       String(await comoUsuario(OTRA, suyasSinPublicar, [carli.id])));

  caso("una alumna con sesión NO las ve", "0",
       String(await comoUsuario(ALUMNA, suyasSinPublicar, [carli.id])));

  caso("sin sesión tampoco", "0",
       String(await comoUsuario(null, suyasSinPublicar, [carli.id])));

  caso("admin las ve, como antes", String(enLaBase),
       String(await comoUsuario(ADMIN, suyasSinPublicar, [carli.id])));

  // Que la política no haya abierto la tabla: los borradores ajenos siguen cerrados.
  const borradoresAjenos =
    `tipo = 'especial' and publicada_at is null and profesora_id <> $1`;
  const cuantos = (await q(
    `select count(*)::int as n from public.clases where ${borradoresAjenos}`, [carli.id]))[0].n;
  caso("hay borradores de otras profesoras en la base", true, cuantos > 0);
  caso("y Carli NO los ve: la política no abrió la tabla", "0",
       String(await comoUsuario(TMP, borradoresAjenos, [carli.id])));

  // Lo público sigue público.
  caso("sin sesión se siguen viendo las de parrilla",
       String((await q(`select count(*)::int as n from public.clases where tipo = 'parrilla'`))[0].n),
       String(await comoUsuario(null, "tipo = 'parrilla'")));
} finally {
  await q("rollback");
}

console.log("\nPRD-0021 fase 6.b — quién ve qué clases, preguntado con cada sesión\n");
console.log("| Caso | Esperado | Obtenido | |");
console.log("|---|---|---|---|");
for (const x of r) console.log(`| ${x.n} | ${x.esperado} | ${x.real} | ${x.ok ? "✓" : "✗"} |`);
const fallas = r.filter((x) => !x.ok).length;
console.log(`\n${r.length - fallas}/${r.length} como se esperaba.`);
await c.end();
process.exitCode = fallas ? 1 : 0;
