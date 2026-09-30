# Plan de implementación — PRD-0010 parte 2: egresos y caja neta

> El PRD dice **qué** y **por qué**. Esto dice **en qué orden** y **cómo se sabe que cada paso
> quedó bien**. Se lee junto a `0010-dashboard-owner.md`, cuya parte 2 está solo **enunciada**
> (§3.8–9, §6.3, §8.4, §15.4): la fase 0 de acá es lo que le falta al PRD para ser detalle.
>
> Se trabaja sobre `main`, como los últimos PRD. **Hay una migración**, así que nada se aplica
> —ni a staging— sin aprobación de Felipe en ese mismo mensaje.
>
> **Estado: en ejecución desde el 30/09/2026.** Felipe aprobó las nueve decisiones tal cual,
> contestó las dos preguntas (ver §0.1) y autorizó el `db push` a staging de la fase 3.
>
> Para quien ejecute: cada fase termina con un checkpoint que se muestra, no se afirma. Las
> tareas van con casilla (`- [ ]`) para ir marcando.

**Objetivo:** que Carla registre lo que sale de la caja, vea **cuánto quedó** en el mes y **cuánto
deja cada clase dictada**, con los mismos cuidados de la parte 1: un cero que dice de qué cero es,
un fallo de lectura que no se ve como vacío, y valores esperados escritos antes que el código.

**Arquitectura:** dos tablas nuevas con RLS de solo `owner` (las primeras del proyecto), tres
funciones SQL (una que agrega, dos que escriben), un módulo puro `lib/dominio/finanzas.ts` con
tests, y una página nueva `/owner/finanzas` con el formulario de egresos. El tablero de métricas
no cambia salvo que sus dos tarjetas "sin dato" pasan a enlazar a la página nueva.

**Stack:** el de siempre. Next 16 App Router · Supabase (Postgres 17, PostgREST, Storage) ·
`node --test` sin dependencias nuevas · `pg` en los scripts de staging.

**Spec:** `context/prds/0010-dashboard-owner.md` (partes 1 y 2) · `context/CONTEXT.md` §5.b
(economía unitaria) · `context/ARCHITECTURE.md` §5.2, §5.6, §8.

---

## Restricciones globales (valen para todas las fases)

- Dinero en **enteros CLP**. Sin decimales, sin floats. `Math.round` donde haya división.
- El SQL **agrega y agrupa; no divide**. Toda división vive en `lib/dominio` con tests.
- Solo `owner` ve montos: verificado **en la función** con `tiene_nivel('owner')` → `42501`, no
  solo en la ruta (PRD §7.6).
- Toda función con **grant explícito**: `revoke ... from public, anon` y a continuación el
  `grant execute` que corresponda (PRD-0008 §15).
- Toda consulta devuelve `Lectura<T>` y la tarjeta pinta `<ErrorDeLectura>` (PRD §9.1). El estado
  vacío se muestra **solo si no hubo error**.
- Todo cero con su denominador y desde cuándo (PRD §9.2). Todo porcentaje con su absoluto (§7.4).
- Copy en español de Chile. Colores solo `xo-*`. Rosa nunca como texto sobre claro. Mobile-first.
- Borrado lógico (`deleted_at`), nunca `DELETE` sobre egresos.
- `security definer` **solo** en las funciones que lo necesitan, con `set search_path = public`
  y el chequeo de rol como primera línea.
- **NUNCA `supabase db push` sin aprobación de Felipe en ese mismo mensaje**, ni a staging.
- No se toca `components/BarraSitio.tsx` ni la cabecera del sitio público (hay trabajo sin pushear
  en otro computador). Esta parte no lo necesita: todo vive en el portal.

---

## Foco de revisión — lo que el PRD no dice y que igual va a pasar

Cada línea tiene su prueba en la fase que la posee.

1. **Caja neta negativa, o mes anterior negativo o en cero.** Un mes con más egresos que ingresos
   da un número negativo, y compararlo en porcentaje contra un anterior negativo da un "−258%" que
   no significa nada. Se muestra `-$6.000` (signo antes del peso, lección de la parte 1) y la
   comparación solo en pesos cuando el anterior es ≤ 0. → Fase 1, `compararCaja`.
2. **Un egreso anulado no puede seguir contando.** El borrado es lógico, así que basta olvidar el
   filtro de `deleted_at` en un lugar para que la caja mienta. → Fase 3, egreso E4.
3. **Monto cero o negativo, fecha futura, categoría inventada.** El formulario lo va a impedir,
   pero el formulario no es la validación: la función rechaza con `23514`. → Fase 3, transacciones
   revertidas.
4. **Una clase cuyo costo no está cargado** —profesora sin fila en `costos_profesoras`, o sede con
   `costo_hora_clp` en `NULL`— no da margen `0`: da `null`, la fila dice "sin costo cargado" y el
   total del mes declara cuántas quedaron fuera. Es exactamente el cero que miente de §9. →
   Fase 1, `costoClase`; Fase 3, transacción que borra un costo.
5. **Un admin.** No ve `/owner/finanzas`, recibe `42501` al llamar `metricas_finanzas` y
   `registrar_egreso` por REST, y **cuenta cero filas** de `egresos` con su sesión. Se pregunta con
   `set local role authenticated` y sus claims, no leyendo la política. → Fase 3 y 5.
6. **Una clase de hora y media** (tiene `fin`) cuesta 1,5 veces la hora de sala y de profesora.
   Una sin `fin` dura una hora, que es la regla de `CONTEXT.md`. → Fase 1, `costoClase`.

---

## Fase 0 — Lo que el PRD no decidió, y el juez

### 0.1 Decisiones que faltan

El PRD dejó la parte 2 en dos líneas. Estas son las decisiones que hacen falta para escribir una
migración, con mi recomendación. **Ninguna se implementa hasta que Felipe la confirme.**

