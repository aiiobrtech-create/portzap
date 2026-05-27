import { Bell, Clock3, Filter, XCircle } from "lucide-react";
import { DropdownSelect } from "@/app/dropdown-select";
import { resolveCondominiumContext } from "@/lib/condominiums";
import { deliveryStatuses, getDeliveryPackagePhotoUrl, type DeliveryStatus } from "@/lib/deliveries";
import { listDeliveryHistoryEvents } from "@/lib/history";
import { listNotificationAttempts } from "@/lib/notifications";

type HistoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type HistoryStatusFilter = DeliveryStatus | "all";
type HistoryTrailItem =
  | {
      id: string;
      kind: "status";
      timestamp: string;
      status: DeliveryStatus;
      actorLabel: string | null;
    }
  | {
      id: string;
      kind: "notification";
      timestamp: string;
      status: string;
      errorMessage: string | null;
    };

type HistoryDeliveryGroup = {
  deliveryId: string;
  delivery: {
    resident_name: string;
    apartment: string;
    carrier: string | null;
    package_photo_url?: string | null;
    internal_notes: string | null;
  } | null;
  latestAt: string;
  latestStatus: DeliveryStatus | null;
  items: HistoryTrailItem[];
};

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

function renderStatusLabel(status: DeliveryStatus | null) {
  if (status === "pending") return "Pendente";
  if (status === "notified") return "Avisado";
  if (status === "picked_up") return "Retirado";
  if (status === "cancelled") return "Cancelado";
  return "Sem status anterior";
}

function renderNotificationStatus(status: string) {
  if (status === "sent") return "Enviado";
  if (status === "delivered") return "Entregue";
  if (status === "read") return "Lido";
  if (status === "failed") return "Falhou";
  if (status === "pending") return "Pendente";
  return status;
}

