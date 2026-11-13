// Un enlace que no sirve, abierto con la sesión de OTRA persona viva (Felipe,
// 13/11/2026): antes caía callado en el inicio de esa sesión. Contra staging.
// No manda correos: los enlaces salen de generateLink.
//   node scripts/verificar-enlace-vencido-navegador.mjs
import { caso, fin, sesion, supabase, navegador, texto, SITIO } from "./verificar-staging-comun.mjs";

const C = "/private/tmp/claude-501/-Users-carlatati-Desktop-Proyectos-de-Felipi-XO-Dance-Studio/5a6257a2-f936-47fd-8039-54593bcbfbb6/scratchpad/capturas";
const enlace = async (correo, volver) => {
  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email: correo });
  if (error) throw error;
  return `${SITIO}/auth/confirmar?token_hash=${data.properties.hashed_token}&type=email&volver=${encodeURIComponent(volver)}`;
};
async function usado(correo, volver) {
  const e = await enlace(correo, volver);
  const c = await navegador.newContext(); const p = await c.newPage();
  await p.goto(e, { waitUntil: "networkidle" }); await c.close();
  return e;
}

console.log("\n1. Sesión de Pau viva, enlace de owner ya usado");
{
  const e = await usado("owner@ejemplo.invalid", "/owner/asistencias");
  const { pagina: p, contexto } = await sesion("profe.pau@ejemplo.invalid", "/profesora", 390);
  await p.goto(e, { waitUntil: "networkidle" });
  const u = new URL(p.url());
  caso("se queda en /entrar", u.pathname, "/entrar");
  caso("con el error y el volver de la página pedida", `${u.searchParams.get("error")} ${u.searchParams.get("volver")}`, "enlace /owner/asistencias");
  const t = await texto(p);
  caso("dice que el enlace no sirve", t.includes("Ese enlace ya no sirve"), true);
  const aviso = await p.locator("[data-sesion-abierta]").innerText();
  caso("dice de quién es la sesión abierta, con el nombre de pila", aviso.includes("sesión de Profe."), true);
  caso("sin el nombre completo ni el correo", /Profe pau|@/i.test(aviso), false);
  caso("ofrece salir y pedir otro", (await p.getByRole("button", { name: "Salir de esta cuenta" }).count()) === 1
    && (await p.getByRole("button", { name: "Mandarme un enlace" }).count()) === 1, true);
  await p.screenshot({ path: `${C}/enlace-vencido-con-sesion-390.png`, fullPage: true });
  await Promise.all([p.waitForURL((u) => u.pathname !== "/entrar"), p.getByRole("link", { name: /Seguir como/ }).click()]);
  caso("'Seguir como…' lleva al inicio de la profesora", new URL(p.url()).pathname.startsWith("/profesora"), true);
  await p.goto(`${SITIO}/entrar`, { waitUntil: "networkidle" });
  caso("/entrar sin error, con sesión, sigue redirigiendo", new URL(p.url()).pathname.startsWith("/profesora"), true);
  console.log("\n2. Salir de esta cuenta");
  await p.goto(e, { waitUntil: "networkidle" });
  await Promise.all([p.waitForURL((u) => u.pathname === "/entrar" && !u.searchParams.get("error")),
    p.getByRole("button", { name: "Salir de esta cuenta" }).click()]);
  await p.waitForLoadState("networkidle");
  const s = new URL(p.url());
  caso("vuelve a /entrar con la página pedida guardada", `${s.pathname} ${s.searchParams.get("volver")}`, "/entrar /owner/asistencias");
  caso("ya sin sesión: sin aviso ni error", await p.locator("[data-sesion-abierta], [data-error-de-enlace]").count(), 0);

  console.log("\n3. Sin sesión, enlace de owner válido, desde esa misma pantalla");
  await p.goto(await enlace("owner@ejemplo.invalid", "/owner/asistencias"), { waitUntil: "networkidle" });
  caso("entra como owner donde pidió", new URL(p.url()).pathname, "/owner/asistencias");
  await contexto.close();
}

console.log("\n4. Sin sesión, enlace ya usado");
{
  const e = await usado("admin@ejemplo.invalid", "/admin");
  const c = await navegador.newContext({ viewport: { width: 390, height: 900 } }); const p = await c.newPage();
  await p.goto(e, { waitUntil: "networkidle" });
  caso("cae en /entrar con el error", new URL(p.url()).pathname + " " + (await texto(p)).includes("Ese enlace ya no sirve"), "/entrar true");
  caso("sin aviso de sesión abierta", await p.locator("[data-sesion-abierta]").count(), 0);
  await c.close();
}
await fin();