| # | Decisión | Recomendación | Por qué |
|---|---|---|---|
| 1 | **Dónde vive el costo de la profesora** | Tabla nueva `costos_profesoras` (`profesora_id`, `base_hora_clp`, `variable_credito_clp`), RLS solo owner, sembrada con **$18.000 / $250** para todas las profesoras | Es lo que la academia paga: igual de sensible que `sedes.costo_hora_clp`, que Felipe decidió ocultar. Ponerlo en `parametros` lo deja legible por cualquier alumna con sesión (`parametros_con_sesion`). Ponerlo como columna de `profesoras` obliga a repetir los grants por columna en una segunda tabla. Y **permite que una profesora tenga otro valor sin tocar código** — ver la pregunta 1 de abajo |
| 2 | **Caja neta = ingresos − egresos registrados.** Los costos calculados (sala y profesora) **no** se restan de la caja: se muestran aparte como "costo calculado de las clases dictadas" y como margen por clase | Si Carla registra el arriendo que pagó como egreso **y** el sistema lo calcula por clase, la caja lo descuenta dos veces. La caja mide lo que salió de la cuenta; el margen mide la economía unitaria. Son dos preguntas distintas y la página lo dice | |
| 3 | **Categorías de egreso**, lista cerrada en la base | `arriendo_sala` · `sueldo_profesora` · `marketing` · `insumos` · `servicios` · `otro` | Una lista abierta no se puede agrupar. Se cambia con una migración, no con un texto libre. **Necesito que Felipe la confirme o corrija** |
| 4 | **Un egreso se registra y se anula. No se edita.** | `anular_egreso` pone `deleted_at`, `anulado_por` y `motivo_anulacion`. Si estaba mal, se anula y se registra de nuevo | Es el principio de `movimientos_credito`: un libro que se agrega y no se edita. Y evita un formulario de edición entero |
| 5 | **Rutas:** `/owner/finanzas` (caja, egresos del mes, margen) y `/owner/finanzas/nuevo-egreso` (el formulario). Enlace **Finanzas** al lado de Métricas | El tablero de métricas queda en sus 3 llamadas y no cambia. La página nueva también resuelve en 3: identidad, `metricas_resumen` (que ya trae los ingresos) y `metricas_finanzas` | |
| 6 | **`metricas_finanzas` es `security definer`**, a diferencia de las de la parte 1 | Lee `sedes.costo_hora_clp`, que **no está concedido a `authenticated`** (PRD-0021), y las dos tablas nuevas. Con invoker fallaría con `permission denied for column`. Definer con `tiene_nivel('owner')` en la primera línea y `search_path` fijo. **Lo que anula de RLS lo compensa el chequeo**, y §8.3 del PRD ya pedía auditar `GET /rest/v1/` al cerrar | |
| 7 | **Comprobante: opcional, bucket privado `comprobantes-egresos`**, PDF/JPG/WebP hasta 2 MB, subida por Route Handler con service role, igual que las portadas de especiales | Copia un patrón que ya existe. Es la fase 4.5 y **se puede posponer sin tocar nada más**: la columna queda, el botón no | |
| 8 | **El margen por clase es solo de la parrilla.** Las especiales quedan fuera y la página lo dice | El variable de la profesora va por crédito consumido, y en una especial nadie consume créditos: no hay regla de pago definida para ellas (`CONTEXT.md` §5.b solo define packs y Teens). Inventarla acá sería inventar un dato | |
| 9 | **Créditos consumidos de una clase** = reservas con `credito_id` y `credito_devuelto = false`, en cualquier estado que no sea `pendiente_pago`, `expirada` ni `liberada` | Es el predicado de PRD §7.1.3 y §8.5.b, **el mismo** que atribuye ingreso. Una cancelación tardía consume y paga; una a tiempo no | |

**Dos preguntas que solo Felipe podía contestar** (regla: no inventar datos). Contestadas el
30/09/2026:

1. **¿Carli tiene sueldo base?** Sí: **$18.000 por hora para las clases de la parrilla**, como
   dice `CONTEXT.md` §5.b. La siembra pone $18.000 y $250 a todas. **Las especiales no llevan
   base: ahí la profesora recibe el 50% de lo recaudado después de descontar la sala.** Esa
   regla no se implementa en esta parte (decisión 8), pero queda anotada en el PRD y en
   `ARCHITECTURE.md` §10 porque va a haber que incorporarla.
2. **¿Las categorías son las que usa?** Sirven para empezar, y **tienen que ser editables**
   porque las va a revisar con Carla. Consecuencia sobre la decisión 3: la lista no va en un
   `check` sino en una tabla `categorias_egreso` (`slug`, `nombre`, `orden`, `activa`) con llave
   foránea desde `egresos.categoria`; se edita desde el Table Editor, sin pantalla propia en
   esta parte. Desactivar una la saca del formulario sin romper los egresos viejos.

### 0.2 El juez — valores esperados, calculados a mano

Sobre el escenario de PRD §11.4 ya sembrado en staging, más **seis egresos** que agrega la fase 3.
Las fechas son relativas al mes en curso, como todo el escenario.

**Egresos sembrados**

| # | Fecha | Categoría | Sede | Monto | Estado | Para qué |
|---|---|---|---|---|---|---|
| E1 | mes en curso, día 0,2 | `arriendo_sala` | Los Leones | $68.000 | vigente | Un arriendo de verdad: 4 × $17.000 |
| E2 | mes en curso, día 0,5 | `insumos` | — | $15.000 | vigente | Sin sede |
| E3 | mes en curso, día 0,6 | `marketing` | — | $20.000 | vigente | |
| E4 | mes en curso, día 0,3 | `servicios` | — | $99.000 | **anulado** | Prueba que `deleted_at` filtra |
| E5 | mes anterior, día 0,4 | `arriendo_sala` | Los Leones | $50.000 | vigente | El período anterior |
| E6 | hace 75 días | `otro` | — | $30.000 | vigente | Fuera de los dos períodos, como C0 |

**Costos sembrados por la migración:** `costos_profesoras` con `base_hora_clp = 18000` y
`variable_credito_clp = 250` para toda profesora existente. Sala: `sedes.costo_hora_clp` ya está
en staging (Los Leones $17.000, Diaguitas $0, EB $27.000).

**Valores esperados**

| Indicador | Esperado | Por qué |
|---|---|---|
| Egresos del mes | **$103.000** · 3 egresos | E1 + E2 + E3. E4 está anulado |
| Por categoría | arriendo $68.000 · marketing $20.000 · insumos $15.000 | Ordenado de mayor a menor |
| Egresos del mes anterior | **$50.000** · 1 | E5. E6 queda fuera |
| Ingresos del mes | $112.500 | Ya verificado en la parte 1; viene de `metricas_resumen` |
| **Caja neta del mes** | **$9.500** | 112.500 − 103.000 |
| Caja neta anterior | **−$6.000** | 44.000 − 50.000. Se muestra `-$6.000`, signo antes del peso |
| Variación de la caja | **+$15.500 · sin porcentaje** | El anterior es negativo: el % no significa nada |
| Créditos consumidos por clase dictada | CL1 **2** · CL2 **2** · CL3 **2** | CL2: Ana más la cancelación tardía de Cata, que consumió y no devolvió |
| Ingreso por clase | CL1 **$15.000** · CL2 **$7.000** · CL3 **$15.500** | Los mismos de §11.4, ahora por clase |
| Costo de profesora por clase | **$18.500** cada una | 18.000 × 1 h + 250 × 2 |
| Costo de sala por clase | `costo_hora_clp` de la sede de su horario × 1 h | La siembra elige tres horarios reales; la sede se lee, no se adivina |
| **Margen por clase** | CL1 **$15.000 − $18.500 − sala** · CL2 **$7.000 − $18.500 − sala** · CL3 **$15.500 − $18.500 − sala** | Con dos alumnas ninguna clase se paga sola: es lo que `CONTEXT.md` §5.b dice que pasa bajo 6 |
| Clases sin costo cargado | **0** | Y **1** dentro de la transacción revertida que borra el costo de la profesora de CL3 |
| Total del mes | La suma de sus propias filas | Staging tiene clases de parrilla reales con cero reservas (PRD §11.5): el total absoluto se corre solo, igual que la ocupación. Se contrasta la **consistencia** y las **tres filas del escenario** |
| Conciliación de lectura | egresos del mes de la función == suma de la lista que devuelve | La lista y el total salen de la misma consulta, pero es el mismo tipo de prueba que la franja de créditos: un valor que se conoce sin mirar los datos |

**Checkpoint:** Felipe confirma las 9 decisiones, contesta las 2 preguntas y revisa esta tabla.
Si un número está mal, se corrige acá y no después. Con eso, la parte 2 se escribe en el PRD como
**§17 — Parte 2, detalle** (modelo de datos, reglas, esta tabla) antes de la fase 2.

---

## Fase 1 — Las funciones puras, con sus tests primero

**Archivos:** `lib/dominio/finanzas.ts` (crear) · `lib/dominio/finanzas.test.ts` (crear)

Corre sola: no depende de la fase 0 salvo en los nombres, y si una decisión cambia se ajusta.

