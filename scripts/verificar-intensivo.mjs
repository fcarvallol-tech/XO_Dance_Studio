/**
 * PRD-0021 fase 5: verificar la carga sobre las filas reales.
 *
 * No es un escenario inventado: mira lo que quedó en la base después de la
 * migración de datos, que es lo único que prueba que se cargó bien.
 */
import { conectar } from "./staging.mjs";
import { duracionMin, rangoHorario } from "../lib/dominio/horarios.ts";
import { mesEnCurso } from "../lib/dominio/periodo.ts";

const c = await conectar();
const q = (s, p) => c.query(s, p).then((r) => r.rows);

const r = [];
const caso = (n, esperado, real) =>
  r.push({ n, esperado, real, ok: String(real) === String(esperado) });

// --- la sala -----------------------------------------------------------------
const [sede] = await q(
  `select slug, nombre, direccion, comuna, referencia, capacidad, costo_hora_clp, activa
   from public.sedes where slug = 'eb-dance-studio'`);
caso("la sala quedó con su dirección y su referencia",
  "EB Dance Studio · Chucre Manzur 7 · Providencia · Bellavista",
  sede ? `${sede.nombre} · ${sede.direccion} · ${sede.comuna} · ${sede.referencia}` : "no existe");
caso("con capacidad 40 y $27.000 la hora, y activa",
  "40 · 27000 · activa", sede ? `${sede.capacidad} · ${sede.costo_hora_clp} · ${sede.activa ? "activa" : "inactiva"}` : "—");
caso("y es la sala más grande que hay", "40",
  String((await q(`select max(capacidad) as m from public.sedes`))[0].m));

// --- las dos clases ----------------------------------------------------------
const clases = await q(
  `select c.slug, c.titulo, c.cancion, c.dificultad, c.reel_codigo, c.precio_clp,
          c.cupo_maximo, c.publicada_at, c.estado, c.inicio, c.fin,
          to_char(c.inicio at time zone 'America/Santiago', 'DD/MM HH24:MI') as empieza,
          to_char(c.fin at time zone 'America/Santiago', 'HH24:MI') as termina,
          c.asistentes_registrados as asistentes, c.asistentes_aproximados as aprox,
          c.registro_nota is not null as con_nota,
          cu.slug as curso, p.slug as profesora, s.slug as sede,
          (select count(*)::int from public.compras where clase_id = c.id) as compras,
          (select count(*)::int from public.reservas where clase_id = c.id) as reservas
   from public.clases c
   join public.cursos cu on cu.id = c.curso_id
   join public.profesoras p on p.id = c.profesora_id
   join public.sedes s on s.id = c.sede_id
   where c.titulo = 'What you need' order by c.inicio`);

caso("están las dos clases", "2", String(clases.length));

for (const cl of clases) {
  const etiqueta = cl.empieza.slice(0, 5);
  caso(`${etiqueta} · hora de Santiago y duración`,
    etiqueta === "11/09" ? "11/09 18:00 → 19:30 · 90 min" : "25/09 17:00 → 18:30 · 90 min",
    `${cl.empieza} → ${cl.termina} · ${duracionMin(cl.inicio, cl.fin)} min`);
  caso(`${etiqueta} · ficha`, "girly · carli · eb-dance-studio · 8000 · intermedio · DdErD08oKJm",
    `${cl.curso} · ${cl.profesora} · ${cl.sede} · ${cl.precio_clp} · ${cl.dificultad} · ${cl.reel_codigo}`);
  caso(`${etiqueta} · sin publicar y con cupo de la sala`, "sin publicar · cupo 40",
    `${cl.publicada_at ? "publicada" : "sin publicar"} · cupo ${cl.cupo_maximo}`);
  caso(`${etiqueta} · SIN compras ni reservas`, "compras 0 · reservas 0",
    `compras ${cl.compras} · reservas ${cl.reservas}`);
  caso(`${etiqueta} · asistencia`,
    etiqueta === "11/09" ? "35 · aproximado · con nota" : "20 · exacto · con nota",
    `${cl.asistentes} · ${cl.aprox ? "aproximado" : "exacto"} · ${cl.con_nota ? "con nota" : "sin nota"}`);
  caso(`${etiqueta} · cómo se va a mostrar la hora`,
    etiqueta === "11/09" ? "18:00–19:30" : "17:00–18:30",
    rangoHorario(cl.inicio, cl.fin));
}

// --- que no ensucien el tablero ----------------------------------------------
const { desde, hasta } = mesEnCurso();
await q("begin");
await q(`select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)`,
  ["11111111-1111-4111-8111-000000000009"]);
await q("set local role authenticated");
const [{ metricas_demanda: D }] = await q(`select public.metricas_demanda($1, $2)`,
  [desde.toISOString(), hasta.toISOString()]);
await q("rollback");

caso("metricas_demanda no cuenta las clases sin publicar", "0",
  String(D.por_clase.filter((x) => x.curso === "What you need").length));

console.log("\nPRD-0021 fase 5 — la carga, verificada sobre las filas reales\n");
console.log("| Caso | Esperado | Obtenido | |");
console.log("|---|---|---|---|");
for (const x of r) console.log(`| ${x.n} | ${x.esperado} | ${x.real} | ${x.ok ? "✓" : "✗"} |`);
const fallas = r.filter((x) => !x.ok).length;
console.log(`\n${r.length - fallas}/${r.length} como se esperaba.`);
await c.end();
process.exitCode = fallas ? 1 : 0;
