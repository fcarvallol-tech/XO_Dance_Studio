// PRD-0026 §12.1: la amiga ve en /mis-clases de dónde salió su clase y quién
// se la dejó; la compradora no la ve repetida. Contra un servidor corriendo
// (local apuntando a staging) y entrando por /auth/confirmar, no por el SDK.
//
//   SITIO=http://localhost:3000 node --env-file=.env.local scripts/verificar-clases-de-amiga.mjs
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const SITIO = process.env.SITIO ?? "http://localhost:3000";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: compras, error } = await supabase
  .from("compras")
  .select("id, perfil_id, perfil_invitada_id")
  .eq("estado", "pagada")
  .not("perfil_invitada_id", "is", null)
  .is("deleted_at", null)
  .limit(1);
if (error) throw error;
if (!compras.length) throw new Error("No hay un pack de amigas aprobado en esta base");
const compra = compras[0];

const correoDe = async (perfilId) => {
  const { data } = await supabase.from("perfiles").select("user_id").eq("id", perfilId).single();
  const { data: u } = await supabase.auth.admin.getUserById(data.user_id);
  return u.user.email;
};

const nav = await chromium.launch();
async function seccion(correo) {
  const ctx = await nav.newContext({ viewport: { width: 375, height: 900 } });
  const p = await ctx.newPage();
  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email: correo });
  if (error) throw error;
  await p.goto(`${SITIO}/auth/confirmar?token_hash=${data.properties.hashed_token}&type=email&volver=%2Fmis-clases`, { waitUntil: "load" });
  await p.waitForTimeout(500);
  const url = p.url();
  const lista = p.locator("[data-mis-clases-de-amiga]");
  const texto = (await lista.count()) ? await lista.innerText() : null;
  await ctx.close();
  return { url, texto };
}

let fallas = 0;
const ok = (cond, que) => { console.log(`${cond ? "✓" : "✗"} ${que}`); if (!cond) fallas++; };

const amiga = await seccion(await correoDe(compra.perfil_invitada_id));
console.log("amiga:", amiga.url, "\n" + (amiga.texto ?? "(sin sección)"));
ok(amiga.url.endsWith("/mis-clases"), "la amiga entra a /mis-clases");
ok(!!amiga.texto, "la amiga ve la sección 'Clases que te dejaron'");
ok(/clases? del pack de amigas/.test(amiga.texto ?? "") && /Te las? dejó \S+/.test(amiga.texto ?? ""), "dice cuántas clases, de qué pack y quién se las dejó");
ok(!/@/.test(amiga.texto ?? ""), "no muestra ningún correo");

const compradora = await seccion(await correoDe(compra.perfil_id));
ok(compradora.texto === null, "la compradora no ve su propio lote como si se lo hubieran dejado");

await nav.close();
console.log(fallas ? `\n${fallas} fallas` : "\nTodo bien");
process.exit(fallas ? 1 : 0);
