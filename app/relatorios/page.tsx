import { FileDown, Package } from "lucide-react";
import { resolveCondominiumContext } from "@/lib/condominiums";
import { getDeliveryMetrics, listRecentDeliveries } from "@/lib/deliveries";

export const dynamic = "force-dynamic";

const exportItems = [
  {
    title: "Resumo geral",
    description: "Uma linha com o panorama consolidado das encomendas.",
    href: "/api/relatorios?kind=summary",
    icon: Package,
  },
  {
    title: "Encomendas detalhadas CSV",
    description: "Todas as encomendas recentes com datas, status, morador e unidade.",
    href: "/api/relatorios?kind=deliveries-csv",
    icon: FileDown,
  },
  {
    title: "Encomendas em Excel",
    description: "Planilha .xls compatível com Excel, LibreOffice e Google Sheets.",
    href: "/api/relatorios?kind=deliveries-excel",
    icon: FileDown,
  },
] as const;

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

export default async function ReportsPage() {
  const { activeCondominium } = await resolveCondominiumContext();

  if (!activeCondominium) {
    return (
      <main className="pageShell">
        <section className="emptyState">
          <strong>Nenhum condomínio ativo</strong>
        </section>
      </main>
    );
  }

  const [metrics, deliveries] = await Promise.all([
    getDeliveryMetrics(activeCondominium.id),
    listRecentDeliveries(12, { condominiumId: activeCondominium.id }),
  ]);

  return (
    <main className="pageShell">
      <header className="pageHeader">
        <h1>Relatórios</h1>
        <span className="pageContextTag">{activeCondominium.name}</span>
      </header>

      <section className="metricsGrid">
        <article className="metricCard">
          <div className="metricIcon metricAccentBlue">
            <Package size={18} />
          </div>
          <span className="metricValue">{metrics.total}</span>
          <span className="metricLabel">Encomendas</span>
        </article>

        <article className="metricCard">
          <div className="metricIcon metricAccentGreen">
            <Package size={18} />
          </div>
          <span className="metricValue">{metrics.pending}</span>
          <span className="metricLabel">Pendentes</span>
        </article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>Exportar relatórios</h2>
          </div>
        </div>

        <div className="stackGrid reportsExportGrid">
          {exportItems.map(({ title, description, href, icon: Icon }) => (
            <article key={title} className="reportExportCard">
              <span className="metricIcon metricAccentBlue">
                <Icon size={16} />
              </span>
              <div>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
              <a href={href} className="secondaryLinkButton">
                Baixar resumo
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>Últimas encomendas</h2>
          </div>
        </div>

        <div className="stackGrid notificationList">
          {deliveries.map((delivery) => (
            <article key={delivery.id} className="notificationItem">
              <div className="notificationTop">
                <div>
                  <span className={`statusBadge status-${delivery.status}`}>
                    {delivery.status === "pending" && "Pendente"}
                    {delivery.status === "notified" && "Avisado"}
                    {delivery.status === "picked_up" && "Retirado"}
                    {delivery.status === "cancelled" && "Cancelado"}
                  </span>
                  <h3>{delivery.resident_name}</h3>
                  <p>
                    Unidade {delivery.apartment}
                    {delivery.carrier ? ` • ${delivery.carrier}` : ""}
                  </p>
                </div>
                <div className="historyStamp">
                  <FileDown size={16} />
                  <span>{formatDate(delivery.received_at)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
