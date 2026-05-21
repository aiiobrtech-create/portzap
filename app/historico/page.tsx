import { Bell, Clock3, Filter, XCircle } from "lucide-react";
import { DropdownSelect } from "@/app/dropdown-select";
import { resolveCondominiumContext } from "@/lib/condominiums";
import { deliveryStatuses, type DeliveryStatus } from "@/lib/deliveries";
import { listDeliveryHistoryEvents } from "@/lib/history";
import { listNotificationAttempts } from "@/lib/notifications";

type HistoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type HistoryStatusFilter = DeliveryStatus | "all";

const historyStatusFilters = [...deliveryStatuses, "all"] as const;

function isHistoryStatusFilter(value: string | undefined): value is HistoryStatusFilter {
  return !!value && historyStatusFilters.includes(value as HistoryStatusFilter);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const statusParam = getSingleParam(resolvedSearchParams.status);
  const { activeCondominium } = await resolveCondominiumContext();
  const activeStatus: HistoryStatusFilter = isHistoryStatusFilter(statusParam) ? statusParam : "all";
  const [records, notificationAttempts] = activeCondominium
    ? await Promise.all([
        listDeliveryHistoryEvents({
          condominiumId: activeCondominium.id,
          limit: 30,
          status: activeStatus,
        }),
        listNotificationAttempts({
          condominiumId: activeCondominium.id,
          limit: 20,
        }),
      ])
    : [[], []];

  function renderStatusLabel(status: DeliveryStatus | null) {
    if (status === "pending") return "Pendente";
    if (status === "notified") return "Avisado";
    if (status === "picked_up") return "Retirado";
    if (status === "cancelled") return "Cancelado";
    return "Sem status anterior";
  }

  return (
    <main className="pageShell">
      <header className="pageHeader">
        <h1>Histórico</h1>
        {activeCondominium ? <span className="pageContextTag">{activeCondominium.name}</span> : null}
      </header>

      {!activeCondominium ? (
        <section className="emptyState">
          <strong>Nenhum condomínio ativo</strong>
        </section>
      ) : (
        <section className="stackGrid">
          <form className="queueToolbar" action="/historico">
            <DropdownSelect
              name="status"
              defaultValue={activeStatus}
              icon={<Filter size={16} />}
              options={[
                { value: "all", label: "Todos os eventos" },
                { value: "pending", label: "Entradas pendentes" },
                { value: "notified", label: "Avisos enviados" },
                { value: "picked_up", label: "Retiradas concluídas" },
                { value: "cancelled", label: "Cancelamentos" },
              ]}
            />

            <button className="ghostButton toolbarButton" type="submit">
              Aplicar filtro
            </button>
          </form>

          <div className="panel">
            <div className="panelHeader">
              <div>
                <h2>Notificações</h2>
              </div>
            </div>

            {notificationAttempts.length === 0 ? (
              <div className="emptyState">
                <strong>Nenhuma tentativa registrada</strong>
              </div>
            ) : (
              <div className="historyCompactList notificationList">
                {notificationAttempts.map((attempt) => (
                  <details key={attempt.id} className="historyDisclosure notificationItem">
                    <summary className="historySummary">
                      <span className="historySummaryMain">
                        <span className={`statusBadge notificationStatus-${attempt.status}`}>
                          {attempt.status === "sent" && "Enviado"}
                          {attempt.status === "delivered" && "Entregue"}
                          {attempt.status === "read" && "Lido"}
                          {attempt.status === "failed" && "Falhou"}
                          {attempt.status === "pending" && "Pendente"}
                        </span>
                        <span className="historySummaryTitle">
                          {attempt.delivery?.resident_name ?? "Morador não identificado"}
                        </span>
                        <span className="historySummaryMeta">
                          Unidade {attempt.delivery?.apartment ?? "não informada"}
                          {attempt.delivery?.carrier ? ` • ${attempt.delivery.carrier}` : ""}
                        </span>
                      </span>
                      <span className="historyStamp">
                        {attempt.status === "failed" ? <XCircle size={16} /> : <Bell size={16} />}
                        <span>{formatDate(attempt.attempted_at)}</span>
                      </span>
                    </summary>

                    <div className="historyDetailInline">
                      <span>
                        <strong>Data</strong>
                        {formatDate(attempt.attempted_at)}
                      </span>
                      {attempt.status === "failed" ? (
                        <span className="historyDetailExtra">
                          <strong>Erro</strong>
                          {attempt.error_message ?? "Falha ao enviar notificação"}
                        </span>
                      ) : null}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>

          {records.length === 0 ? (
            <div className="emptyState">
              <strong>Nenhuma movimentacao encontrada</strong>
            </div>
          ) : (
            <div className="historyCompactList">
              {records.map((record) => {
                return (
                  <details key={record.id} className="historyDisclosure historyCard">
                    <summary className="historySummary">
                      <span className="historySummaryMain">
                    <span className={`statusBadge status-${record.to_status}`}>
                      {renderStatusLabel(record.to_status)}
                    </span>
                        <span className="historySummaryTitle">
                          {record.delivery?.resident_name ?? "Encomenda sem vínculo"}
                        </span>
                        <span className="historySummaryMeta">
                      Unidade {record.delivery?.apartment ?? "não informada"}
                      {record.delivery?.carrier ? ` • ${record.delivery.carrier}` : ""}
                        </span>
                      </span>
                      <span className="historyStamp">
                    <Clock3 size={16} />
                    <span>{formatDate(record.created_at)}</span>
                      </span>
                    </summary>

                    <div className="historyDetailInline">
                      <span>
                        <strong>Data</strong>
                        {formatDate(record.created_at)}
                      </span>
                      <span>
                        <strong>Forma de retirada</strong>
                        {record.to_status === "picked_up"
                          ? "QR ou código"
                          : record.to_status === "cancelled"
                            ? "Cancelada"
                            : "Pendente"}
                      </span>
                      {record.actor_label ? (
                        <span>
                          <strong>Operador</strong>
                          {record.actor_label}
                        </span>
                      ) : null}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
