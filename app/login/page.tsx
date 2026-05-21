import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowRight, QrCode, ShieldCheck, Archive } from "lucide-react";
import { loginOperator } from "@/app/security-actions";
import { getCurrentOperatorContext } from "@/lib/operator-auth";
import logoClean from "../../logo/logo-clean.png";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [resolvedSearchParams, currentOperator] = await Promise.all([
    searchParams,
    getCurrentOperatorContext(),
  ]);

  if (currentOperator) {
    redirect("/");
  }

  const feedbackMessage = getSingleParam(resolvedSearchParams?.message)?.trim() ?? "";
  const feedbackTone = getSingleParam(resolvedSearchParams?.tone);

  return (
    <main className="authPage">
      <section className="authShell">
        <aside className="authBrandPanel">
          <div className="authBrandInner">
            <div className="authBrandHeader">
              <Image src={logoClean} alt="Portzap" className="authBrandLogo" priority />
              <span className="sectionEyebrow">Portaria operacional</span>
              <h1>Gestão de encomendas com controle real da operação.</h1>
              <p>
                Entrada para operadores autorizados, com histórico, QR de retirada e
                notificações integradas.
              </p>
            </div>

            <div className="authBrandFooter">
              <div className="authMicroStat">
                <QrCode size={16} />
                <strong>Retirada digital</strong>
              </div>
              <div className="authMicroStat">
                <Archive size={16} />
                <strong>Auditoria completa</strong>
              </div>
              <div className="authMicroStat">
                <ShieldCheck size={16} />
                <strong>Operação contínua</strong>
              </div>
            </div>
          </div>
        </aside>

        <section className="authLoginWrap">
          <div className="authCard authLoginCard">
            <div className="authHeader">
              <span className="sectionEyebrow">Acesso do operador</span>
              <h2>Entrar na operação</h2>
            </div>

            {feedbackMessage ? (
              <section
                className={`feedbackBanner${feedbackTone === "error" ? " feedbackBannerError" : " feedbackBannerSuccess"}`}
              >
                <strong>{feedbackTone === "error" ? "Falha no acesso" : "Operação concluída"}</strong>
                <p>{feedbackMessage}</p>
              </section>
            ) : null}

            <form action={loginOperator} className="deliveryForm">
              <label className="field">
                <span>E-mail</span>
                <input
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={120}
                  placeholder="operador@condominio.com"
                  required
                />
              </label>

              <label className="field">
                <span>Senha</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  maxLength={128}
                  placeholder="Sua senha"
                  required
                />
              </label>

              <button className="primaryButton authSubmitButton" type="submit">
                Entrar
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}
