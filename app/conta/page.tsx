import Link from "next/link";
import { Building2, Mail, Settings2, ShieldCheck, UserCircle2 } from "lucide-react";
import { updateOperatorProfile } from "@/app/security-actions";
import { requireOperatorContext } from "@/lib/operator-auth";

export const dynamic = "force-dynamic";

type AccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const feedbackMessage = getSingleParam(resolvedSearchParams.message)?.trim() ?? "";
  const feedbackTone = getSingleParam(resolvedSearchParams.tone);
  const { user, activeCondominium, memberships } = await requireOperatorContext();
  const activeMembership = activeCondominium
    ? memberships.find((membership) => membership.id === activeCondominium.id)
    : null;

  if (!activeCondominium) {
    return (
      <main className="pageShell">
        <section className="emptyState">
          <strong>Nenhum condomínio ativo</strong>
        </section>
      </main>
    );
  }

  return (
    <main className="pageShell">
      <header className="pageHeader">
        <h1>Conta</h1>
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

      <section className="contentGrid residentsContentGrid">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <h2>Meu acesso</h2>
            </div>
          </div>

          <form action={updateOperatorProfile} className="deliveryForm">
            <label className="field">
              <span>Nome completo</span>
              <input name="fullName" defaultValue={user.full_name} maxLength={120} required />
            </label>

            <label className="field">
              <span>E-mail</span>
              <input value={user.email} readOnly disabled />
            </label>

            <div className="fieldRow">
              <label className="field">
                <span>Status</span>
                <input value={user.is_active ? "Ativo" : "Inativo"} readOnly disabled />
              </label>

              <label className="field">
                <span>Papel</span>
                <input value={activeMembership?.role === "admin" ? "Administrador" : "Operador"} readOnly disabled />
              </label>
            </div>

            <button className="primaryButton" type="submit">
              Salvar conta
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div>
              <h2>Condomínio ativo</h2>
            </div>
          </div>

          <div className="stackGrid settingsGrid">
            <article className="panel settingsCard">
              <span className="metricIcon metricAccentBlue">
                <Building2 size={16} />
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

          <div className="inlineFormActions">
            <Link href="/configuracoes" className="secondaryLinkButton">
              <Settings2 size={16} />
              Abrir configurações
            </Link>
          </div>
        </div>
      </section>

      <section className="stackGrid settingsGrid">
        <article className="panel settingsCard">
          <span className="metricIcon metricAccentBlue">
            <UserCircle2 size={16} />
          </span>
          <h2>{user.full_name}</h2>
          <p>{user.email}</p>
        </article>

        <article className="panel settingsCard">
          <span className="metricIcon metricAccentGreen">
            <ShieldCheck size={16} />
          </span>
          <h2>{activeMembership?.role === "admin" ? "Administrador" : "Operador"}</h2>
          <p>Permissões da conta atual.</p>
        </article>

        <article className="panel settingsCard">
          <span className="metricIcon metricAccentAmber">
            <Mail size={16} />
          </span>
          <h2>Atalho rápido</h2>
          <p>Relatórios, histórico e operação ficam acessíveis pelo menu.</p>
        </article>
      </section>
    </main>
  );
}
