/**
 * Escenario de PRD-0021 fase 3: el cupo sale de la sala, y la asistencia de una
 * clase dictada se registra sin inventar compras.
 *
 * Cada caso corre en una transacción que se revierte, **incluida la sala de
 * prueba**: el escenario no depende de que la migración de datos de la fase 4 ya
 * esté aplicada, y no deja una sede de mentira en staging. Es la lección de la
 * fase 6 de PRD-0018 —una prueba que deja rastro ensucia los datos de otra— y de
 * la fase 3 de PRD-0019 —un caso que depende de un efecto de la siembra se rompe
 * el día que alguien la cambia—.
 *
 * Lo que prueba: las reglas. Lo que no: ninguna pantalla. Eso es la fase 6.
 */
import { conectar } from "./staging.mjs";

const U = {
  ana: "11111111-1111-4111-8111-000000000001",
  owner: "11111111-1111-4111-8111-000000000009",
  admin: "11111111-1111-4111-8111-000000000008",
};

/** Las columnas de `sedes` que anon tiene que poder leer, y ninguna más. */
const COLUMNAS_PUBLICAS = [
  "activa", "capacidad", "comuna", "created_at", "deleted_at", "direccion",
  "id", "nombre", "orden", "referencia", "slug", "updated_at",
];

const cliente = await conectar();
const q = (sql, params) => cliente.query(sql, params);
const una = async (sql, params) => (await q(sql, params)).rows[0];

const casos = [];
const caso = (nombre, esperado, fn) => casos.push({ nombre, esperado, fn });

/** Una sala de 40, dentro de la transacción. */
async function salaGrande(capacidad = 40) {
  return una(
    `insert into public.sedes (slug, nombre, direccion, comuna, capacidad, costo_hora_clp)
     values ('sala-de-prueba', 'Sala de prueba', 'Calle 1', 'Providencia', $1, 27000)
     returning id, capacidad`,
    [capacidad],
  );
}

const idDe = (tabla, slug) =>
  una(`select id from public.${tabla} where slug = $1`, [slug]).then((f) => f.id);

/** Crea una especial y devuelve la fila, o lanza. */
async function crear(sedeId, extra = {}) {
  const { cupo = null, inicio = "now() + interval '20 days'", titulo = `Prueba ${Math.random().toString(36).slice(2, 8)}` } = extra;
  const { id } = await una(
    `select (public.crear_especial(
       p_actor_user_id => $1, p_titulo => $2,
       p_curso_id => $3, p_profesora_id => $4, p_sede_id => $5,
       p_inicio => ${inicio}, p_duracion_min => 90,
       p_cupo_maximo => $6, p_precio_clp => 8000)).id as id`,
    [U.owner, titulo, await idDe("cursos", "girly"), await idDe("profesoras", "carli"), sedeId, cupo],
  );
  return una(`select * from public.clases where id = $1`, [id]);
}

async function rechazo(sql, params) {
  await q("savepoint intento");
  try {
    await q(sql, params);
    await q("release savepoint intento");
    return "NO RECHAZÓ";
  } catch (e) {
    await q("rollback to savepoint intento");
    return `${e.code} · ${e.message}`;
  }
}

// ---------------------------------------------------------------------------
// El cupo sale de la sala
// ---------------------------------------------------------------------------

caso("sin pasar cupo, la clase nace con la capacidad de la sala", "cupo 40", async () => {
  const sala = await salaGrande();
  const clase = await crear(sala.id);
  return `cupo ${clase.cupo_maximo}`;
});

caso("un cupo mayor que la sala se rechaza nombrando su capacidad",
  "23514 · El cupo va de 1 a 40, que es la capacidad de la sala", async () => {
    const sala = await salaGrande();
    return rechazo(
      `select public.crear_especial(
         p_actor_user_id => $1, p_titulo => 'No cabe',
         p_curso_id => $2, p_profesora_id => $3, p_sede_id => $4,
         p_inicio => now() + interval '21 days', p_cupo_maximo => 45, p_precio_clp => 8000)`,
      [U.owner, await idDe("cursos", "girly"), await idDe("profesoras", "carli"), sala.id],
    );
  });

