import { completeFirstAccess } from "@/app/security-actions";
import { PhoneInput, SlugInput } from "@/app/form-fields";
import { requireAuthorizedCondominium } from "@/lib/operator-auth";

type FirstAccessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FirstAccessPage({ searchParams }: FirstAccessPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const feedbackMessage = getSingleParam(resolvedSearchParams.message)?.trim() ?? "";
  const feedbackTone = getSingleParam(resolvedSearchParams.tone);
  const { activeCondominium } = await requireAuthorizedCondominium();

  return (
    <main className="pageShell">
      <header className="pageHeader">
        <h1>Primeiro acesso</h1>
        <span className="pageContextTag">{activeCondominium.name}</span>
      </header>

      {feedbackMessage ? (
        <section
          className={`feedbackBanner${feedbackTone === "error" ? " feedbackBannerError" : " feedbackBannerSuccess"}`}
        >
          <strong>{feedbackTone === "error" ? "Falha operacional" : "Operação concluída"}</strong>
          <p>{feedbackMessage}</p>
        </section>
      ) : null}

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>Configurar dados do condomínio</h2>
          </div>
        </div>

        <form action={completeFirstAccess} className="deliveryForm">
          <input type="hidden" name="condominiumId" value={activeCondominium.id} />

          <label className="field">
            <span>Nome do condomínio</span>
            <input name="name" defaultValue={activeCondominium.name} maxLength={120} required />
          </label>

          <div className="fieldRow">
            <label className="field">
              <span>Slug operacional</span>
              <SlugInput name="slug" defaultValue={activeCondominium.slug ?? ""} required />
            </label>

            <label className="field">
              <span>Telefone de contato</span>
              <PhoneInput name="contactPhone" defaultValue={activeCondominium.contact_phone ?? ""} />
            </label>
          </div>

          <button className="primaryButton" type="submit">
            Concluir configuração inicial
          </button>
        </form>
      </section>
    </main>
  );
}
