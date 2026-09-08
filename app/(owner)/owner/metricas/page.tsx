import type { Metadata } from "next";
import { TituloPortal } from "@/components/Portal";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import {
  Bloque,
  Celda,
  Fila,
  FranjaConciliacion,
  Indicador,
  Rejilla,
  SinDato,
  Tabla,
  fechaCorta,
  hora24,
  pct,
  plural,
} from "@/components/Metricas";
import { requiereNivel } from "@/lib/sesion";
import { clp } from "@/lib/planes";
import { getDemanda, getResumen } from "@/lib/metricas-consultas";
import { mesAnterior, mesEnCurso, nombreDelMes } from "@/lib/dominio/periodo";
import {
  atribuir,
  brecha,
  comparar,
  conciliacion,
  ocupacionPromedio,
  planesMasVendidos,
  tasa,
  ticketPromedio,
} from "@/lib/dominio/metricas";

export const metadata: Metadata = {
  title: "Métricas — XO Dance Studio",
  robots: { index: false, follow: false },
};

const DIAS = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/**
 * El tablero del owner. PRD-0010 parte 1.
 *
 * Lee con la sesión de quien mira: las funciones de la base verifican
 * `tiene_nivel('owner')` adentro, así que un admin que llegue por URL directa
 * —o que llame la función a mano— recibe 42501 igual. El layout es la primera
 * barrera, no la única.
 *
 * Ningún cálculo vive acá. Los agregados vienen de dos funciones SQL y las
 * tasas salen de `lib/dominio/metricas.ts`, que tiene tests. Esta página solo
 * decide qué se muestra y cómo se rotula.
 */