caso("en una sala de 22, un cupo de 30 se rechaza con su propio número",
  "23514 · El cupo va de 1 a 22, que es la capacidad de la sala", async () => {
    return rechazo(
      `select public.crear_especial(
         p_actor_user_id => $1, p_titulo => 'No cabe tampoco',
         p_curso_id => $2, p_profesora_id => $3, p_sede_id => $4,
         p_inicio => now() + interval '22 days', p_cupo_maximo => 30, p_precio_clp => 8000)`,
      [U.owner, await idDe("cursos", "girly"), await idDe("profesoras", "carli"),
       await idDe("sedes", "diaguitas")],
    );
  });

caso("en una sala de 22, un cupo de 22 pasa", "cupo 22", async () => {
  const clase = await crear(await idDe("sedes", "diaguitas"), { cupo: 22, inicio: "now() + interval '23 days'" });
  return `cupo ${clase.cupo_maximo}`;
});

caso("editar subiendo el cupo por encima de la sala se rechaza",
  "23514 · El cupo va de 1 a 22, que es la capacidad de la sala", async () => {
    const clase = await crear(await idDe("sedes", "diaguitas"), { cupo: 20, inicio: "now() + interval '24 days'" });
    return rechazo(
      `select public.editar_especial(p_actor_user_id => $1, p_clase_id => $2, p_cupo_maximo => 40)`,
      [U.owner, clase.id],
    );
  });

caso("el insert directo tampoco puede superar la sala: la regla es el trigger",
  "23514 · El cupo (50) no cabe en la sala, que es de 40", async () => {
    const sala = await salaGrande();
    return rechazo(
      `insert into public.clases (tipo, fecha, inicio, curso_id, profesora_id, sede_id,
         cupo_maximo, slug, titulo, precio_clp)
       values ('especial', current_date + 30, now() + interval '30 days', $1, $2, $3,
               50, 'saltandose-la-funcion', 'Saltándose la función', 8000)`,
      [await idDe("cursos", "girly"), await idDe("profesoras", "carli"), sala.id],
    );
  });

caso("remedir una sala más chica no invalida las clases ya creadas",
  "la clase sigue con cupo 40", async () => {
    const sala = await salaGrande();
    const clase = await crear(sala.id);
    await q(`update public.sedes set capacidad = 25 where id = $1`, [sala.id]);
    const despues = await una(`select cupo_maximo from public.clases where id = $1`, [clase.id]);
    return `la clase sigue con cupo ${despues.cupo_maximo}`;
  });

caso("generar_clases copia la capacidad de cada sala", "la grande 40 · las de 22, 22", async () => {
  const sala = await salaGrande();
  // Un horario en la sala grande, el mismo día de la semana que hoy.
  await q(
    `insert into public.horarios (curso_id, profesora_id, sede_id, dia_semana, hora)
     values ($1, $2, $3, extract(isodow from current_date)::int, '09:00')`,
    [await idDe("cursos", "girly"), await idDe("profesoras", "carli"), sala.id],
  );
  await q(`select public.generar_clases(7)`);
  const [grande] = (await q(
    `select distinct cupo_maximo from public.clases where sede_id = $1 and tipo = 'parrilla'`,
    [sala.id])).rows;
  const otras = (await q(
    `select distinct c.cupo_maximo from public.clases c
     join public.sedes s on s.id = c.sede_id
     where c.tipo = 'parrilla' and s.capacidad = 22 and c.created_at > now() - interval '1 minute'`)).rows;
  return `la grande ${grande?.cupo_maximo} · las de 22, ${otras.map((o) => o.cupo_maximo).join("/") || 22}`;
});

// ---------------------------------------------------------------------------
// La asistencia de una clase dictada
// ---------------------------------------------------------------------------

