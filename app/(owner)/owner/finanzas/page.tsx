import type { Metadata } from "next";
import Link from "next/link";
import { TituloPortal } from "@/components/Portal";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { ListaEgresos } from "@/components/ListaEgresos";
import {
  Bloque,
  Celda,
  Fila,
  Indicador,
  Rejilla,
  Tabla,
  clpConSigno,
  fechaCorta,
  hora24,
  plural,
} from "@/components/Metricas";
import { requiereNivel } from "@/lib/sesion";
import { clp } from "@/lib/planes";
import { getResumen } from "@/lib/metricas-consultas";
import { getFinanzas, type ClaseFinanzas } from "@/lib/finanzas-consultas";
import { diaLegible, mesAnterior, mesEnCurso, nombreDelMes } from "@/lib/dominio/periodo";
import { comparar } from "@/lib/dominio/metricas";
import {
  cajaNeta,
  compararCaja,
  horasDeClase,
  margenClase,
  porCategoria,
  resumenMargen,
} from "@/lib/dominio/finanzas";

export const metadata: Metadata = {
  title: "Finanzas — XO Dance Studio",
  robots: { index: false, follow: false },
};

/**
 * La caja del owner. PRD-0010 parte 2.
 *
 * Dos preguntas distintas, a propósito. **Cuánto quedó**: lo que entró por
 * packs pagados menos lo que se registró como salido. **Cuánto deja cada
 * clase**: el ingreso atribuido a la clase menos lo que cuesta dictarla —sala,
 * base de la profesora y $250 por crédito consumido—. La segunda no se resta
 * de la primera: si el arriendo se pagó, va como egreso, y restarlo dos veces
 * sería mentir.
 *
 * Tres llamadas: la identidad (memoizada), `metricas_resumen`, que ya trae
 * los ingresos, y `metricas_finanzas`. Ningún cálculo vive acá.
 */
export default async function Finanzas() {
  await requiereNivel("owner", "owner");

  const periodo = mesEnCurso();
  const anterior = mesAnterior(periodo);

  const [resumen, finanzas] = await Promise.all([
    getResumen(periodo, anterior),
    getFinanzas(periodo, anterior),
  ]);

  const R = resumen.datos;
  const F = finanzas.datos;
  const mes = nombreDelMes(periodo);

  return (
    <>
      <TituloPortal
        eyebrow="Portal del owner"
        titulo="Finanzas"
        bajada={`${capitalizar(mes)}, comparado con ${nombreDelMes(anterior)}. Lo que entró menos lo que salió, y lo que deja cada clase dictada. Son dos preguntas distintas y acá van separadas.`}
      />

      <ErrorDeLectura
        que="las finanzas del negocio"
        error={finanzas.error}
        denegado="Las finanzas son solo del owner. Un admin ve toda la operación, pero no los montos."
      />
      <ErrorDeLectura que="los ingresos del mes" error={resumen.error} />

      {F && R ? (
        <>
          <BloqueCaja
            ingresos={R.venta.ingresos_clp}
            compras={R.venta.compras}
            ingresosAnt={R.venta_anterior.ingresos_clp}
            egresos={F.egresos.total_clp}
            n={F.egresos.n}
            egresosAnt={F.egresos_anterior.total_clp}
            ultimoEgreso={F.desde_siempre.ultimo_egreso}
            ultimaCompra={R.desde_siempre.ultima_compra_at}
            leidoA={hora24(F.meta.generado_at)}
          />
          <BloqueEgresos F={F} mes={mes} />
          <BloqueMargen clases={F.por_clase} />
        </>
      ) : F ? (
        // Sin el resumen no hay ingresos, así que no hay caja; los egresos sí.
        <BloqueEgresos F={F} mes={mes} />
      ) : null}
    </>
  );
}

type Datos = NonNullable<Awaited<ReturnType<typeof getFinanzas>>["datos"]>;

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Una cifra de caja: negativa con el signo antes del peso, positiva sin signo. */
function pesos(monto: number): string {
  return monto < 0 ? clpConSigno(monto) : clp(monto);
}

