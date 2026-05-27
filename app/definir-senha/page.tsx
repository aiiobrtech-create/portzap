import { FeedbackQueryCleanup } from "@/app/feedback-query-cleanup";
import { redirect } from "next/navigation";
import { completeInitialPassword } from "@/app/security-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const code = getSingleParam(resolvedSearchParams.code)?.trim() ?? "";
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      redirect("/login?tone=error&message=Link+de+convite+inv%C3%A1lido+ou+expirado.");
    }

    redirect("/definir-senha");
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/login?tone=error&message=Sess%C3%A3o+Supabase+inv%C3%A1lida+ou+expirada.");
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
        <FeedbackQueryCleanup />

        <form action={completeInitialPassword} className="deliveryForm">
          <label className="field">
            <span>E-mail da conta</span>
            <input value={authData.user?.email ?? ""} readOnly disabled />
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
