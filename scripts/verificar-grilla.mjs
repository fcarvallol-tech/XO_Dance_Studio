/**
 * PRD-0021 fase 6: la hora de término en pantalla, con clics.
 *
 * Crea una cuenta de profesora para Carli —en staging no había ninguna— y la
 * borra al terminar: la prueba no deja rastro en los datos de otra.
 */
// Playwright no es dependencia del proyecto —son ~100 MB de navegador que no
// tienen por qué bajar en cada `npm install`—: se instala aparte para verificar.
//   npm i --no-save playwright && npx playwright install chromium
const S = process.env.SCRATCHPAD ?? process.cwd();
const pw = await import(`${S}/node_modules/playwright/index.js`);
const chromium = (pw.default ?? pw).chromium;
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { conectar } from "./staging.mjs";

const SITIO = "http://localhost:3000";
const CARLI_UID = "11111111-1111-4111-8111-0000000000c1";
const cfg = Object.fromEntries(
  readFileSync(".env.staging", "utf8").split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]),
);
const supabase = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const db = await conectar();
const q = (s, p) => db.query(s, p).then((r) => r.rows);

const r = [];
const caso = (n, esperado, real) =>
  r.push({ n, esperado, real, ok: String(real) === String(esperado) });

// --- la cuenta de Carli, temporal ------------------------------------------
await q(`delete from public.perfiles where user_id = $1`, [CARLI_UID]).catch(() => {});
await q(`delete from auth.users where id = $1`, [CARLI_UID]).catch(() => {});
await q(
  `insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
     email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
     confirmation_token, recovery_token, email_change, email_change_token_new,
     email_change_token_current, phone_change, phone_change_token, reauthentication_token)
   values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated',
     'carli@ejemplo.invalid', extensions.crypt('x', extensions.gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('full_name', 'Carli'), '', '', '', '', '', '', '', '')`,
  [CARLI_UID]);
await q(
  `update public.perfiles set rol = 'profesora', profesora_id = 'carli',
     telefono = '+56900000000', perfil_completo_at = now()
   where user_id = $1`, [CARLI_UID]);

const nav = await chromium.launch();
try {
  const { data } = await supabase.auth.admin.generateLink({ type: "magiclink", email: "carli@ejemplo.invalid" });
  const p = await (await nav.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
  await p.goto(`${SITIO}/auth/confirmar?token_hash=${data.properties.hashed_token}&type=magiclink&volver=${encodeURIComponent("/profesora/mis-clases")}`,
    { waitUntil: "networkidle" });

  caso("Carli entra a su portal", "/profesora/mis-clases", new URL(p.url()).pathname);

  // Una especial PUBLICADA de 90 minutos: "Coreo del escenario", 16/09 10:00.
  // Se usa esta y no la del intensivo porque RLS no le muestra a la profesora
  // sus propias especiales sin publicar — el hallazgo de la fase 6.
  await p.goto(`${SITIO}/profesora/mis-clases?semana=2026-09-14`, { waitUntil: "networkidle" });
  let html = await p.content();
  caso("la grilla muestra el rango de una clase de hora y media", true, html.includes("10:00–11:30"));
  caso("y la llama por su coreografía, no por el curso", true, html.includes("Coreo del escenario"));

  // Una semana con clases de parrilla, de una hora.
  await p.goto(`${SITIO}/profesora/mis-clases?semana=2026-10-05`, { waitUntil: "networkidle" });
  html = await p.content();
  const conRango = (html.match(/\d{2}:\d{2}–\d{2}:\d{2}/g) ?? []).length;
  caso("una semana de clases normales no muestra ningún rango", "0", String(conRango));
  caso("pero sí las horas de inicio", true, /\d{2}:\d{2}/.test(html));

  // 🔴 El hallazgo: las clases del intensivo NO las ve, porque están sin
  // publicar y `clases_lectura_publica` es la única política de select que
  // cubre a una profesora. Se deja como caso para que quede a la vista.
  await p.goto(`${SITIO}/profesora/mis-clases?semana=2026-09-25`, { waitUntil: "networkidle" });
  html = await p.content();
  caso("🔴 la profesora NO ve la clase que dictó, porque está sin publicar",
       "no la ve", html.includes("17:00–18:30") ? "la ve" : "no la ve");
} finally {
  await nav.close();
}

await q(`delete from public.perfiles where user_id = $1`, [CARLI_UID]);
await q(`delete from auth.users where id = $1`, [CARLI_UID]);
console.log("cuenta temporal de Carli borrada.");

console.log("\n| Caso | Esperado | Obtenido | |");
console.log("|---|---|---|---|");
for (const x of r) console.log(`| ${x.n} | ${x.esperado} | ${x.real} | ${x.ok ? "✓" : "✗"} |`);
const fallas = r.filter((x) => !x.ok).length;
console.log(`\n${r.length - fallas}/${r.length} como se esperaba.`);
await db.end();
process.exitCode = fallas ? 1 : 0;