function renderOperatorName(actorLabel: string) {
  const trimmedLabel = actorLabel.trim();
  const emailSuffixStart = trimmedLabel.lastIndexOf(" (");

  if (emailSuffixStart > 0 && trimmedLabel.endsWith(")")) {
    return trimmedLabel.slice(0, emailSuffixStart);
  }

  return trimmedLabel;
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

  const groupedDeliveries = new Map<string, HistoryDeliveryGroup>();

  const ensureGroup = (
    deliveryId: string,
    delivery: HistoryDeliveryGroup["delivery"],
    timestamp: string,
  ) => {
    const existing = groupedDeliveries.get(deliveryId);

    if (existing) {
      if (!existing.delivery && delivery) {
        existing.delivery = delivery;
      }

      if (Date.parse(timestamp) > Date.parse(existing.latestAt)) {
        existing.latestAt = timestamp;
      }

      return existing;
    }

    const created = {
      deliveryId,
      delivery,
      latestAt: timestamp,
      latestStatus: null as DeliveryStatus | null,
      items: [] as HistoryTrailItem[],
    };

    groupedDeliveries.set(deliveryId, created);
    return created;
  };

  records.forEach((record) => {
    const delivery = record.delivery
      ? {
          resident_name: record.delivery.resident_name,
          apartment: record.delivery.apartment,
          carrier: record.delivery.carrier,
          package_photo_url: record.delivery.package_photo_url,
          internal_notes: record.delivery.internal_notes,
        }
      : null;
    const group = ensureGroup(record.delivery_id, delivery, record.created_at);
    group.items.push({
      id: record.id,
      kind: "status",
      timestamp: record.created_at,
      status: record.to_status,
      actorLabel: record.actor_label,
    });
    if (!group.latestStatus || Date.parse(record.created_at) >= Date.parse(group.latestAt)) {
      group.latestStatus = record.to_status;
    }
  });

  notificationAttempts.forEach((attempt) => {
    const delivery = attempt.delivery
      ? {
          resident_name: attempt.delivery.resident_name,
          apartment: attempt.delivery.apartment,
          carrier: attempt.delivery.carrier,
          package_photo_url: null,
          internal_notes: null,
        }
      : null;
    const existing = groupedDeliveries.get(attempt.delivery_id);

    if (activeStatus !== "all" && !existing) {
      return;
    }

    const group = ensureGroup(attempt.delivery_id, delivery, attempt.attempted_at);
    group.items.push({
      id: attempt.id,
      kind: "notification",
      timestamp: attempt.attempted_at,
      status: attempt.status,
      errorMessage: attempt.error_message,
    });
  });

  const groupedList = Array.from(groupedDeliveries.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((first, second) => Date.parse(second.timestamp) - Date.parse(first.timestamp)),
      latestStatus:
        group.latestStatus ??
        group.items.find((item) => item.kind === "status")?.status ??
        null,
    }))
    .sort((first, second) => Date.parse(second.latestAt) - Date.parse(first.latestAt));

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

          {groupedList.length === 0 ? (
            <div className="emptyState">
              <strong>Nenhuma movimentacao encontrada</strong>
            </div>
          ) : (
            <div className="historyCompactList">
              {groupedList.map((group) => {
                const packagePhotoUrl = group.delivery
                  ? getDeliveryPackagePhotoUrl(group.delivery)
                  : null;
                const summaryStatus = group.latestStatus ?? "pending";

                return (
                  <details key={group.deliveryId} className="historyDisclosure historyCard">
                    <summary className="historySummary">
                      <span className="historySummaryMain">
                        <span className={`statusBadge status-${summaryStatus}`}>
                          {renderStatusLabel(group.latestStatus)}
                        </span>
                        <span className="historySummaryTitle">
                          {group.delivery?.resident_name ?? "Encomenda sem vínculo"}
                        </span>
                        <span className="historySummaryMeta">
                          Unidade {group.delivery?.apartment ?? "não informada"}
                          {group.delivery?.carrier ? ` • ${group.delivery.carrier}` : ""}
                        </span>
                      </span>
                      <span className="historyStamp">
                        <Clock3 size={16} />
                        <span>{formatDate(group.latestAt)}</span>
                      </span>
                    </summary>

                    <div className="historyDetailLayout">
                      {packagePhotoUrl ? (
                        <div className="historyPhotoPanel">
                          <strong>Foto da encomenda</strong>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={packagePhotoUrl}
                            alt={`Foto completa da encomenda de ${group.delivery?.resident_name ?? "registro"}`}
                          />
                        </div>
                      ) : null}

                      <div className="historyTimelineWrap">
                        {group.items.map((item) => (
                          <div key={item.id} className="historyTimelineItem">
                            <div className="historyTimelineMarker" aria-hidden="true">
                              {item.kind === "notification" ? (
                                item.status === "failed" ? (
                                  <XCircle size={12} />
                                ) : (
                                  <Bell size={12} />
                                )
                              ) : (
                                <Clock3 size={12} />
                              )}
                            </div>
                            <div className="historyTimelineContent">
                              <p className="historyDetailLine">
                                <span className="historyDetailDate">Data {formatDate(item.timestamp)}</span>
                                <span className="historyDetailEvent">
                                  {item.kind === "status"
                                    ? `Movimentação ${
                                        item.status === "picked_up"
                                          ? "QR ou código"
                                          : item.status === "cancelled"
                                            ? "Cancelada"
                                            : item.status === "notified"
                                              ? "Notificação enviada"
                                              : "Pendente"
                                      }`
                                    : `Notificação ${renderNotificationStatus(item.status)}`}
                                </span>
                                {item.kind === "status" && item.actorLabel ? (
                                  <span className="historyDetailOperator">
                                    Operador {renderOperatorName(item.actorLabel)}
                                  </span>
                                ) : null}
                              </p>
                              {item.kind === "notification" && item.errorMessage ? (
                                <p className="historyDetailLine historyDetailError">
                                  Erro {item.errorMessage}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
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