**Interfaces que produce** (las usan las fases 3 y 4, con estos nombres exactos):

```ts
// lib/dominio/finanzas.ts
import { valorReserva, type ReservaAtribuible } from "./metricas.ts";

/** Ingresos y egresos de un período. Los dos son enteros CLP. */
export type Caja = { ingresosClp: number; egresosClp: number };

export type CajaNeta = Caja & { netoClp: number };

/** Caja neta: lo que entró menos lo que se registró como salido. Nunca resta costos calculados. */
export function cajaNeta(c: Caja): CajaNeta {
  return { ...c, netoClp: c.ingresosClp - c.egresosClp };
}

export type ComparacionCaja = {
  actual: number;
  anterior: number | null;
  absoluta: number | null;
  /** Solo cuando el anterior es positivo. Contra cero o negativo, un % no significa nada. */
  relativa: number | null;
};

export function compararCaja(actual: number, anterior: number | null): ComparacionCaja {
  if (anterior === null || !Number.isFinite(anterior)) {
    return { actual, anterior: null, absoluta: null, relativa: null };
  }
  return {
    actual,
    anterior,
    absoluta: actual - anterior,
    relativa: anterior > 0 ? (actual - anterior) / anterior : null,
  };
}

export type CostoDeClase = {
  /** Duración en horas. Sin `fin`, una hora (CONTEXT.md §5.b). */
  horas: number;
  /** `sedes.costo_hora_clp`. `null` si nadie lo cargó. */
  costoHoraSalaClp: number | null;
  /** `costos_profesoras.base_hora_clp`. `null` si la profesora no tiene fila. */
  baseHoraProfesoraClp: number | null;
  /** `costos_profesoras.variable_credito_clp`. `null` si la profesora no tiene fila. */
  variableCreditoClp: number | null;
  /** Reservas que consumieron un crédito y no lo recuperaron. PRD §7.1.3 y §8.5.b. */
  creditosConsumidos: number;
};

export type Costo = {
  salaClp: number;
  profesoraClp: number;
  totalClp: number;
};

/**
 * Lo que costó dictar una clase. `null` si falta cualquiera de los tres costos:
 * un costo que no se cargó no es un costo de cero, es un dato que falta.
 */
export function costoClase(c: CostoDeClase): Costo | null {
  if (c.costoHoraSalaClp === null || c.baseHoraProfesoraClp === null || c.variableCreditoClp === null) {
    return null;
  }
  if (!Number.isFinite(c.horas) || c.horas <= 0) return null;
  const salaClp = Math.round(c.costoHoraSalaClp * c.horas);
  const profesoraClp =
    Math.round(c.baseHoraProfesoraClp * c.horas) + c.variableCreditoClp * c.creditosConsumidos;
  return { salaClp, profesoraClp, totalClp: salaClp + profesoraClp };
}

/**
 * Cuánto dura una clase, en horas. Sin `fin`, una hora: es la regla de
 * CONTEXT.md §5.b y lo que hace `generar_clases`, que no escribe `fin`. Las
 * especiales y el intensivo sí lo traen. `null` si `fin` no es posterior.
 */
export function horasDeClase(inicio: string, fin: string | null): number | null {
  if (fin === null) return 1;
  const ms = new Date(fin).getTime() - new Date(inicio).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms / 3_600_000;
}

/** Ingreso de una clase: la suma del valor de cada reserva que la pagó. Reusa la regla 7.1. */
export function ingresoClase(reservas: ReservaAtribuible[]): number {
  return reservas.reduce((suma, r) => suma + valorReserva(r) * (r.n ?? 1), 0);
}

export type ClaseConMargen = {
  ingresoClp: number;
  costo: Costo | null;
  /** `null` cuando el costo es `null`. Nunca un cero inventado. */
  margenClp: number | null;
};

export function margenClase(reservas: ReservaAtribuible[], costo: CostoDeClase): ClaseConMargen {
  const ingresoClp = ingresoClase(reservas);
  const c = costoClase(costo);
  return { ingresoClp, costo: c, margenClp: c === null ? null : ingresoClp - c.totalClp };
}

export type ResumenMargen = {
  /** Solo las clases con costo cargado. */
  clases: number;
  ingresoClp: number;
  costoClp: number;
  margenClp: number;
  /** Cuántas quedaron fuera por no tener costo. Se muestra siempre. */
  sinCosto: number;
};

export function resumenMargen(clases: ClaseConMargen[]): ResumenMargen {
  let n = 0, ingreso = 0, costo = 0, sinCosto = 0;
  for (const c of clases) {
    if (c.costo === null) { sinCosto++; continue; }
    n++;
    ingreso += c.ingresoClp;
    costo += c.costo.totalClp;
  }
  return { clases: n, ingresoClp: ingreso, costoClp: costo, margenClp: ingreso - costo, sinCosto };
}

export type EgresoAgrupable = { categoria: string; montoClp: number };

/** Total por categoría, de mayor a menor. Empates por nombre, para que el orden sea estable. */
export function porCategoria(egresos: EgresoAgrupable[]): { categoria: string; montoClp: number }[] {
  const suma = new Map<string, number>();
  for (const e of egresos) suma.set(e.categoria, (suma.get(e.categoria) ?? 0) + e.montoClp);
  return [...suma]
    .map(([categoria, montoClp]) => ({ categoria, montoClp }))
    .sort((a, b) => b.montoClp - a.montoClp || a.categoria.localeCompare(b.categoria));
}
```

- [ ] **1.1 Escribir `lib/dominio/finanzas.test.ts` con los números de la fase 0.2**, antes que el
      módulo:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  cajaNeta, compararCaja, costoClase, horasDeClase, ingresoClase, margenClase, porCategoria,
  resumenMargen,
} from "./finanzas.ts";

test("cajaNeta: el escenario, este mes y el anterior", () => {
  assert.equal(cajaNeta({ ingresosClp: 112_500, egresosClp: 103_000 }).netoClp, 9_500);
  assert.equal(cajaNeta({ ingresosClp: 44_000, egresosClp: 50_000 }).netoClp, -6_000);
});

test("compararCaja: contra un anterior negativo hay diferencia en pesos y no hay porcentaje", () => {
  const c = compararCaja(9_500, -6_000);
  assert.equal(c.absoluta, 15_500);
  assert.equal(c.relativa, null);
});

test("compararCaja: contra cero tampoco hay porcentaje; sin anterior no hay nada", () => {
  assert.equal(compararCaja(9_500, 0).relativa, null);
  assert.equal(compararCaja(9_500, 0).absoluta, 9_500);
  assert.deepEqual(compararCaja(9_500, null), { actual: 9_500, anterior: null, absoluta: null, relativa: null });
});

test("compararCaja: contra un anterior positivo sí hay porcentaje", () => {
  assert.equal(compararCaja(15_000, 10_000).relativa, 0.5);
});

const costoLeones = { horas: 1, costoHoraSalaClp: 17_000, baseHoraProfesoraClp: 18_000, variableCreditoClp: 250, creditosConsumidos: 2 };

test("costoClase: una hora en Los Leones con dos créditos consumidos", () => {
  assert.deepEqual(costoClase(costoLeones), { salaClp: 17_000, profesoraClp: 18_500, totalClp: 35_500 });
});

test("costoClase: Diaguitas cuesta cero de sala, no null", () => {
  assert.deepEqual(costoClase({ ...costoLeones, costoHoraSalaClp: 0 }), { salaClp: 0, profesoraClp: 18_500, totalClp: 18_500 });
});

