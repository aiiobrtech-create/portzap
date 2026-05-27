import Link from "next/link";
import { FeedbackQueryCleanup } from "@/app/feedback-query-cleanup";
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
  const pickupUnits = Array.from(deliveriesByApartment.entries()).filter(([, apartmentDeliveries]) =>
    apartmentDeliveries.some((delivery) => pickupTokens.has(delivery.id)),
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
      <FeedbackQueryCleanup />

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

            <div id="validador">
              <ScanPanel initialToken={initialToken} />
            </div>
          </div>

          <div className="panel">
            <div className="panelHeader">
              <div>
                <h2>Entregas prontas para validação</h2>
              </div>
            </div>

            {pickupTokens.size === 0 ? (
              <div className="emptyState">
                <strong>Nenhum QR ativo</strong>
              </div>
            ) : (
              <div className="stackGrid batchPickupList">
                {pickupUnits.map(([apartment, apartmentDeliveries]) => {
                  const firstPickup = apartmentDeliveries
                    .map((delivery) => pickupTokens.get(delivery.id))
                    .find((pickup): pickup is NonNullable<typeof pickup> => Boolean(pickup));

                  const residentNames = apartmentDeliveries
                    .slice(0, 2)
                    .map((delivery) => delivery.resident_name)
                    .join(" • ");
                  const extraCount = apartmentDeliveries.length - 2;

                    return (
                      <article key={apartment} className="batchPickupCard pickupUnitCard">
                        <div className="pickupUnitMain">
                          <span className="pickupUnitKicker">Unidade</span>
                          <strong>{apartment}</strong>
                        </div>

                        <div className="pickupUnitMain pickupUnitWide">
                          <span className="pickupUnitKicker">Moradores / itens</span>
                          <strong>
                            {residentNames}
                            {extraCount > 0 ? ` +${extraCount}` : ""}
                          </strong>
                          <p>
                            {apartmentDeliveries.length} encomenda
                            {apartmentDeliveries.length > 1 ? "s" : ""} pendente
                            {apartmentDeliveries.length > 1 ? "s" : ""}.
                          </p>
                        </div>

                        <div className="pickupUnitMain pickupUnitMetaBlock">
                          <span className="pickupUnitKicker">Expiração</span>
                          {firstPickup ? (
                            <strong className="pickupUnitMeta">
                              {new Intl.DateTimeFormat("pt-BR", {
                                dateStyle: "short",
                                timeStyle: "short",
                              }).format(new Date(firstPickup.expires_at))}
                            </strong>
                          ) : (
                            <strong className="pickupUnitMeta">Sem QR ativo</strong>
                          )}
                        </div>

                        <Link href="#validador" className="secondaryLinkButton pickupUnitAction">
                          Validar
                        </Link>
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