function BloqueCaja({
  ingresos,
  compras,
  ingresosAnt,
  egresos,
  n,
  egresosAnt,
  ultimoEgreso,
  ultimaCompra,
  leidoA,
}: {
  ingresos: number;
  compras: number;
  ingresosAnt: number;
  egresos: number;
  n: number;
  egresosAnt: number;
  ultimoEgreso: string | null;
  ultimaCompra: string | null;
  leidoA: string;
}) {
  const caja = cajaNeta({ ingresosClp: ingresos, egresosClp: egresos });
  const cajaAnt = cajaNeta({ ingresosClp: ingresosAnt, egresosClp: egresosAnt });
  const cmp = compararCaja(caja.netoClp, cajaAnt.netoClp);

  const nadaEsteMes = ingresos === 0 && egresos === 0;
  // `ultimaCompra` es un timestamptz; `ultimoEgreso` es un `date`, y un date
  // leído como instante cae un día antes en Santiago. Cada uno con su formato.
  const ultimoDato = [fechaCorta(ultimaCompra), diaLegible(ultimoEgreso)].filter(Boolean);

  return (
    <Bloque
      titulo="Caja"
      bajada="Lo que entró por packs pagados menos lo que se registró como salido. Los costos de sala y profesora de más abajo no se restan acá: si pagaste el arriendo, va como egreso, y descontarlo dos veces sería mentir."
    >
      <Rejilla>
        <Indicador
          destacado
          rotulo="Caja neta del mes"
          valor={pesos(caja.netoClp)}
          denominador={`${clp(ingresos)} que entraron menos ${clp(egresos)} que salieron`}
          comparacion={cmp}
          comparacionEnPesos
          sinDatoDesde={
            nadaEsteMes
              ? ultimoDato.length > 0
                ? `Cero este mes. Último movimiento registrado: ${ultimoDato.join(" y ")}.`
                : "Cero este mes, y nunca ha entrado ni salido nada en el sistema."
              : undefined
          }
          nota={
            cmp.relativa === null && cmp.absoluta !== null && cajaAnt.netoClp <= 0
              ? `El mes anterior cerró en ${pesos(cajaAnt.netoClp)}: contra un cero o un negativo el porcentaje no dice nada, así que va solo la diferencia.`
              : undefined
          }
        />
        <Indicador
          rotulo="Ingresos del mes"
          valor={clp(ingresos)}
          denominador={plural(compras, "compra pagada", "compras pagadas")}
          comparacion={comparar(ingresos, ingresosAnt)}
          comparacionEnPesos
        />
        <Indicador
          rotulo="Egresos del mes"
          valor={clp(egresos)}
          denominador={plural(n, "egreso registrado", "egresos registrados")}
          comparacion={comparar(egresos, egresosAnt)}
          comparacionEnPesos
          sinDatoDesde={
            egresos === 0
              ? diaLegible(ultimoEgreso)
                ? `Ninguno este mes. El último registrado fue el ${diaLegible(ultimoEgreso)}.`
                : "Ninguno este mes, y nunca se ha registrado uno."
              : undefined
          }
        />
      </Rejilla>
      <p className="mt-3 text-sm text-xo-gris">Leído a las {leidoA}.</p>
    </Bloque>
  );
}

function BloqueEgresos({ F, mes }: { F: Datos; mes: string }) {
  const categorias = porCategoria(
    F.egresos.lista.map((e) => ({ categoria: e.categoria_nombre, montoClp: e.monto_clp })),
  );

  return (
    <Bloque
      titulo="Egresos del mes"
      bajada="Cada uno con su fecha, su categoría y, si lo subiste, su comprobante. Uno equivocado se anula con motivo y se registra de nuevo: no se edita, para que la caja de un mes cerrado no cambie sola."
    >
      <Link
        href="/owner/finanzas/nuevo-egreso"
        className="xo-eyebrow mb-6 inline-block rounded-full bg-xo-rosa px-6 py-3.5 text-xo-negro transition-opacity hover:opacity-80"
      >
        Registrar un egreso
      </Link>

      {F.egresos.lista.length > 0 ? (
        <>
          <ListaEgresos egresos={F.egresos.lista} />
          <h3 className="xo-eyebrow mt-8 mb-3 text-xo-gris">Por categoría</h3>
          <Tabla columnas={["Categoría", "Monto"]}>
            {categorias.map((c) => (
              <Fila key={c.categoria}>
                <Celda principal>{c.categoria}</Celda>
                <Celda>{clp(c.montoClp)}</Celda>
              </Fila>
            ))}
          </Tabla>
        </>
      ) : (
        // El vacío solo se muestra si NO hubo error: eso lo decide la página.
        <p className="text-xo-gris">
          Ningún egreso registrado en {mes}.{" "}
          {diaLegible(F.desde_siempre.ultimo_egreso)
            ? `El último fue el ${diaLegible(F.desde_siempre.ultimo_egreso)}.`
            : "Nunca se ha registrado uno."}
        </p>
      )}
    </Bloque>
  );
}

