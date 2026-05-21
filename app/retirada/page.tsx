import Link from "next/link";
import { QrCode } from "lucide-react";
import { ScanPanel } from "@/app/retirada/scan-panel";
import { resolveCondominiumContext } from "@/lib/condominiums";
import { listRecentDeliveries } from "@/lib/deliveries";
import { getActivePickupTokensForDeliveries } from "@/lib/pickup-tokens";

type PickupValidationPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PickupValidationPage({ searchParams }: PickupValidationPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const feedbackMessage = getSingleParam(resolvedSearchParams.message)?.trim() ?? "";
  const feedbackTone = getSingleParam(resolvedSearchParams.tone);
  const initialToken = getSingleParam(resolvedSearchParams.token)?.trim() ?? "";
  const { activeCondominium } = await resolveCondominiumContext();
  const deliveries = activeCondominium
    ? await listRecentDeliveries(20, {
        condominiumId: activeCondominium.id,
        status: "notified",
      })
    : [];
  const pickupTokens = await getActivePickupTokensForDeliveries(deliveries.map((delivery) => delivery.id));
  const deliveriesByApartment = deliveries.reduce(
    (groups, delivery) => {
      const current = groups.get(delivery.apartment) ?? [];
      current.push(delivery);
      groups.set(delivery.apartment, current);
      return groups;
    },
    new Map<string, typeof deliveries>(),
  );

  return (
    <main className="pageShell">
      <header className="pageHeader">
        <h1>Retirada por QR</h1>
        {activeCondominium ? <span className="pageContextTag">{activeCondominium.name}</span> : null}
      </header>

      {feedbackMessage ? (
        <section
          className={`feedbackBanner${feedbackTone === "error" ? " feedbackBannerError" : " feedbackBannerSuccess"}`}
        >
          <strong>{feedbackTone === "error" ? "Falha operacional" : "Operação concluída"}</strong>
          <p>{feedbackMessage}</p>
        </section>
      ) : null}

      {!activeCondominium ? (
        <section className="emptyState">
          <strong>Nenhum condomínio ativo</strong>
        </section>
      ) : (
        <section className="contentGrid residentsContentGrid">
          <div className="panel">
            <div className="panelHeader">
              <div>
                <h2>Validar retirada</h2>
              </div>
            </div>

            <ScanPanel initialToken={initialToken} />
          </div>

          <div className="panel">
            <div className="panelHeader">
              <div>
                <h2>QRs ativos na fila</h2>
              </div>
            </div>

            {deliveriesByApartment.size > 0 ? (
              <div className="stackGrid batchPickupList">
                {Array.from(deliveriesByApartment.entries()).map(([apartment, apartmentDeliveries]) => (
                  <article key={apartment} className="batchPickupCard">
                    <div>
                      <strong>Unidade {apartment}</strong>
                      <p>
                        {apartmentDeliveries.length} encomenda
                        {apartmentDeliveries.length > 1 ? "s" : ""} para retirar em conjunto.
                      </p>
                    </div>
                    <Link href="/retirada" className="secondaryLinkButton">
                      Validar por QR ou código
                    </Link>
                  </article>
                ))}
              </div>
            ) : null}

            {pickupTokens.size === 0 ? (
              <div className="emptyState">
                <strong>Nenhum QR ativo</strong>
              </div>
            ) : (
              <div className="stackGrid residentGrid">
                {deliveries
                  .filter((delivery) => pickupTokens.has(delivery.id))
                  .map((delivery) => {
                    const pickup = pickupTokens.get(delivery.id);

                    if (!pickup) {
                      return null;
                    }

                    return (
                      <article key={delivery.id} className="panel residentCard">
                        <div className="residentCardTop">
                          <span className="metricIcon metricAccentBlue">
                            <QrCode size={16} />
                          </span>
                          <span className="residentUnit">Unidade {delivery.apartment}</span>
                        </div>
                        <h2>{delivery.resident_name}</h2>
                        <div className="residentMeta">
                          <span>{delivery.description ?? "Encomenda sem descrição adicional"}</span>
                          <span>
                            Expira em{" "}
                            {new Intl.DateTimeFormat("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(pickup.expires_at))}
                          </span>
                        </div>
                        <div className="inlineFormActions">
                          <Link href={`/q/${pickup.token_value}`} className="secondaryLinkButton">
                            Abrir QR do morador
                          </Link>
                        </div>
                      </article>
                    );
                  })}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