test("costoClase: hora y media escala la sala y la base, no el variable", () => {
  assert.deepEqual(costoClase({ ...costoLeones, horas: 1.5 }), { salaClp: 25_500, profesoraClp: 27_500, totalClp: 53_000 });
});

test("costoClase: sin costo cargado devuelve null, nunca cero", () => {
  assert.equal(costoClase({ ...costoLeones, costoHoraSalaClp: null }), null);
  assert.equal(costoClase({ ...costoLeones, baseHoraProfesoraClp: null }), null);
  assert.equal(costoClase({ ...costoLeones, variableCreditoClp: null }), null);
  assert.equal(costoClase({ ...costoLeones, horas: 0 }), null);
});

test("costoClase: una clase vacía cuesta la base y la sala igual", () => {
  assert.equal(costoClase({ ...costoLeones, creditosConsumidos: 0 })?.totalClp, 35_000);
});

test("horasDeClase: sin fin dura una hora; con fin, lo que dure", () => {
  assert.equal(horasDeClase("2026-09-10T22:00:00Z", null), 1);
  assert.equal(horasDeClase("2026-09-10T22:00:00Z", "2026-09-10T23:30:00Z"), 1.5);
});

test("horasDeClase: un fin anterior o igual al inicio no es una duración", () => {
  assert.equal(horasDeClase("2026-09-10T22:00:00Z", "2026-09-10T22:00:00Z"), null);
  assert.equal(horasDeClase("2026-09-10T22:00:00Z", "2026-09-10T21:00:00Z"), null);
});

const ana = { montoCompraClp: 28_000, clasesCompra: 4, recuperoCredito: false, claseYaOcurrio: true };
const bea = { montoCompraClp: 16_000, clasesCompra: 2, recuperoCredito: false, claseYaOcurrio: true };
const cataRegalo = { montoCompraClp: null, clasesCompra: null, recuperoCredito: false, claseYaOcurrio: true };
const cataSuelta = { montoCompraClp: 8_500, clasesCompra: 1, recuperoCredito: false, claseYaOcurrio: true };

test("ingresoClase: CL1, CL2 y CL3 del escenario", () => {
  assert.equal(ingresoClase([ana, bea]), 15_000);
  assert.equal(ingresoClase([ana, cataRegalo]), 7_000);
  assert.equal(ingresoClase([ana, cataSuelta]), 15_500);
});

test("ingresoClase: acepta filas agrupadas con n", () => {
  assert.equal(ingresoClase([{ ...ana, n: 3 }]), 21_000);
});

test("margenClase: CL1 en Los Leones pierde plata con dos alumnas", () => {
  const m = margenClase([ana, bea], costoLeones);
  assert.equal(m.ingresoClp, 15_000);
  assert.equal(m.margenClp, 15_000 - 35_500);
});

test("margenClase: sin costo el margen es null aunque haya ingreso", () => {
  const m = margenClase([ana, bea], { ...costoLeones, baseHoraProfesoraClp: null });
  assert.equal(m.ingresoClp, 15_000);
  assert.equal(m.margenClp, null);
});

test("resumenMargen: suma solo las que tienen costo y cuenta las que no", () => {
  const conCosto = margenClase([ana, bea], costoLeones);
  const sinCosto = margenClase([ana], { ...costoLeones, costoHoraSalaClp: null });
  const r = resumenMargen([conCosto, sinCosto]);
  assert.equal(r.clases, 1);
  assert.equal(r.ingresoClp, 15_000);
  assert.equal(r.costoClp, 35_500);
  assert.equal(r.margenClp, -20_500);
  assert.equal(r.sinCosto, 1);
});

test("resumenMargen: sin clases da ceros y no NaN", () => {
  assert.deepEqual(resumenMargen([]), { clases: 0, ingresoClp: 0, costoClp: 0, margenClp: 0, sinCosto: 0 });
});

test("porCategoria: los egresos del escenario, de mayor a menor", () => {
  assert.deepEqual(
    porCategoria([
      { categoria: "arriendo_sala", montoClp: 68_000 },
      { categoria: "insumos", montoClp: 15_000 },
      { categoria: "marketing", montoClp: 20_000 },
    ]),
    [
      { categoria: "arriendo_sala", montoClp: 68_000 },
      { categoria: "marketing", montoClp: 20_000 },
      { categoria: "insumos", montoClp: 15_000 },
    ],
  );
});
```

- [ ] **1.2 Correr `node --test lib/dominio/finanzas.test.ts`** y ver que falla porque el módulo
      no existe.
- [ ] **1.3 Escribir `lib/dominio/finanzas.ts`** con el código de arriba.
- [ ] **1.4 Correr `npm test`** completo: los 8 de ofertas, los 37 de la parte 1 y estos
      pasan. Se muestra la salida.
- [ ] **1.5 Commit:** `PRD-0010 parte 2: el dominio de finanzas, con sus tests`.

**Checkpoint:** `npm test` en verde, con la salida pegada. Los nombres de este módulo son los
que usan las fases 3 y 4.

---

## Fase 2 — La migración

**Archivo:** `supabase/migrations/20261001120000_finanzas_egresos.sql` (crear)

Escrita y **no aplicada**. El `--dry-run` sí se corre: no escribe.

- [ ] **2.1 Las dos tablas, con RLS de solo owner** — las primeras del proyecto así:

```sql
-- PRD-0010 parte 2 — Egresos, costos de profesora y caja neta.
--
-- NO ejecutar a mano: se aplica con `supabase db push`, primero a staging y a
-- producción solo con aprobación.
--
-- QUÉ PROBLEMA RESUELVE
-- El tablero muestra ingresos brutos rotulados como brutos, porque no hay dónde
-- anotar lo que sale. Sin egresos no hay caja neta, y sin el costo de la
-- profesora en la base no hay margen por clase: `sedes.costo_hora_clp` ya está
-- (PRD-0021), el de la profesora no estaba en ninguna parte.
--
-- TRES DECISIONES
-- 1. La caja neta resta EGRESOS REGISTRADOS, no costos calculados. Si Carla
--    anota el arriendo que pagó y el sistema además lo calcula por clase, se
--    descuenta dos veces. Caja y margen responden preguntas distintas.
-- 2. `metricas_finanzas` es `security definer`, a diferencia de las de la
--    parte 1: lee `sedes.costo_hora_clp`, que no está concedido a
--    `authenticated`, y estas dos tablas. La primera línea es el chequeo de
--    owner; el `search_path` va fijo.
-- 3. Un egreso se registra y se anula; no se edita. Como el libro de créditos.

create table if not exists public.egresos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  -- Editable por Felipe y Carla (30/09/2026): la lista vive en una tabla, no
  -- en un check. Ver `categorias_egreso` más abajo.
  categoria text not null references public.categorias_egreso (slug) on delete restrict,
  descripcion text not null check (btrim(descripcion) <> ''),
  monto_clp int not null check (monto_clp > 0),
  sede_id uuid references public.sedes (id) on delete restrict,
  comprobante_path text,
  registrado_por uuid not null references public.perfiles (id),
  anulado_por uuid references public.perfiles (id),
  motivo_anulacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.egresos is
  'Lo que sale de la caja, registrado a mano por el owner. Borrado lógico: se anula, no se edita ni se borra (PRD-0010 parte 2).';

create index if not exists egresos_fecha_idx on public.egresos (fecha) where deleted_at is null;

