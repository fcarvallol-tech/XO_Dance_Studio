import type { Metadata } from "next";
import { TituloPortal } from "@/components/Portal";
import { requiereNivel } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { nombreDe } from "@/lib/catalogo";
import { getCatalogoCompleto } from "@/lib/catalogo-consultas";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";

export const metadata: Metadata = {
  title: "Leads — XO Dance Studio",
  robots: { index: false, follow: false },
};

type FilaLead = {
  id: string;
  created_at: string;
  nombre: string;
  whatsapp: string;
  para_quien: string;
  curso_id: string | null;
  profesora_id: string | null;
  origen: string | null;
};

const FECHA = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

/**
 * Hasta esta migración, la tabla `leads` no la podía leer nadie: RLS activo sin
 * políticas y grants revocados. Quedaba visible solo entrando a Supabase.
 *
 * Esta página es la prueba viva de que la política nueva funciona, y va con la
 * sesión de quien mira: una alumna que llegue acá por URL no ve nada, porque
 * `leads_admin_lee` no la deja, aunque el layout fallara.
 *
 * El catálogo se lee completo, inactivos incluidos: es justo lo que hace falta
 * para leer un lead histórico que apunta a XO Kids sin dejar un hueco.
 */
export default async function Leads() {
  await requiereNivel("admin", "admin");
  const supabase = await clienteServidor();
  const { cursos, profesoras, error: errorCatalogo } = await getCatalogoCompleto();

  const { data, error } = await supabase
    .from("leads")
    .select("id, created_at, nombre, whatsapp, para_quien, curso_id, profesora_id, origen")
    .order("created_at", { ascending: false })
    .limit(200);

  const leads = (data ?? []) as FilaLead[];

  return (
    <>
      <TituloPortal
        eyebrow="Administración"
        titulo="Leads"
        bajada="Quienes dejaron sus datos en la web. Ordenados por más reciente."
      />

      <ErrorDeLectura
        que="los leads"
        error={error ? `${error.message} (${error.code})` : null}
      />
      <ErrorDeLectura que="el catálogo" error={errorCatalogo} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-xo-negro/20">
              <Th>Cuándo</Th>
              <Th>Nombre</Th>
              <Th>WhatsApp</Th>
              <Th>Para</Th>
              <Th>Profesora</Th>
              <Th>Curso</Th>
              <Th>Origen</Th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-xo-negro/10">
                <Td>{FECHA.format(new Date(lead.created_at))}</Td>
                <Td>{lead.nombre}</Td>
                <Td>
                  <a
                    href={`https://wa.me/569${lead.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whitespace-nowrap underline underline-offset-4"
                  >
                    +56 9 {lead.whatsapp}
                  </a>
                </Td>
                <Td>{lead.para_quien === "hija" ? "Su hija" : "Ella"}</Td>
                <Td>{nombreDe(profesoras, lead.profesora_id) ?? "—"}</Td>
                <Td>{nombreDe(cursos, lead.curso_id) ?? "—"}</Td>
                <Td>{lead.origen ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {leads.length === 0 && !error ? (
        <p className="text-xo-gris">Todavía no hay leads.</p>
      ) : null}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="xo-eyebrow py-3 pr-4 text-xo-gris">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="py-3 pr-4 text-sm text-xo-negro">{children}</td>;
}