export default async function Metricas() {
  await requiereNivel("owner", "owner");

  const periodo = mesEnCurso();
  const anterior = mesAnterior(periodo);

  const [resumen, demanda] = await Promise.all([
    getResumen(periodo, anterior),
    getDemanda(periodo),
  ]);

  const R = resumen.datos;
  const D = demanda.datos;

  const leidoA = R ? hora24(R.meta.generado_at) : "";

  return (
    <>
      <TituloPortal
        eyebrow="Portal del owner"
        titulo="Métricas"
        bajada={`${capitalizar(nombreDelMes(periodo))}, comparado con ${nombreDelMes(anterior)}. Lo primero es la brecha entre lo vendido y lo entregado: en un modelo de paquetes, la caja puede verse bien mientras el negocio se vacía.`}
      />

      <ErrorDeLectura
        que="las métricas del negocio"
        error={resumen.error}
        denegado="Las métricas del negocio son solo del owner. Un admin ve toda la operación, pero no los montos."
      />

      {/* El estado vacío solo si NO hubo error: es la distinción que faltaba. */}
      {R ? (
        <>
          <FranjaConciliacion
            {...conciliacion(R.conciliacion.libro, R.conciliacion.lotes)}
            leidoA={leidoA}
          />

          <BloqueCreditos R={R} />
          <BloqueVenta R={R} />
          {D ? <BloqueDemanda D={D} /> : null}
          <ErrorDeLectura que="la ocupación y el ranking de profesoras" error={demanda.error} />
          <BloqueAlumnas R={R} />
          <BloqueOperacion R={R} />
          <BloqueRecortes />
        </>
      ) : null}
    </>
  );
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "0 este mes · la última fue el 3 de agosto", o que nunca hubo ninguna. */
function desdeCuando(valor: number, ultima: string | null, que: string): string | undefined {
  if (valor !== 0) return undefined;
  const cuando = fechaCorta(ultima);
  return cuando
    ? `Cero este mes. ${capitalizar(que)} más reciente: ${cuando}.`
    : `Cero este mes, y nunca ha habido ${que} en el sistema.`;
}

type Datos = NonNullable<Awaited<ReturnType<typeof getResumen>>["datos"]>;
type DatosDemanda = NonNullable<Awaited<ReturnType<typeof getDemanda>>["datos"]>;

function BloqueCreditos({ R }: { R: Datos }) {
  const b = brecha({
    otorgadas: R.creditos.otorgadas_historico,
    consumidas: R.creditos.consumidas_historico,
    disponibles: R.creditos.disponibles,
    vencidas: R.creditos.vencidas_sin_usar,
  });

  return (
    <Bloque
      titulo="Créditos"
      bajada="La diferencia entre lo vendido y lo consumido es plata cobrada por un servicio que todavía se debe. Es pasivo, no utilidad, y es el indicador propio de este modelo."
    >
      <Rejilla>
        <Indicador
          destacado
          rotulo="Brecha — pasivo vigente"
          valor={String(b.pasivoVigente)}
          denominador={`clases pagadas y no tomadas, sobre ${b.otorgadas} otorgadas desde siempre`}
          nota="Vencen si no se usan. No es utilidad hasta que la clase se dicta o el crédito expira."
        />
        <Indicador
          rotulo="Vendidas este mes"
          valor={String(R.creditos.vendidas)}
          denominador={
            R.creditos.regaladas > 0
              ? `más ${R.creditos.regaladas} regaladas, que no son venta`
              : "clases compradas"
          }
          comparacion={comparar(R.creditos.vendidas, R.creditos_anterior.vendidas)}
          sinDatoDesde={desdeCuando(
            R.creditos.vendidas,
            R.desde_siempre.ultimo_movimiento_at,
            "movimiento de créditos",
          )}
        />
        <Indicador
          rotulo="Consumidas este mes"
          valor={String(R.creditos.consumidas)}
          denominador="neto: las reservas restan, las devoluciones suman"
          comparacion={comparar(R.creditos.consumidas, R.creditos_anterior.consumidas)}
          sinDatoDesde={desdeCuando(
            R.creditos.consumidas,
            R.desde_siempre.ultima_reserva_at,
            "reserva",
          )}
        />
        <Indicador
          rotulo="Tasa de utilización"
          valor={pct(b.utilizacion)}
          denominador={`${b.consumidas} de ${b.otorgadas} créditos otorgados, acumulado`}
          nota="Si baja, la gente compra y no viene. Anticipa el abandono meses antes de que se note en la caja."
        />
        <Indicador
          rotulo="Vencidas sin usar"
          valor={String(R.creditos.vencidas_sin_usar)}
          denominador="clases pagadas que ya nadie va a tomar"
          nota="Dejaron de ser deuda: eso ya es margen."
        />
        <Indicador
          rotulo="Por vencer en 30 días"
          valor={String(R.creditos.por_vencer_30d)}
          denominador={`de las ${b.pasivoVigente} vigentes`}
          nota="Cada una es alguien que pagó y todavía no vino."
        />
      </Rejilla>
    </Bloque>
  );
}

function BloqueVenta({ R }: { R: Datos }) {
  const top = planesMasVendidos(R.venta.por_plan);
  const ticket = ticketPromedio(R.venta.ingresos_clp, R.venta.compras);

  return (
    <Bloque
      titulo="Venta"
      bajada="Ingresos brutos: lo que entró por packs pagados. La caja neta necesita los egresos, que son la parte 2 de este PRD."
    >
      <Rejilla>
        <Indicador
          rotulo="Ingresos del mes"
          valor={clp(R.venta.ingresos_clp)}
          denominador={plural(R.venta.compras, "compra pagada", "compras pagadas")}
          comparacion={comparar(R.venta.ingresos_clp, R.venta_anterior.ingresos_clp)}
          comparacionEnPesos
          sinDatoDesde={desdeCuando(
            R.venta.ingresos_clp,
            R.desde_siempre.ultima_compra_at,
            "compra pagada",
          )}
        />
        <Indicador
          rotulo="Ticket promedio"
          valor={ticket === null ? "—" : clp(ticket)}
          denominador={
            ticket === null ? "sin compras este mes" : `${clp(R.venta.ingresos_clp)} entre ${R.venta.compras}`
          }
        />
        <Indicador
          rotulo="Plan más vendido"
          valor={top.length === 0 ? "—" : top.map((p) => p.nombre).join(" y ")}
          denominador={
            top.length === 0
              ? "sin compras este mes"
              : `${top[0].compras} de ${R.venta.compras} ${top.length > 1 ? "· empatados" : ""}`
          }
        />
      </Rejilla>

      {R.venta.pendientes.compras > 0 ? (
        <p className="mt-4 text-sm text-xo-gris">
          Además hay{" "}
          <strong className="font-medium text-xo-negro">
            {clp(R.venta.pendientes.monto_clp)}
          </strong>{" "}
          declarados en{" "}
          {plural(R.venta.pendientes.compras, "transferencia", "transferencias")} sin aprobar. No
          cuentan como ingreso hasta que se confirme el pago.
        </p>
      ) : null}
    </Bloque>
  );
}

function BloqueDemanda({ D }: { D: DatosDemanda }) {
  const dictadas = D.por_clase.filter((c) => c.dictada);
  const ocup = ocupacionPromedio(dictadas.map((c) => ({ reservas: c.reservas, cupo: c.cupo })));
  const canceladas = D.por_clase.filter((c) => c.estado === "cancelada").length;

  const ranking = D.por_profesora
    .map((p) => ({
      ...p,
      ...atribuir(
        p.atribucion.map((a) => ({
          montoCompraClp: a.monto_compra_clp,
          clasesCompra: a.clases_compra,
          recuperoCredito: a.recupero_credito,
          claseYaOcurrio: a.clase_ya_ocurrio,
          n: a.n,
        })),
      ),
    }))
    .sort((a, b) => b.dictado - a.dictado || b.reservas - a.reservas);

  const horarios = [...D.por_horario].sort(
    (a, b) => (tasa(b.reservas, b.cupos) ?? -1) - (tasa(a.reservas, a.cupos) ?? -1),
  );

  return (
    <Bloque
      titulo="Demanda"
      bajada="Ocupación sobre el cupo real de cada clase. Las canceladas quedan fuera del promedio: una clase que no ocurrió no es un horario muerto."
    >
      <Rejilla>
        <Indicador
          rotulo="Ocupación promedio"
          valor={pct(ocup.tasa)}
          denominador={`${plural(ocup.reservas, "reserva", "reservas")} sobre ${ocup.cupos} cupos, en ${plural(ocup.clases, "clase dictada", "clases dictadas")}`}
          sinDatoDesde={
            ocup.clases === 0 ? "Todavía no se ha dictado ninguna clase este mes." : undefined
          }
        />
        <Indicador
          rotulo="Clases dictadas"
          valor={String(dictadas.length)}
          denominador={`de ${D.por_clase.length} programadas este mes`}
          nota={canceladas > 0 ? `${canceladas} canceladas por XO` : undefined}
        />
        <Indicador
          rotulo="Horarios en la parrilla"
          valor={String(D.por_horario.length)}
          denominador="con al menos una clase este mes"
        />
      </Rejilla>

      {horarios.length > 0 ? (
        <>
          <h3 className="xo-eyebrow mt-8 mb-3 text-xo-gris">
            Horarios, del más lleno al más vacío
          </h3>
          <Tabla columnas={["Horario", "Sede", "Dictadas", "Reservas", "Ocupación"]}>
            {horarios.map((h) => (
              <Fila key={h.horario_id}>
                <Celda principal>
                  {DIAS[h.dia_semana]} {h.hora?.slice(0, 5)} · {h.curso}
                  <span className="block text-xs text-xo-gris">{h.profesora}</span>
                </Celda>
                <Celda apagada>{h.sede}</Celda>
                <Celda apagada>{h.clases_dictadas}</Celda>
                <Celda>{h.reservas}</Celda>
                <Celda>
                  {pct(tasa(h.reservas, h.cupos))}
                  <span className="block text-xs text-xo-gris">
                    {h.reservas} de {h.cupos}
                  </span>
                </Celda>
              </Fila>
            ))}
          </Tabla>
        </>
      ) : null}

      {ranking.length > 0 ? (
        <>
          <h3 className="xo-eyebrow mt-8 mb-3 text-xo-gris">Profesoras</h3>
          <p className="mb-3 max-w-prose text-sm leading-relaxed text-xo-gris">
            El ingreso se atribuye al reservar, porque la compra no elige profesora. Va partido en
            dos: lo <strong className="font-medium text-xo-negro">dictado</strong> ya ocurrió; lo{" "}
            <strong className="font-medium text-xo-negro">comprometido</strong> son reservas de
            clases que todavía no pasan y que aún pueden cancelarse.
          </p>
          <Tabla columnas={["Profesora", "Reservas", "Dictado", "Comprometido"]}>
            {ranking.map((p) => (
              <Fila key={p.profesora_id}>
                <Celda principal>{p.nombre}</Celda>
                <Celda apagada>{p.reservas}</Celda>
                <Celda>{clp(p.dictado)}</Celda>
                <Celda apagada>{clp(p.comprometido)}</Celda>
              </Fila>
            ))}
          </Tabla>
        </>
      ) : null}
    </Bloque>
  );
}

function BloqueAlumnas({ R }: { R: Datos }) {
  const recompra = tasa(R.alumnas.con_recompra, R.alumnas.con_compra);
  const embudo = [
    ["Cuentas creadas", R.alumnas.cuentas],
    ["Primera compra", R.alumnas.con_compra],
    ["Primera reserva", R.alumnas.con_reserva],
    ["Segunda compra", R.alumnas.con_recompra],
  ] as const;

  return (
    <Bloque
      titulo="Alumnas"
      bajada="La retención en este modelo es recompra, no permanencia. Los porcentajes van con su absoluto porque con estos volúmenes un punto puede ser una persona."
    >
      <Rejilla>
        <Indicador
          rotulo="Activas"
          valor={String(R.alumnas.activas)}
          denominador={`de ${R.alumnas.cuentas} cuentas · con crédito vigente o reserva en 30 días`}
        />
        <Indicador
          rotulo="Tasa de recompra"
          valor={pct(recompra)}
          denominador={`${R.alumnas.con_recompra} de ${R.alumnas.con_compra} que compraron alguna vez`}
        />
        <Indicador
          rotulo="En riesgo"
          valor={String(R.alumnas.en_riesgo)}
          denominador="con crédito vigente y sin reservar hace más de 30 días"
          nota="Pagaron y no están viniendo. Es a quien conviene escribirle."
        />
      </Rejilla>

      <h3 className="xo-eyebrow mt-8 mb-3 text-xo-gris">Embudo</h3>
      <Tabla columnas={["Etapa", "Personas", "Del paso anterior"]}>
        {embudo.map(([etapa, n], i) => (
          <Fila key={etapa}>
            <Celda principal>{etapa}</Celda>
            <Celda>{n}</Celda>
            <Celda apagada>
              {i === 0 ? "—" : pct(tasa(n, embudo[i - 1][1]))}
            </Celda>
          </Fila>
        ))}
      </Tabla>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-xo-gris">
        El embudo empieza en la cuenta creada, no en la visita: las visitas no se miden y{" "}
        <code className="text-xs">leads</code> todavía no se puede unir con la cuenta que esa
        persona creó después.
      </p>
    </Bloque>
  );
}

function BloqueOperacion({ R }: { R: Datos }) {
  return (
    <Bloque titulo="Operación">
      <Rejilla>
        <Indicador
          rotulo="Cancelaciones del mes"
          valor={String(R.operacion.cancelaciones)}
          denominador={`${R.operacion.con_devolucion} devolvieron el crédito · ${R.operacion.sin_devolucion} no`}
          nota={
            R.operacion.por_clase_cancelada > 0
              ? R.operacion.por_clase_cancelada === 1
                ? "Una es de una clase que canceló XO, donde el crédito vuelve siempre."
                : `${R.operacion.por_clase_cancelada} son de clases que canceló XO, donde el crédito vuelve siempre.`
              : undefined
          }
          sinDatoDesde={desdeCuando(
            R.operacion.cancelaciones,
            R.desde_siempre.ultima_reserva_at,
            "reserva",
          )}
        />
        <SinDato
          rotulo="No-shows"
          porque="Nadie registra asistencia todavía, así que un cero acá no significaría que vinieron todas. Necesita su propio PRD: que la profesora marque quién llegó."
        />
      </Rejilla>
    </Bloque>
  );
}

function BloqueRecortes() {
  return (
    <Bloque
      titulo="Lo que este tablero todavía no muestra"
      bajada="Está acá y no omitido en silencio, porque un indicador que falta se nota y uno en cero no."
    >
      <Rejilla>
        <SinDato
          rotulo="Caja neta"
          porque="Necesita los egresos, que son la parte 2 de este PRD. Arriba hay ingresos brutos, rotulados como tales: un número que dijera «neto» sin restar nada sería peor que no tenerlo."
        />
        <SinDato
          rotulo="Margen por clase dictada"
          porque="Necesita el costo de sala y el pago a la profesora en la base. Van con la parte 2."
        />
        <SinDato
          rotulo="Ingresos de Teens"
          porque="Teens se vende como suscripción mensual y todavía no está construido (PRD-0011). Todo lo de arriba es solo packs."
        />
      </Rejilla>
    </Bloque>
  );
}
