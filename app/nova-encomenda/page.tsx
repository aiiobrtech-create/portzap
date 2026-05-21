import { NewDeliveryForm } from "@/app/nova-encomenda/new-delivery-form";
import { resolveCondominiumContext } from "@/lib/condominiums";
import { listResidents, listUnits } from "@/lib/residents";

export const dynamic = "force-dynamic";

type NewDeliveryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewDeliveryPage({ searchParams }: NewDeliveryPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const feedbackMessage = getSingleParam(resolvedSearchParams.message)?.trim() ?? "";
  const feedbackTone = getSingleParam(resolvedSearchParams.tone);
  const { activeCondominium } = await resolveCondominiumContext();
  const [residents, units] = activeCondominium
    ? await Promise.all([
        listResidents(100, activeCondominium.id),
        listUnits(100, activeCondominium.id),
      ])
    : [[], []];

  return (
    <main className="pageShell">
      <header className="pageHeader">
        <h1>Nova encomenda</h1>
        {activeCondominium ? <span className="pageContextTag">{activeCondominium.name}</span> : null}
      </header>

      {!activeCondominium ? (
        <section className="emptyState">
          <strong>Nenhum condomínio ativo</strong>
        </section>
      ) : (
        <>
          {feedbackMessage ? (
            <section
              className={`feedbackBanner${feedbackTone === "error" ? " feedbackBannerError" : " feedbackBannerSuccess"}`}
            >
              <strong>{feedbackTone === "error" ? "Erro operacional" : "Operacao concluida"}</strong>
              <p>{feedbackMessage}</p>
            </section>
          ) : null}
          <section className="panel formPanel">
            <NewDeliveryForm condominiumId={activeCondominium.id} residents={residents} units={units} />
          </section>
        </>
      )}
    </main>
  );
}
