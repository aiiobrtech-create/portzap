import { redirect } from "next/navigation";
import { completeInitialPassword } from "@/app/security-actions";
import { getPasswordSetupInviteByToken } from "@/lib/password-setup";

type SetPasswordPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const feedbackMessage = getSingleParam(resolvedSearchParams.message)?.trim() ?? "";
  const feedbackTone = getSingleParam(resolvedSearchParams.tone);
  const token = getSingleParam(resolvedSearchParams.token)?.trim() ?? "";
  const invite = await getPasswordSetupInviteByToken(token);

  if (!token || !invite) {
    redirect("/login?tone=error&message=Link+de+defini%C3%A7%C3%A3o+de+senha+inv%C3%A1lido+ou+expirado.");
  }

  return (
    <main className="authPage">
      <section className="authCard">
        <div className="authHeader">
          <span className="sectionEyebrow">Primeiro acesso</span>
          <h1>Definir nova senha</h1>
        </div>

        {feedbackMessage ? (
          <section
            className={`feedbackBanner${feedbackTone === "error" ? " feedbackBannerError" : " feedbackBannerSuccess"}`}
          >
            <strong>{feedbackTone === "error" ? "Falha ao definir senha" : "Operação concluída"}</strong>
            <p>{feedbackMessage}</p>
          </section>
        ) : null}

        <form action={completeInitialPassword} className="deliveryForm">
          <input type="hidden" name="token" value={token} />

          <label className="field">
            <span>E-mail da conta</span>
            <input value={invite.user.email} readOnly disabled />
          </label>

          <label className="field">
            <span>Nova senha</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              maxLength={128}
              placeholder="Mínimo de 8 caracteres"
              required
            />
          </label>

          <button className="primaryButton" type="submit">
            Salvar senha
          </button>
        </form>
      </section>
    </main>
  );
}
