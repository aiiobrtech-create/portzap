"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Package, X } from "lucide-react";
import { markDeliveryCancelled, markDeliveryNotified } from "@/app/actions";

type RecentDeliveriesListProps = {
  deliveries: DeliveryRecord[];
  condominiumId: string;
};

type DeliveryRecord = {
  id: string;
  resident_name: string;
  resident_phone: string | null;
  apartment: string;
  carrier: string | null;
  description: string | null;
  package_photo_url?: string | null;
  internal_notes: string | null;
  status: "pending" | "notified" | "picked_up" | "cancelled";
  received_at: string;
  notified_at: string | null;
  picked_up_at: string | null;
  cancelled_at: string | null;
};

function getDeliveryPackagePhotoUrl(delivery: Pick<DeliveryRecord, "package_photo_url" | "internal_notes">) {
  if (delivery.package_photo_url) {
    return delivery.package_photo_url;
  }

  const match = delivery.internal_notes?.match(/(?:^|\n)\s*Foto:\s*(https?:\/\/\S+)/i);
  return match?.[1] ?? null;
}

function formatDeliveryNotes(notes: string | null, packagePhotoUrl: string | null) {
  if (!notes || !notes.trim()) {
    return "Não informado";
  }

  if (!packagePhotoUrl) {
    return notes;
  }

  const notesWithoutPhotoLink = notes
    .replace(/(?:^|\n)\s*Foto:\s*https?:\/\/\S+\s*/gi, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return notesWithoutPhotoLink || "Não informado";
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

function formatStatusLabel(status: DeliveryRecord["status"]) {
  if (status === "pending") return "Pendente";
  if (status === "notified") return "Avisado";
  if (status === "picked_up") return "Retirado";
  if (status === "cancelled") return "Cancelado";
  return status;
}

function formatValue(value: string | null | undefined) {
  return value && value.trim() ? value : "Não informado";
}

export function RecentDeliveriesList({ deliveries, condominiumId }: RecentDeliveriesListProps) {
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryRecord | null>(null);
  const selectedDeliveryPackagePhotoUrl = selectedDelivery
    ? getDeliveryPackagePhotoUrl(selectedDelivery)
    : null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedDelivery(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <div className="deliveryList">
        {deliveries.map((delivery) => {
          const hasActions = delivery.status === "pending" || delivery.status === "notified";
          const packagePhotoUrl = getDeliveryPackagePhotoUrl(delivery);

          return (
            <article key={delivery.id} className="deliveryItem">
              <button
                type="button"
                className="deliveryPreviewButton"
                onClick={() => setSelectedDelivery(delivery)}
              >
                <div className="deliveryTopRow">
                  <span className={`statusBadge status-${delivery.status}`}>
                    {formatStatusLabel(delivery.status)}
                  </span>

                  <div className="deliveryMain">
                    <div className="deliveryPhoto">
                      {packagePhotoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={packagePhotoUrl}
                          alt={`Foto da encomenda de ${delivery.resident_name}`}
                          loading="lazy"
                        />
                      ) : (
                        <div className="deliveryPhotoEmpty" aria-hidden="true">
                          <Package size={18} />
                          <span>Sem foto</span>
                        </div>
                      )}
                    </div>

                    <div className="deliveryItemInfo">
                      <h3>{delivery.resident_name}</h3>
                      <p>
                        Unidade {delivery.apartment}
                        {delivery.carrier ? ` • ${delivery.carrier}` : ""}
                        {delivery.resident_phone ? ` • Contato ${delivery.resident_phone}` : ""}
                        {delivery.description ? ` • ${delivery.description}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="deliveryMeta">
                    <span>
                      Recebido em {formatDate(delivery.received_at)}
                      {delivery.status === "cancelled" && delivery.cancelled_at
                        ? ` • Cancelado em ${formatDate(delivery.cancelled_at)}`
                        : ""}
                    </span>
                  </div>
                </div>
              </button>

              {hasActions ? (
                <div className="deliveryActions">
                  {delivery.status === "pending" ? (
                    <form action={markDeliveryNotified}>
                      <input type="hidden" name="id" value={delivery.id} />
                      <input type="hidden" name="condominiumId" value={condominiumId} />
                      <button className="secondaryButton" type="submit">
                        Avisar no WhatsApp
                      </button>
                    </form>
                  ) : null}

                  {delivery.status === "pending" || delivery.status === "notified" ? (
                    <form action={markDeliveryCancelled}>
                      <input type="hidden" name="id" value={delivery.id} />
                      <input type="hidden" name="condominiumId" value={condominiumId} />
                      <button className="ghostButton dangerButton" type="submit">
                        Cancelar registro
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {selectedDelivery
        ? createPortal(
            <div
              className="deliveryModalOverlay"
              role="presentation"
              onClick={() => setSelectedDelivery(null)}
            >
              <div
                className="deliveryModal"
                role="dialog"
                aria-modal="true"
                aria-label={`Detalhes da encomenda de ${selectedDelivery.resident_name}`}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="deliveryModalClose"
                  aria-label="Fechar detalhes"
                  onClick={() => setSelectedDelivery(null)}
                >
                  <X size={18} />
                </button>

                <div className="deliveryModalBody deliveryModalBodySplit">
                  <div className="deliveryModalPhoto">
                    {selectedDeliveryPackagePhotoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={selectedDeliveryPackagePhotoUrl}
                        alt={`Foto da encomenda de ${selectedDelivery.resident_name}`}
                      />
                    ) : (
                      <div className="deliveryPhotoEmpty" aria-hidden="true">
                        <Package size={18} />
                        <span>Sem foto</span>
                      </div>
                    )}
                  </div>

                  <div className="deliveryModalContent">
                    <div className="deliveryModalHeader">
                      <span className={`statusBadge status-${selectedDelivery.status}`}>
                        {formatStatusLabel(selectedDelivery.status)}
                      </span>
                      <h3>{selectedDelivery.resident_name}</h3>
                      <p className="deliveryModalLead">
                        Unidade {selectedDelivery.apartment}
                        {selectedDelivery.carrier ? ` • ${selectedDelivery.carrier}` : ""}
                      </p>
                    </div>

                    <dl className="deliveryModalGrid">
                      <div>
                        <dt>Telefone</dt>
                        <dd>{formatValue(selectedDelivery.resident_phone)}</dd>
                      </div>
                      <div>
                        <dt>Descrição</dt>
                        <dd>{formatValue(selectedDelivery.description)}</dd>
                      </div>
                      <div>
                        <dt>Recebido em</dt>
                        <dd>{formatDate(selectedDelivery.received_at)}</dd>
                      </div>
                      <div>
                        <dt>Notificado em</dt>
                        <dd>{selectedDelivery.notified_at ? formatDate(selectedDelivery.notified_at) : "Não notificado"}</dd>
                      </div>
                      <div>
                        <dt>Retirado em</dt>
                        <dd>{selectedDelivery.picked_up_at ? formatDate(selectedDelivery.picked_up_at) : "Não retirado"}</dd>
                      </div>
                      <div>
                        <dt>Cancelado em</dt>
                        <dd>{selectedDelivery.cancelled_at ? formatDate(selectedDelivery.cancelled_at) : "Não cancelado"}</dd>
                      </div>
                      <div className="deliveryModalFull">
                        <dt>Observações</dt>
                        <dd>
                          {formatDeliveryNotes(selectedDelivery.internal_notes, selectedDeliveryPackagePhotoUrl)}
                        </dd>
                      </div>
                      <div className="deliveryModalFull">
                        <dt>Status atual</dt>
                        <dd>{formatStatusLabel(selectedDelivery.status)}</dd>
                      </div>
                    </dl>

                    <div className="deliveryModalActions">
                      <button type="button" className="ghostButton" onClick={() => setSelectedDelivery(null)}>
                        Fechar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
