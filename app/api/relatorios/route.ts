import { NextRequest } from "next/server";
import { buildCsv, buildExcelXml, csvResponse, excelResponse } from "@/lib/reporting";
import { resolveCondominiumContext } from "@/lib/condominiums";
import { listRecentDeliveries } from "@/lib/deliveries";

export const dynamic = "force-dynamic";

function formatDate(value: string | null | undefined) {
  return value ?? "";
}

function formatStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "pending":
      return "Pendente";
    case "notified":
      return "Avisado";
    case "picked_up":
      return "Retirado";
    case "cancelled":
      return "Cancelado";
    case "sent":
      return "Enviado";
    case "failed":
      return "Falhou";
    case "used":
      return "Usado";
    case "active":
      return "Ativo";
    case "expired":
      return "Expirado";
    default:
      return status ?? "";
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const kind = searchParams.get("kind");
  const { activeCondominium } = await resolveCondominiumContext();

  if (!activeCondominium) {
    return new Response("Nenhum condomínio ativo.", { status: 400 });
  }

  if (!kind) {
    return new Response("Informe o tipo de relatório.", { status: 400 });
  }

  if (kind === "summary") {
    const rows = await listRecentDeliveries(1000, { condominiumId: activeCondominium.id });
    const totals = {
      total: rows.length,
      pending: rows.filter((row) => row.status === "pending").length,
      notified: rows.filter((row) => row.status === "notified").length,
      picked_up: rows.filter((row) => row.status === "picked_up").length,
      cancelled: rows.filter((row) => row.status === "cancelled").length,
    };

    return csvResponse(
      `resumo-encomendas-${activeCondominium.slug ?? activeCondominium.id}.csv`,
      buildCsv(
        [
          {
            gerado_em: new Date().toISOString(),
            condomínio: activeCondominium.name,
            total_encomendas: totals.total,
            pendentes: totals.pending,
            avisadas: totals.notified,
            retiradas: totals.picked_up,
            canceladas: totals.cancelled,
            ultima_encomenda_em: rows[0] ? formatDate(rows[0].received_at) : "",
            ultima_encomenda_status: rows[0] ? formatStatusLabel(rows[0].status) : "",
          },
        ],
      ),
    );
  }

  if (kind === "deliveries-csv" || kind === "deliveries-excel") {
    const rows = await listRecentDeliveries(1000, { condominiumId: activeCondominium.id });
    const reportRows = rows.map((row) => ({
      id: row.id,
      condominio: activeCondominium.name,
      morador: row.resident_name,
      telefone: row.resident_phone ?? "",
      unidade: row.apartment,
      transportadora: row.carrier ?? "",
      descricao: row.description ?? "",
      status: formatStatusLabel(row.status),
      recebido_em: formatDate(row.received_at),
      avisado_em: formatDate(row.notified_at),
      retirado_em: formatDate(row.picked_up_at),
      cancelado_em: formatDate(row.cancelled_at),
    }));

    if (kind === "deliveries-excel") {
      return excelResponse(
        `encomendas-${activeCondominium.slug ?? activeCondominium.id}.xls`,
        buildExcelXml(reportRows),
      );
    }

    return csvResponse(
      `encomendas-${activeCondominium.slug ?? activeCondominium.id}.csv`,
      buildCsv(reportRows),
    );
  }

  return new Response("Tipo de relatório inválido.", { status: 400 });
}