function BloqueMargen({ clases }: { clases: ClaseFinanzas[] }) {
  const conMargen = clases.map((c) => ({
    ...c,
    ...margenClase(
      c.atribucion.map((a) => ({
        montoCompraClp: a.monto_compra_clp,
        clasesCompra: a.clases_compra,
        recuperoCredito: a.recupero_credito,
        // La función solo devuelve clases que ya ocurrieron.
        claseYaOcurrio: true,
        n: a.n,
      })),
      {
        horas: horasDeClase(c.inicio, c.fin) ?? 0,
        costoHoraSalaClp: c.costo_hora_sala_clp,
        baseHoraProfesoraClp: c.base_hora_profesora_clp,
        variableCreditoClp: c.variable_credito_clp,
        creditosConsumidos: c.creditos_consumidos,
      },
    ),
  }));
  const r = resumenMargen(conMargen);

  // El variable se lee de las filas, no se escribe: si todas pagan lo mismo
  // se dice cuánto; si no, se omite en vez de inventar un número.
  const variables = new Set(
    conMargen.map((c) => c.variable_credito_clp).filter((v): v is number => v !== null),
  );
  const variable = variables.size === 1 ? [...variables][0] : null;

  return (
    <Bloque
      titulo="Margen por clase dictada"
      bajada={`Solo clases de la parrilla que ya ocurrieron. Las especiales quedan fuera porque se pagan con otra regla que todavía no está construida. El costo es lo que cuesta dictarla: la hora de sala más la base de la profesora${variable !== null ? ` más ${clp(variable)} por crédito consumido` : " más el variable por crédito consumido"}.`}
    >
      <Rejilla>
        <Indicador
          destacado
          rotulo="Margen del mes"
          valor={pesos(r.margenClp)}
          denominador={`${clp(r.ingresoClp)} de ingreso menos ${clp(r.costoClp)} de costo, en ${plural(r.clases, "clase de parrilla", "clases de parrilla")}`}
          sinDatoDesde={
            r.clases === 0 && r.sinCosto === 0
              ? "Todavía no se ha dictado ninguna clase de parrilla este mes."
              : undefined
          }
          nota={
            r.sinCosto > 0
              ? `${plural(r.sinCosto, "clase quedó fuera", "clases quedaron fuera")} por no tener costo cargado: falta el costo de sala o el de la profesora.`
              : undefined
          }
        />
        <Indicador
          rotulo="Costo de dictar"
          valor={clp(r.costoClp)}
          denominador="sala, base de la profesora y variable, sumados"
        />
        <Indicador
          rotulo="Ingreso atribuido"
          valor={clp(r.ingresoClp)}
          denominador="lo que valían las reservas que consumieron crédito"
        />
      </Rejilla>

      {conMargen.length > 0 ? (
        <Tabla columnas={["Clase", "Sede", "Créditos", "Ingreso", "Costo", "Margen"]}>
          {conMargen.map((c) => (
            <Fila key={c.clase_id}>
              <Celda principal>
                {c.curso} · {fechaCorta(c.inicio)} {hora24(c.inicio)}
                <span className="block text-xs text-xo-gris">{c.profesora}</span>
              </Celda>
              <Celda apagada>{c.sede}</Celda>
              <Celda apagada>{c.creditos_consumidos}</Celda>
              <Celda>{clp(c.ingresoClp)}</Celda>
              <Celda apagada>{c.costo ? clp(c.costo.totalClp) : "—"}</Celda>
              <Celda>
                {c.margenClp === null ? (
                  <span className="text-xo-gris">sin costo cargado</span>
                ) : (
                  pesos(c.margenClp)
                )}
              </Celda>
            </Fila>
          ))}
        </Tabla>
      ) : null}
    </Bloque>
  );
}