create table if not exists public.costos_profesoras (
  profesora_id uuid primary key references public.profesoras (id) on delete restrict,
  base_hora_clp int not null check (base_hora_clp >= 0),
  variable_credito_clp int not null check (variable_credito_clp >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.costos_profesoras is
  'Lo que la academia le paga a cada profesora: base por hora más variable por crédito consumido (CONTEXT.md §5.b). Solo owner. Una fila por profesora; sin fila no hay margen, no hay cero.';

-- Todas parten con la regla general del 08/09/2026. Si alguna difiere, se
-- cambia acá antes de aplicar, no en el Table Editor.
insert into public.costos_profesoras (profesora_id, base_hora_clp, variable_credito_clp)
select id, 18000, 250 from public.profesoras
on conflict (profesora_id) do nothing;

-- public.tocar_updated_at() existe desde la migración de perfiles.
drop trigger if exists egresos_updated_at on public.egresos;
create trigger egresos_updated_at
  before update on public.egresos
  for each row execute function public.tocar_updated_at();

drop trigger if exists costos_profesoras_updated_at on public.costos_profesoras;
create trigger costos_profesoras_updated_at
  before update on public.costos_profesoras
  for each row execute function public.tocar_updated_at();

alter table public.egresos enable row level security;
alter table public.costos_profesoras enable row level security;

-- Sin ninguna otra política sobre estas tablas: lo que se suma con OR es cero.
-- Solo select; insert/update van por función.
revoke all on public.egresos, public.costos_profesoras from anon, authenticated;
grant select on public.egresos, public.costos_profesoras to authenticated;
grant all on public.egresos, public.costos_profesoras to service_role;

drop policy if exists egresos_owner_lee on public.egresos;
create policy egresos_owner_lee on public.egresos
  for select to authenticated using (public.tiene_nivel('owner'));

drop policy if exists costos_profesoras_owner_lee on public.costos_profesoras;
create policy costos_profesoras_owner_lee on public.costos_profesoras
  for select to authenticated using (public.tiene_nivel('owner'));
```

- [ ] **2.2 `registrar_egreso` y `anular_egreso`**, `security definer`, concedidas solo a
      `service_role`, con el actor como parámetro, igual que `crear_especial`:

```sql
create or replace function public.registrar_egreso(
  p_actor_user_id uuid,
  p_fecha date,
  p_categoria text,
  p_descripcion text,
  p_monto_clp int,
  p_sede_id uuid default null,
  p_comprobante_path text default null
)
returns public.egresos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_egreso public.egresos;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('owner') then
    raise exception 'Solo el owner registra egresos' using errcode = '42501';
  end if;
  if p_fecha is null then
    raise exception 'El egreso necesita fecha' using errcode = '23514';
  end if;
  if p_fecha > (now() at time zone 'America/Santiago')::date then
    raise exception 'La fecha no puede ser futura: un egreso es algo que ya se pagó'
      using errcode = '23514';
  end if;
  if p_monto_clp is null or p_monto_clp <= 0 then
    raise exception 'El monto tiene que ser mayor que cero' using errcode = '23514';
  end if;
  if coalesce(btrim(p_descripcion), '') = '' then
    raise exception 'Di qué se pagó' using errcode = '23514';
  end if;
  if p_sede_id is not null
     and not exists (select 1 from public.sedes where id = p_sede_id and deleted_at is null) then
    raise exception 'La sede no existe' using errcode = 'P0002';
  end if;

  -- La categoría la valida el check de la tabla; el mensaje de acá es cortesía.
  if p_categoria not in ('arriendo_sala', 'sueldo_profesora', 'marketing',
                         'insumos', 'servicios', 'otro') then
    raise exception 'Categoría desconocida' using errcode = '23514';
  end if;

  insert into public.egresos
    (fecha, categoria, descripcion, monto_clp, sede_id, comprobante_path, registrado_por)
  values
    (p_fecha, p_categoria, btrim(p_descripcion), p_monto_clp, p_sede_id,
     nullif(btrim(p_comprobante_path), ''), v_actor.id)
  returning * into v_egreso;

  return v_egreso;
end;
$$;

create or replace function public.anular_egreso(
  p_actor_user_id uuid,
  p_egreso_id uuid,
  p_motivo text
)
returns public.egresos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfiles;
  v_egreso public.egresos;
begin
  select * into v_actor from public.perfiles
  where user_id = p_actor_user_id and deleted_at is null;

  if v_actor is null or public.nivel_rol(v_actor.rol) < public.nivel_rol('owner') then
    raise exception 'Solo el owner anula egresos' using errcode = '42501';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Di por qué se anula' using errcode = '23514';
  end if;

  select * into v_egreso from public.egresos where id = p_egreso_id for update;
  if v_egreso is null then
    raise exception 'El egreso no existe' using errcode = 'P0002';
  end if;
  if v_egreso.deleted_at is not null then
    raise exception 'Ese egreso ya estaba anulado' using errcode = '22023';
  end if;

  update public.egresos
  set deleted_at = now(), anulado_por = v_actor.id, motivo_anulacion = btrim(p_motivo),
      updated_at = now()
  where id = v_egreso.id
  returning * into v_egreso;

  return v_egreso;
end;
$$;
```

- [ ] **2.3 `metricas_finanzas`**: agrega y agrupa; no divide. Devuelve los egresos de los dos
      períodos, la lista del actual, y por cada clase de parrilla dictada del período sus costos
      y su atribución **agrupada** como en `metricas_demanda`:

```sql
create or replace function public.metricas_finanzas(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_desde_ant timestamptz,
  p_hasta_ant timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_salida jsonb;
begin
  -- Primera línea, porque esta función es `security definer` y RLS no la frena.
  if not public.tiene_nivel('owner') then
    raise exception 'Solo el owner ve las finanzas del negocio' using errcode = '42501';
  end if;
  if p_hasta <= p_desde or p_hasta_ant <= p_desde_ant then
    raise exception 'El periodo termina antes de empezar' using errcode = '22023';
  end if;

  with
  -- `fecha` es un día de Santiago; el período llega en timestamptz. Se
  -- convierte el borde, no cada fila.
  bordes as (
    select (p_desde at time zone 'America/Santiago')::date as d1,
           (p_hasta at time zone 'America/Santiago')::date as d2,
           (p_desde_ant at time zone 'America/Santiago')::date as a1,
           (p_hasta_ant at time zone 'America/Santiago')::date as a2
  ),
  vigentes as (
    select e.id, e.fecha, e.categoria, e.descripcion, e.monto_clp, e.sede_id, e.comprobante_path,
           s.nombre as sede
    from public.egresos e
    left join public.sedes s on s.id = e.sede_id
    where e.deleted_at is null
  ),
  eg_act as (
    select coalesce(sum(monto_clp), 0)::bigint as total_clp, count(*)::int as n
    from vigentes, bordes where fecha >= d1 and fecha < d2
  ),
  eg_ant as (
    select coalesce(sum(monto_clp), 0)::bigint as total_clp, count(*)::int as n
    from vigentes, bordes where fecha >= a1 and fecha < a2
  ),
  eg_hist as (
    select coalesce(sum(monto_clp), 0)::bigint as total_clp, count(*)::int as n,
           max(fecha) as ultimo_egreso
    from vigentes
  ),
  -- Clases de parrilla del período que ya ocurrieron y no se cancelaron. Las
  -- especiales quedan fuera: no hay regla de pago de profesora para ellas.
  dictadas as (
    select cl.id, cl.inicio, cl.fin, cl.profesora_id, cl.sede_id,
           cu.nombre as curso, pr.nombre as profesora, se.nombre as sede,
           se.costo_hora_clp,
           cp.base_hora_clp, cp.variable_credito_clp
    -- Se devuelven `inicio` y `fin`; las horas las calcula `horasDeClase` en
    -- lib/dominio/finanzas.ts. Acá no se divide.
    from public.clases cl
    join public.cursos cu on cu.id = cl.curso_id
    join public.profesoras pr on pr.id = cl.profesora_id
    join public.sedes se on se.id = cl.sede_id
    left join public.costos_profesoras cp on cp.profesora_id = cl.profesora_id
    where cl.tipo = 'parrilla'
      and cl.estado <> 'cancelada'
      and cl.inicio >= p_desde and cl.inicio < p_hasta
      and cl.inicio < now()
  ),
  -- El mismo predicado que atribuye ingreso (PRD §7.1.3): consumió y no recuperó.
  consumidas as (
    select r.clase_id, count(*)::int as n
    from public.reservas r
    join dictadas d on d.id = r.clase_id
    where r.credito_id is not null
      and r.credito_devuelto = false
      and r.estado not in ('pendiente_pago', 'expirada', 'liberada')
    group by r.clase_id
  ),
  atribucion as (
    select r.clase_id,
           co.monto_clp as monto_compra_clp,
           co.cantidad_clases as clases_compra,
           r.credito_devuelto as recupero_credito,
           count(*)::int as n
    from public.reservas r
    join dictadas d on d.id = r.clase_id
    join public.creditos cr on cr.id = r.credito_id
    left join public.compras co on co.id = cr.compra_id and co.deleted_at is null
    where r.estado not in ('pendiente_pago', 'expirada', 'liberada')
    group by r.clase_id, co.monto_clp, co.cantidad_clases, r.credito_devuelto
  )
  select jsonb_build_object(
    'meta', jsonb_build_object(
      'desde', p_desde, 'hasta', p_hasta,
      'desde_anterior', p_desde_ant, 'hasta_anterior', p_hasta_ant,
      'generado_at', now()
    ),
    'egresos', jsonb_build_object(
      'total_clp', (select total_clp from eg_act),
      'n', (select n from eg_act),
      'lista', coalesce(
        (select jsonb_agg(jsonb_build_object(
           'id', id, 'fecha', fecha, 'categoria', categoria, 'descripcion', descripcion,
           'monto_clp', monto_clp, 'sede', sede, 'tiene_comprobante', comprobante_path is not null
         ) order by fecha desc, monto_clp desc)
         from vigentes, bordes where fecha >= d1 and fecha < d2),
        '[]'::jsonb)
    ),
    'egresos_anterior', jsonb_build_object(
      'total_clp', (select total_clp from eg_ant), 'n', (select n from eg_ant)
    ),
    'desde_siempre', jsonb_build_object(
      'total_clp', (select total_clp from eg_hist), 'n', (select n from eg_hist),
      'ultimo_egreso', (select ultimo_egreso from eg_hist)
    ),
    'por_clase', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'clase_id', d.id, 'inicio', d.inicio, 'curso', d.curso,
         'profesora', d.profesora, 'sede', d.sede,
         'fin', d.fin,
         'costo_hora_sala_clp', d.costo_hora_clp,
         'base_hora_profesora_clp', d.base_hora_clp,
         'variable_credito_clp', d.variable_credito_clp,
         'creditos_consumidos', coalesce(c.n, 0),
         'atribucion', coalesce(
           (select jsonb_agg(jsonb_build_object(
              'monto_compra_clp', a.monto_compra_clp, 'clases_compra', a.clases_compra,
              'recupero_credito', a.recupero_credito, 'n', a.n
            )) from atribucion a where a.clase_id = d.id),
           '[]'::jsonb)
       ) order by d.inicio)
       from dictadas d left join consumidas c on c.clase_id = d.id),
      '[]'::jsonb)
  )
  into v_salida;

  return v_salida;
