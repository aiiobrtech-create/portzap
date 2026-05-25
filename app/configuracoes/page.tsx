import { Database, ShieldCheck } from "lucide-react";
import { DropdownSelect } from "@/app/dropdown-select";
import { createOperatorForCondominium } from "@/app/security-actions";
import { resolveCondominiumContext } from "@/lib/condominiums";
import { requireOperatorContext } from "@/lib/operator-auth";
import { listCondominiumOperators } from "@/lib/operators";

type SettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const feedbackMessage = getSingleParam(resolvedSearchParams.message)?.trim() ?? "";
  const feedbackTone = getSingleParam(resolvedSearchParams.tone);
  const setupLink = getSingleParam(resolvedSearchParams.setupLink)?.trim() ?? "";
  const [{ activeCondominium, condominiums }, operatorContext] = await Promise.all([
    resolveCondominiumContext(),
    requireOperatorContext(),
  ]);
  const activeCondominiumMembership = operatorContext.memberships.find(
    (membership) => membership.id === activeCondominium?.id,
  );
  const canManageOperators = activeCondominiumMembership?.role === "admin";
  const activeOperators = activeCondominium
    ? await listCondominiumOperators(activeCondominium.id)
    : [];

  return (
    <main className="pageShell">
      <header className="pageHeader">
        <h1>Configurações</h1>
        {activeCondominium ? <span className="pageContextTag">{activeCondominium.name}</span> : null}
      </header>

      {feedbackMessage ? (
        <section
          className={`feedbackBanner${feedbackTone === "error" ? " feedbackBannerError" : " feedbackBannerSuccess"}`}
        >
          <strong>{feedbackTone === "error" ? "Erro operacional" : "Operacao concluida"}</strong>
          <p>{feedbackMessage}</p>
        </section>
      ) : null}

      {setupLink ? (
        <section className="feedbackBanner feedbackBannerSuccess">
          <strong>Link de convite gerado</strong>
          <p>{setupLink}</p>
        </section>
      ) : null}

      <section className="contentGrid residentsContentGrid settingsSplitGrid">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <h2>Condomínio ativo</h2>
            </div>
          </div>

          {!activeCondominium ? (
            <div className="emptyState">
              <strong>Nenhum condomínio ativo</strong>
            </div>
          ) : (
            <div className="stackGrid settingsGrid">
              <article className="panel settingsCard">
                <span className="metricIcon metricAccentBlue">
                  <Database size={16} />
                </span>
                <h2>{activeCondominium.name}</h2>
                <p>{activeCondominium.slug ? `Slug: ${activeCondominium.slug}` : "Slug não definido"}</p>
                <p>
                  {activeCondominium.contact_phone
                    ? `Contato: ${activeCondominium.contact_phone}`
                    : "Contato do condomínio não informado"}
                </p>
              </article>
            </div>
          )}
        </div>
      </section>

      <section className="contentGrid residentsContentGrid settingsSplitGrid">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <h2>Operadores do condomínio ativo</h2>
            </div>
          </div>

          {!activeCondominium ? (
            <div className="emptyState">
              <strong>Nenhum condomínio ativo</strong>
            </div>
          ) : activeOperators.length === 0 ? (
            <div className="emptyState">
              <strong>Nenhum operador vinculado</strong>
            </div>
          ) : (
            <div className="stackGrid settingsGrid">
              {activeOperators.map((operator) => (
                <article key={operator.membership_id} className="panel settingsCard">
                  <span className="metricIcon metricAccentBlue">
                    <ShieldCheck size={16} />
                  </span>
                  <h2>{operator.user.full_name}</h2>
                  <p>{operator.user.email}</p>
                  <p>Papel: {operator.role === "admin" ? "Administrador" : "Operador"}</p>
                  {operator.is_default ? <span className="inlineMutedPill">Padrão</span> : null}
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div>
              <h2>Novo operador</h2>
            </div>
          </div>

          {!activeCondominium ? (
            <div className="emptyState">
              <strong>Nenhum condomínio ativo</strong>
            </div>
          ) : canManageOperators ? (
            <form action={createOperatorForCondominium} className="deliveryForm">
              <p className="helperText">
                Cada operador pode ficar vinculado a apenas um condomínio.
              </p>
              <input type="hidden" name="condominiumId" value={activeCondominium.id} />
              <label className="field">
                <span>Nome completo</span>
                <input name="fullName" placeholder="Ex.: Carlos Lima" maxLength={120} required />
              </label>

              <div className="fieldRow">
                <label className="field">
                  <span>E-mail</span>
                  <input
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={120}
                    placeholder="carlos@condominio.com"
                    required
                  />
                </label>
              </div>

              <label className="field">
                <span>Papel</span>
                <DropdownSelect
                  name="role"
                  defaultValue="operator"
                  options={[
                    { value: "operator", label: "Operador" },
                    { value: "admin", label: "Administrador" },
                  ]}
                />
              </label>

              <button className="primaryButton" type="submit">
                Vincular operador e gerar link
              </button>
            </form>
          ) : (
            <div className="emptyState">
              <strong>Permissão insuficiente</strong>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>Bases cadastradas</h2>
          </div>
        </div>

        {condominiums.length === 0 ? (
          <div className="emptyState">
            <strong>Nenhum condomínio cadastrado</strong>
          </div>
        ) : (
          <div className="stackGrid settingsGrid">
            {condominiums.map((condominium) => (
              <article key={condominium.id} className="panel settingsCard">
                <span className="metricIcon metricAccentBlue">
                  <Database size={16} />
                </span>
                <h2>{condominium.name}</h2>
                <p>{condominium.slug ? `Slug: ${condominium.slug}` : "Slug não definido"}</p>
                <p>
                  {condominium.contact_phone
                    ? `Contato: ${condominium.contact_phone}`
                    : "Contato do condomínio não informado"}
                </p>
                {condominium.id === activeCondominium?.id ? (
                  <span className="inlineWarning">Ativo na operação</span>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

    </main>
  );
}