caso("registrar asistencia en una clase que ya pasó deja el número, el flag y la nota",
  "35 · aproximado · con nota · con autor", async () => {
    const sala = await salaGrande();
    const clase = await crear(sala.id, { inicio: "now() - interval '10 days'" });
    const f = await una(
      `select * from public.registrar_asistencia($1, $2, 35::smallint, true, 'Cobrado por transferencia fuera del sistema')`,
      [clase.id, U.admin],
    );
    return `${f.asistentes_registrados} · ${f.asistentes_aproximados ? "aproximado" : "exacto"} · ${f.registro_nota ? "con nota" : "sin nota"} · ${f.asistencia_registrada_por ? "con autor" : "sin autor"}`;
  });

caso("registrar asistencia en una clase futura se rechaza",
  "22023 · Esa clase todavía no ocurrió", async () => {
    const sala = await salaGrande();
    const clase = await crear(sala.id);
    return rechazo(`select public.registrar_asistencia($1, $2, 10::smallint)`, [clase.id, U.admin]);
  });

caso("registrar dos veces sobreescribe, no suma", "20 · exacto", async () => {
  const sala = await salaGrande();
  const clase = await crear(sala.id, { inicio: "now() - interval '10 days'" });
  await q(`select public.registrar_asistencia($1, $2, 35::smallint, true)`, [clase.id, U.admin]);
  const f = await una(`select * from public.registrar_asistencia($1, $2, 20::smallint, false)`, [clase.id, U.admin]);
  return `${f.asistentes_registrados} · ${f.asistentes_aproximados ? "aproximado" : "exacto"}`;
});

caso("una alumna no puede registrar asistencia", "42501 · Se necesita rol admin o superior", async () => {
  const sala = await salaGrande();
  const clase = await crear(sala.id, { inicio: "now() - interval '10 days'" });
  return rechazo(`select public.registrar_asistencia($1, $2, 35::smallint)`, [clase.id, U.ana]);
});

caso("registrar asistencia no crea ni una compra ni una reserva",
  "compras 0 · reservas 0", async () => {
    const sala = await salaGrande();
    const clase = await crear(sala.id, { inicio: "now() - interval '10 days'" });
    await q(`select public.registrar_asistencia($1, $2, 35::smallint, true, 'Fuera del sistema')`,
            [clase.id, U.admin]);
    const f = await una(
      `select (select count(*)::int from public.compras where clase_id = $1) as compras,
              (select count(*)::int from public.reservas where clase_id = $1) as reservas`,
      [clase.id]);
    return `compras ${f.compras} · reservas ${f.reservas}`;
  });

// ---------------------------------------------------------------------------
// El guardián de la lista de columnas
// ---------------------------------------------------------------------------

caso("anon lee exactamente las columnas públicas de sedes, y el costo no está",
  COLUMNAS_PUBLICAS.join(","), async () => {
    const { rows } = await q(
      `select column_name from information_schema.column_privileges
       where grantee = 'anon' and table_schema = 'public' and table_name = 'sedes'
         and privilege_type = 'SELECT'
       order by column_name`);
    return rows.map((r) => r.column_name).join(",");
  });

// ---------------------------------------------------------------------------
// Corrida
// ---------------------------------------------------------------------------
console.log("\nPRD-0021 fase 3 — escenario de capacidad y asistencia en staging\n");
console.log("| Caso | Esperado | Obtenido | |");
console.log("|---|---|---|---|");

let fallas = 0;
for (const { nombre, esperado, fn } of casos) {
  let real;
  await q("begin");
  try {
    real = await fn();
  } catch (e) {
    real = `ERROR ${e.code ?? ""} ${e.message.split("\n")[0]}`;
  } finally {
    await q("rollback").catch(() => {});
  }
  const ok = real === esperado || real.includes(esperado);
  if (!ok) fallas++;
  console.log(`| ${nombre} | ${esperado} | ${real} | ${ok ? "✓" : "✗"} |`);
}

console.log(`\n${casos.length - fallas}/${casos.length} casos como los dice el PRD.`);
await cliente.end();
process.exitCode = fallas ? 1 : 0;