end;
$$;
```

- [ ] **2.4 El bucket privado** `comprobantes-egresos` (2 MB, `application/pdf`, `image/jpeg`,
      `image/webp`), copiado del de portadas. Sin políticas para `anon` ni `authenticated`.
- [ ] **2.5 Permisos, escritos:**

```sql
revoke all on function public.metricas_finanzas(timestamptz, timestamptz, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.metricas_finanzas(timestamptz, timestamptz, timestamptz, timestamptz)
  to authenticated, service_role;

revoke all on function public.registrar_egreso(uuid, date, text, text, int, uuid, text)
  from public, anon, authenticated;
grant execute on function public.registrar_egreso(uuid, date, text, text, int, uuid, text)
  to service_role;

revoke all on function public.anular_egreso(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.anular_egreso(uuid, uuid, text) to service_role;
```

- [ ] **2.6 `npx supabase db push --dry-run`** con la CLI en staging (`cat supabase/.temp/project-ref`
      → `ybopuahlzbjkkwumkllk`, verificado el 30/09). Se muestra la salida.
- [ ] **2.7 Commit:** `PRD-0010 parte 2: egresos, costos de profesora y metricas_finanzas, escrita
      y sin aplicar`.

**Checkpoint:** el dry-run lista solo esta migración. **Queda escrita y sin aplicar.** Aplicarla a
staging es la primera línea de la fase 3 y necesita aprobación en ese mensaje.

---

## Fase 3 — Staging: sembrar y contrastar contra el juez

**Archivos:** `scripts/sembrar-escenario.mjs` (modificar) · `scripts/verificar-finanzas.mjs`
(crear)

- [ ] **3.1 `npx supabase db push` a staging** — ⚠️ solo con aprobación de Felipe en ese mensaje.
- [ ] **3.2 Extender la siembra** con los seis egresos de la fase 0.2, con UUID fijos
      (`66666666-6666-4666-8666-00000000000N`) e idempotentes: se borran los suyos al empezar,
      como el resto. Se insertan **directo** con `registrado_por = perfil.owner`; E4 lleva
      `deleted_at`, `anulado_por` y motivo. La sede de E1 y E5 es `seduccion-latina` por slug.
      Las fechas usan `enEsteMes(0.2)` y compañía, convertidas a `date`.
- [ ] **3.3 Escribir `scripts/verificar-finanzas.mjs`** al estilo de `verificar-metricas.mjs`:
      `comoUsuario(OWNER, …)` con `set local role authenticated`, deriva con
      `lib/dominio/finanzas.ts` (nunca reimplementa), imprime cada fila con ✓/✗ y sale con 1 si
      falla algo. Cubre, en este orden:
  1. Egresos del mes: `$103.000 · 3`; por categoría en el orden esperado; anterior `$50.000 · 1`;
     E4 y E6 ausentes de la lista.
  2. Caja neta `9.500` y anterior `−6.000` usando `metricas_resumen` para los ingresos, que es
     lo que hará la página. Variación `+15.500`, relativa `null`.
  3. Las tres clases del escenario por id: consumidos `2 · 2 · 2`, ingreso `15.000 · 7.000 ·
     15.500`, costo de profesora `18.500` cada una, costo de sala = `costo_hora_clp` de su sede
     (leído con una consulta aparte), margen = ingreso − 18.500 − sala.
  4. `resumenMargen` sobre todas las filas: `sinCosto === 0`, y `margenClp` igual a la suma de las
     filas (consistencia, porque el total absoluto incluye clases reales de staging — PRD §11.5).
  5. **Transacción revertida:** `delete from costos_profesoras where profesora_id = (profesora de
     CL3)` → la fila de CL3 trae `base_hora_profesora_clp: null`, `margenClase` da `null`, y
     `sinCosto === 1`.
  6. **Transacciones revertidas contra `registrar_egreso`** (como `service_role` con el actor
     owner): monto `0` → `23514`; fecha de mañana → `23514`; categoría `'viajes'` → `23514`;
     descripción vacía → `23514`; actor **admin** → `42501`. Y una válida que devuelve la fila,
     seguida de `anular_egreso` con motivo vacío → `23514` y con motivo → `deleted_at` puesto.
  7. **RLS preguntado, no leído:** `select count(*) from egresos` como owner → 6 (contando E4,
     que la política no filtra: el filtro de `deleted_at` es de la consulta); como **admin** → 0;
     como **anon** → error de permiso. Lo mismo sobre `costos_profesoras`.
  8. `metricas_finanzas` como admin → `42501`; como anon → error.
- [ ] **3.4 Correr `node scripts/sembrar-escenario.mjs` y `node scripts/verificar-finanzas.mjs`.**
      Se muestra la salida completa, no un "coincide".
- [ ] **3.5 Correr `node scripts/verificar-metricas.mjs`**: la parte 1 no se movió (salvo la
      ocupación, que ya se sabe que se corre sola).
- [ ] **3.6 Commit:** `PRD-0010 parte 2: el escenario con egresos y su verificador`.

**Checkpoint:** las filas del juez, una por una, en la salida del verificador. Si una no calza,
el defecto está en el SQL o en el dominio, y se ve sin la interfaz de por medio.

---

## Fase 4 — La interfaz

**Archivos:**
- `lib/finanzas-consultas.ts` (crear) — tipos y `getFinanzas(periodo, anterior)`.
- `lib/acciones.ts` (modificar) — `registrarEgreso(FormData)` y `anularEgreso(id, motivo)`.
- `app/(owner)/owner/finanzas/page.tsx` (crear).
- `app/(owner)/owner/finanzas/nuevo-egreso/page.tsx` (crear).
- `components/FormularioEgreso.tsx` (crear, cliente).
- `components/Portal.tsx` (modificar) — el enlace **Finanzas** en el grupo de owner.
- `app/(owner)/owner/metricas/page.tsx` (modificar) — las dos tarjetas `SinDato` de caja neta y
  margen pasan a enlazar a `/owner/finanzas`.

**Interfaces:**

```ts
// lib/finanzas-consultas.ts
export type EgresoFila = {
  id: string; fecha: string; categoria: string; descripcion: string;
  monto_clp: number; sede: string | null; tiene_comprobante: boolean;
};
export type GrupoAtribucionClase = {
  monto_compra_clp: number | null; clases_compra: number | null;
  recupero_credito: boolean; n: number;
};
export type ClaseFinanzas = {
  clase_id: string; inicio: string; fin: string | null; curso: string; profesora: string; sede: string;
  costo_hora_sala_clp: number | null;
  base_hora_profesora_clp: number | null;
  variable_credito_clp: number | null;
  creditos_consumidos: number;
  atribucion: GrupoAtribucionClase[];
};
export type Finanzas = {
  meta: { desde: string; hasta: string; desde_anterior: string; hasta_anterior: string; generado_at: string };
  egresos: { total_clp: number; n: number; lista: EgresoFila[] };
  egresos_anterior: { total_clp: number; n: number };
  desde_siempre: { total_clp: number; n: number; ultimo_egreso: string | null };
  por_clase: ClaseFinanzas[];
};
export async function getFinanzas(periodo: Periodo, anterior: Periodo): Promise<Lectura<Finanzas | null>>;
export const CATEGORIAS: { valor: string; nombre: string }[]; // 'arriendo_sala' → "Arriendo de sala", etc.
```

- [ ] **4.1 `lib/finanzas-consultas.ts`**, calcado de `metricas-consultas.ts`: `clienteServidor()`,
      `rpc("metricas_finanzas", …)`, `Lectura<Finanzas | null>`, `comoTexto`. Sin cálculos.
- [ ] **4.2 Las dos acciones en `lib/acciones.ts`**, con la forma de `crearEspecial`:
      `perfilActual()` → `tieneNivel(actor.rol, "owner")` o `{ ok: false }` → `clienteAdmin().rpc(
      "registrar_egreso", { p_actor_user_id: actor.userId, p_fecha, p_categoria, p_descripcion,
      p_monto_clp, p_sede_id })` → `comoMensaje` → `revalidatePath("/owner/finanzas")`. El monto
      se parsea con `Number.parseInt` y se rechaza si no es entero positivo **antes** de llamar,
      con mensaje propio; la fecha va como `YYYY-MM-DD` tal cual sale del `<input type="date">`.
- [ ] **4.3 `/owner/finanzas`** — `requiereNivel("owner", "owner")`, `mesEnCurso()` y
      `mesAnterior()`, `Promise.all([getResumen(periodo, anterior), getFinanzas(periodo, anterior)])`.
      Tres llamadas contadas: identidad memoizada, resumen, finanzas. Bloques, en este orden:
  1. **Caja** — `Indicador destacado` "Caja neta del mes" con `clpConSigno` cuando es negativa
     y `clp` cuando no; denominador `"$112.500 que entraron menos $103.000 que salieron"`;
     `comparacion` desde `compararCaja` (se adapta al tipo `Comparado` de `Metricas.tsx`, que ya
     acepta `relativa: null`); `sinDatoDesde` cuando ingresos y egresos son cero: "Cero este mes.
     Último egreso registrado: …" o "nunca". Al lado: "Ingresos del mes" y "Egresos del mes"
     con su `n` y su comparación. Bajada del bloque: *"Lo que entró por packs pagados menos lo
     que se registró como salido. Los costos de sala y profesora de abajo no se restan acá: si
     pagaste el arriendo, va como egreso, y descontarlo dos veces sería mentir."*
  2. **Egresos del mes** — botón "Registrar un egreso" → `/owner/finanzas/nuevo-egreso`. `Tabla`
     con Fecha · Qué · Categoría · Sede · Monto, ordenada como llega, y un botón "Anular" por fila
     que abre un `<form>` con motivo y llama `anularEgreso`. Debajo, `porCategoria` en una tabla
     corta. Estado vacío **solo sin error**: "Ningún egreso registrado en {mes}. El último fue el
     … / Nunca se ha registrado uno."
  3. **Margen por clase dictada** — por cada fila de `por_clase`:
     `margenClase(c.atribucion.map((a) => ({ montoCompraClp: a.monto_compra_clp, clasesCompra:
     a.clases_compra, recuperoCredito: a.recupero_credito, claseYaOcurrio: true, n: a.n })),
     { horas: horasDeClase(c.inicio, c.fin) ?? 0, costoHoraSalaClp: c.costo_hora_sala_clp,
     baseHoraProfesoraClp: c.base_hora_profesora_clp, variableCreditoClp: c.variable_credito_clp,
     creditosConsumidos: c.creditos_consumidos })` y `resumenMargen` sobre el resultado.
     `claseYaOcurrio` va en `true` porque la función solo devuelve clases pasadas; `horas` en `0`
     hace que `costoClase` dé `null`, que es lo correcto para un `fin` inválido.
     `Indicador` "Margen del mes" con `clpConSigno`, denominador `"{ingreso} de ingreso menos
     {costo} de costo, en {n} clases de parrilla"`, y nota si `sinCosto > 0`: *"{n} clases sin
     costo cargado quedaron fuera: falta el costo de sala o de la profesora."* `Tabla` por clase:
     Clase (curso, fecha y hora en `hora24`, profesora) · Sede · Alumnas (consumidos) · Ingreso ·
     Costo · Margen; margen `null` se imprime "sin costo cargado" en `text-xo-gris`. Bajada:
     *"Solo clases de la parrilla que ya ocurrieron. Las especiales quedan fuera porque no hay
     regla de pago de profesora para ellas. El costo es lo que cuesta dictarla: la hora de sala
     más la base de la profesora más $250 por crédito consumido."* — el "$250" **se lee** de la
     fila, no se escribe: si todas las clases tienen el mismo variable se muestra, si no, se omite.
  4. `<ErrorDeLectura que="las finanzas del negocio" denegado="Las finanzas son solo del owner." />`
     y otro para el resumen, cada uno antes de su bloque.
- [ ] **4.4 `/owner/finanzas/nuevo-egreso`** con `FormularioEgreso`: fecha (`type="date"`, valor
      inicial hoy en Santiago, `max` hoy), categoría (`<select>` desde `CATEGORIAS`), qué se pagó
      (`input` requerido), monto (`inputmode="numeric"`, entero, `min=1`), sede (`<select>`
      opcional, desde `sedes` activas leídas como en `getOpcionesEspecial`). Mismo `ENTRADA` y
      `Campo` que `FormularioEspecial` (se extraen a `components/Campo.tsx` si se repiten tres
      veces; con dos, se copian). `useTransition`, `fallo`/`aviso`, y al guardar `router.push(
      "/owner/finanzas")`.
- [ ] **4.5 Comprobante** (posponible): `app/api/egresos/comprobante/route.ts` calcado de
      `especiales/portada`: owner, `application/pdf`/`image/jpeg`/`image/webp`, 2 MB, ruta
      `${egresoId}.${ext}`, y **la columna la escribe una función**, no un update directo. Para eso
      la migración de la fase 2 incluye `adjuntar_comprobante_egreso(p_actor_user_id, p_egreso_id,
      p_path)` con el mismo chequeo de owner (o se agrega en una migración chica si esta fase se
      pospone). En la lista, "ver" abre una URL firmada de 10 minutos generada en el servidor.
- [ ] **4.6 `Portal.tsx`**: `{ href: "/owner/finanzas", texto: "Finanzas" }` junto a Métricas.
      **Solo ese arreglo**; no se toca nada más del componente.
- [ ] **4.7 `owner/metricas/page.tsx`**: las tarjetas "Caja neta" y "Margen por clase dictada" de
      `BloqueRecortes` se reemplazan por un párrafo con enlace a `/owner/finanzas`. Queda solo la
      de Teens.
- [ ] **4.8 `npm run lint` y `npm run build`.**
- [ ] **4.9 Commit:** `PRD-0010 parte 2: la página de finanzas y el formulario de egresos`.

**Checkpoint:** build en verde y la página levantada contra **staging** (`.env.local` apuntando a
staging, regla de `supabase/README.md`; en el computador de la oficina hoy apunta a producción y
hay que cambiarlo para verificar). Se mira antes de la fase 5.

---

## Fase 5 — Probar el artefacto, no la función

Con el escenario sembrado y `.env.local` en staging:

- [ ] **5.1 Owner real en `/owner/finanzas`**: los valores del juez **en pantalla**. Fijarse en lo
      que la parte 1 enseñó: `-$6.000` y no `$-6.000`, "1 egreso" y no "1 egresos", horas en 24 h.
- [ ] **5.2 Registrar un egreso desde el formulario** (no desde SQL): aparece en la lista, la caja
      baja exactamente ese monto, y `verificar-finanzas.mjs` lo ve. Después **anularlo desde el
      botón**: desaparece de la lista, la caja vuelve, y la fila sigue en la base con `deleted_at`.
- [ ] **5.3 Los rechazos por el formulario**: monto `0`, fecha de mañana. El mensaje que se ve es
      el de la función, no "Algo falló".
- [ ] **5.4 Sesión admin**: `/owner/finanzas` por URL directa rebota a `/admin`; con su JWT,
      `POST /rest/v1/rpc/metricas_finanzas` → `42501`; `POST /rest/v1/rpc/registrar_egreso` →
      permiso denegado (no está concedida a `authenticated`); `GET /rest/v1/egresos` → `[]`.
- [ ] **5.5 `GET /rest/v1/`**: lo nuevo que expone la API es `egresos`, `costos_profesoras` y
      `metricas_finanzas`, y nada más. Y `anon` sobre las dos tablas → error de permiso.
- [ ] **5.6 Llamadas por render de `/owner/finanzas`**: **≤ 3**, contadas con un `fetch`
      instrumentado en `createServerClient`. No se commitea.
- [ ] **5.7 A 375 px**: la tabla de clases se desplaza sola, nada desborda, el formulario se usa
      con una mano.

**Checkpoint:** cada punto con su evidencia (captura o salida), no un "listo".

---

## Fase 6 — Cierre

- [ ] **6.1 `npm run build` y `npm test`.**
- [ ] **6.2 PRD-0010**: estado de la cabecera, **§17 — Parte 2, detalle** (si no se escribió en la
      fase 0) y **§18 — Notas de implementación, parte 2**: lo que se desvió, lo que quedó
      pendiente. Marcar §3.8 y §3.9 como hechos.
- [ ] **6.3 `ROADMAP.md`**: 5.2 con ✅ y una línea en el changelog con fecha.
- [ ] **6.4 `ARCHITECTURE.md`**: §5.6 con las tablas reales (`egresos` con sus columnas,
      `costos_profesoras`), la nota de §5.2 sobre mover `costo_hora_clp` ("puede moverse ahí")
      resuelta o descartada, y en §10 la deuda nueva si la hay (por ejemplo, el comprobante si se
      pospuso).
- [ ] **6.5 La migración queda aplicada a staging y sin aplicar a producción**, para que Felipe la
      apruebe cuando quiera. Se dice explícitamente en el mensaje de cierre.

`CONTEXT.md` no se toca sin confirmarlo con Felipe. Si la respuesta a la pregunta sobre Carli
cambia la economía unitaria, es él quien decide si va ahí.

---

## Lo que puedo hacer sin Felipe, y dónde me detengo

| Fase | Estado |
|---|---|
| 0 | **Bloqueada**: 9 decisiones y 2 preguntas |
| 1 | Corre sola. Tests y dominio |
| 2 | Se escribe sola; el `db push` a staging **necesita aprobación en ese mensaje** |
| 3 | Después del push a staging |
| 4 | Se puede escribir en paralelo con la 3, pero no verificar antes |
| 5 y 6 | Después de la 3 y la 4 |

---

## Fuera de este plan, a propósito

- **Parte 3** (liquidación de profesoras, `clases.estado` `dictada`/`no_dictada`, causa y
  reemplazo). Reusa `costos_profesoras` y el predicado de créditos consumidos de acá; no se
  adelanta nada de su esquema.
- **Mover `sedes.costo_hora_clp`** a una tabla de finanzas. `ARCHITECTURE.md` §5.2 lo deja como
  posibilidad, no como necesidad: los grants por columna funcionan y ya están verificados.
- **Editar un egreso.** Se anula y se registra de nuevo (decisión 4).
- **Egresos recurrentes** (el arriendo todos los meses). Cuando haya tres meses registrados a mano
  se sabrá si vale la pena.
- **Los dos pendientes del PRD-0020** (métricas por link, aviso de promoción vencida). Anotados
  aparte el 30/09; no son de este trabajo.
