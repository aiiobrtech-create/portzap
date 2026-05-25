"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ensureOperatorProfileForAuthUser,
  requireAuthorizedCondominium,
  requireOperatorContext,
  setActiveCondominiumCookie,
  setOnboardingCookie,
} from "@/lib/operator-auth";
import { getAppBaseUrl } from "@/lib/app-url";
import { sanitizeStoredPhone } from "@/lib/input-formatting";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha.").max(128, "Senha inválida."),
});

const switchCondominiumSchema = z.object({
  condominiumId: z.string().uuid("Condomínio inválido."),
  returnPath: z.string().trim().min(1).default("/"),
});

const createOperatorSchema = z.object({
  condominiumId: z.string().uuid("Condomínio inválido."),
  fullName: z.string().trim().min(3, "Informe o nome completo.").max(120, "Use até 120 caracteres."),
  email: z.email("Informe um e-mail válido."),
  role: z.enum(["admin", "operator"]).default("operator"),
});
const updateOperatorProfileSchema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo.").max(120, "Use até 120 caracteres."),
});
const initialPasswordSchema = z.object({
  password: z.string().min(8, "Use uma senha com ao menos 8 caracteres.").max(128, "Use até 128 caracteres."),
});

const firstAccessSchema = z.object({
  condominiumId: z.string().uuid("Condomínio inválido."),
  name: z.string().trim().min(3, "Informe o nome do condomínio.").max(120, "Use até 120 caracteres."),
  slug: z
    .string()
    .trim()
    .min(3, "Informe o slug do condomínio.")
    .max(80, "Use até 80 caracteres no slug.")
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hifens."),
  contactPhone: z.string().trim().max(20).optional(),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function loginOperator(formData: FormData) {
  const parsed = loginSchema.parse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  const normalizedEmail = normalizeEmail(parsed.email);
  const serverSupabase = await createSupabaseServerClient();
  const { data: authLogin, error: authLoginError } = await serverSupabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: parsed.password,
  });

  if (authLoginError || !authLogin.session || !authLogin.user) {
    redirect("/login?tone=error&message=Credenciais+inv%C3%A1lidas.");
  }

  const profile = await ensureOperatorProfileForAuthUser({
    id: authLogin.user.id,
    email: authLogin.user.email ?? normalizedEmail,
    user_metadata: authLogin.user.user_metadata,
  });

  if (!profile.is_active) {
    redirect("/login?tone=error&message=Conta+do+operador+inativa.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: memberships, error: membershipError } = await supabase
    .from("operator_memberships")
    .select("condominium_id, is_default, condominiums!inner(id, is_active)")
    .eq("user_id", profile.id)
    .eq("is_active", true);

  if (membershipError) {
    redirect("/login?tone=error&message=Falha+ao+carregar+os+condom%C3%ADnios+do+operador.");
  }

  const availableMemberships = (memberships ?? []).filter((membership) => {
    const condominium = Array.isArray(membership.condominiums)
      ? membership.condominiums[0]
      : membership.condominiums;

    return !!condominium?.is_active;
  });

  if (availableMemberships.length === 0) {
    redirect("/login?tone=error&message=Operador+sem+condom%C3%ADnio+ativo+vinculado.");
  }

  const defaultMembership =
    availableMemberships.find((membership) => membership.is_default) ?? availableMemberships[0];

  await setActiveCondominiumCookie(defaultMembership.condominium_id);
  await setOnboardingCookie(profile.onboarding_completed);
  redirect("/");
}

export async function completeInitialPassword(formData: FormData) {
  const parsed = initialPasswordSchema.parse({
    password: formData.get("password"),
  });

  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    redirect("/definir-senha?tone=error&message=Sess%C3%A3o+Supabase+inv%C3%A1lida+ou+expirada.");
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password: parsed.password,
  });

  if (passwordError) {
    redirect("/definir-senha?tone=error&message=Falha+ao+definir+a+senha.");
  }

  const profile = await ensureOperatorProfileForAuthUser({
    id: authData.user.id,
    email: authData.user.email ?? null,
    user_metadata: authData.user.user_metadata,
  });

  const adminSupabase = createSupabaseAdminClient();
  await adminSupabase
    .from("operator_users")
    .update({
      full_name: profile.full_name,
      email: profile.email,
    })
    .eq("id", profile.id);

  redirect("/?tone=success&message=Senha+definida+com+sucesso.");
}

export async function completeFirstAccess(formData: FormData) {
  const parsed = firstAccessSchema.parse({
    condominiumId: formData.get("condominiumId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    contactPhone: formData.get("contactPhone") || undefined,
  });

  const { user, activeCondominium, activeMembership } = await requireAuthorizedCondominium(
    parsed.condominiumId,
  );

  if (activeMembership.role !== "admin") {
    redirect("/primeiro-acesso?tone=error&message=Apenas+administradores+podem+finalizar+o+primeiro+acesso.");
  }

  const storedPhone = parsed.contactPhone ? sanitizeStoredPhone(parsed.contactPhone) : null;
  const supabase = createSupabaseAdminClient();
  const { error: condominiumError } = await supabase
    .from("condominiums")
    .update({
      name: parsed.name,
      slug: parsed.slug,
      contact_phone: storedPhone,
    })
    .eq("id", activeCondominium.id);

  if (condominiumError) {
    redirect("/primeiro-acesso?tone=error&message=Falha+ao+salvar+as+configura%C3%A7%C3%B5es+iniciais.");
  }

  const { error: userError } = await supabase
    .from("operator_users")
    .update({
      onboarding_completed: true,
    })
    .eq("id", user.id);

  if (userError) {
    redirect("/primeiro-acesso?tone=error&message=Falha+ao+concluir+o+primeiro+acesso.");
  }

  await setOnboardingCookie(true);
  redirect("/?tone=success&message=Configura%C3%A7%C3%A3o+inicial+conclu%C3%ADda.");
}

export async function logoutOperator() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setActiveCondominium(formData: FormData) {
  const parsed = switchCondominiumSchema.parse({
    condominiumId: formData.get("condominiumId"),
    returnPath: formData.get("returnPath") || "/",
  });

  const context = await requireOperatorContext();
  const authorized = context.memberships.some((membership) => membership.id === parsed.condominiumId);

  if (!authorized) {
    throw new Error("O operador autenticado não tem acesso ao condomínio solicitado.");
  }

  await setActiveCondominiumCookie(parsed.condominiumId);
  redirect(parsed.returnPath);
}

export async function createOperatorForCondominium(formData: FormData) {
  const parsed = createOperatorSchema.parse({
    condominiumId: formData.get("condominiumId"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    role: formData.get("role") || "operator",
  });

  const context = await requireOperatorContext();
  const activeMembership = context.memberships.find((membership) => membership.id === parsed.condominiumId);

  if (!activeMembership || activeMembership.role !== "admin") {
    redirect("/configuracoes?tone=error&message=Somente+administradores+podem+gerenciar+operadores.");
  }

  const supabase = createSupabaseAdminClient();
  const normalizedEmail = normalizeEmail(parsed.email);
  const { data: existingProfile, error: profileError } = await supabase
    .from("operator_users")
    .select("id, auth_user_id, full_name, email, is_active, onboarding_completed")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (profileError) {
    redirect("/configuracoes?tone=error&message=Falha+ao+verificar+o+operador+existente.");
  }

  const profileId = existingProfile?.id ?? null;

  if (profileId) {
    const { data: memberships, error: membershipLookupError } = await supabase
      .from("operator_memberships")
      .select("condominium_id")
      .eq("user_id", profileId);

    if (membershipLookupError) {
      redirect("/configuracoes?tone=error&message=Falha+ao+verificar+os+v%C3%ADnculos+do+operador.");
    }

    const linkedCondominiumIds = Array.from(
      new Set((memberships ?? []).map((membership) => membership.condominium_id)),
    );

    if (linkedCondominiumIds.length > 0 && !linkedCondominiumIds.includes(parsed.condominiumId)) {
      redirect(
        "/configuracoes?tone=error&message=Cada+operador+pode+pertencer+a+apenas+um+condom%C3%ADnio.",
      );
    }
  }

  const shouldCreateAuthInvite = !existingProfile?.auth_user_id;
  let setupLink: string | null = null;
  let authUserId = existingProfile?.auth_user_id ?? null;

  if (shouldCreateAuthInvite) {
    const baseUrl = await getAppBaseUrl();
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.generateLink({
      type: "invite",
      email: normalizedEmail,
      options: {
        data: {
          full_name: parsed.fullName.trim(),
          condominium_id: parsed.condominiumId,
          role: parsed.role,
        },
        redirectTo: `${baseUrl}/definir-senha`,
      },
    });

    if (inviteError || !inviteData?.user?.id || !inviteData.properties?.action_link) {
      redirect("/configuracoes?tone=error&message=Falha+ao+gerar+o+convite+nativo+do+Supabase.");
    }

    authUserId = inviteData.user.id;
    setupLink = inviteData.properties.action_link;
  }

  if (existingProfile) {
    const { error: updateError } = await supabase
      .from("operator_users")
      .update({
        auth_user_id: authUserId,
        full_name: parsed.fullName.trim(),
        email: normalizedEmail,
        is_active: true,
      })
      .eq("id", existingProfile.id);

    if (updateError) {
      redirect("/configuracoes?tone=error&message=Falha+ao+atualizar+o+operador.");
    }
  } else {
    const { error: createError } = await supabase.from("operator_users").insert({
      id: authUserId,
      auth_user_id: authUserId,
      full_name: parsed.fullName.trim(),
      email: normalizedEmail,
      onboarding_completed: false,
      is_active: true,
    });

    if (createError) {
      redirect("/configuracoes?tone=error&message=Falha+ao+cadastrar+o+novo+operador.");
    }
  }

  const operatorUserId = profileId ?? authUserId;
  if (!operatorUserId) {
    redirect("/configuracoes?tone=error&message=Falha+ao+identificar+o+operador+criado.");
  }

  const { data: existingMemberships, error: membershipLookupError } = await supabase
    .from("operator_memberships")
    .select("condominium_id")
    .eq("user_id", operatorUserId);

  if (membershipLookupError) {
    redirect("/configuracoes?tone=error&message=Falha+ao+verificar+os+v%C3%ADnculos+do+operador.");
  }

  const linkedCondominiumIds = Array.from(
    new Set((existingMemberships ?? []).map((membership) => membership.condominium_id)),
  );

  if (linkedCondominiumIds.length > 0) {
    if (linkedCondominiumIds.includes(parsed.condominiumId)) {
      const message = setupLink
        ? "Operador já estava vinculado e o link de convite nativo foi gerado novamente."
        : "Operador já está vinculado a este condomínio.";

      redirect(`/configuracoes?tone=success&message=${encodeURIComponent(message)}${setupLink ? `&setupLink=${encodeURIComponent(setupLink)}` : ""}`);
    }

    redirect(
      "/configuracoes?tone=error&message=Cada+operador+pode+pertencer+a+apenas+um+condom%C3%ADnio.",
    );
  }

  const { error: membershipError } = await supabase.from("operator_memberships").insert({
    user_id: operatorUserId,
    condominium_id: parsed.condominiumId,
    role: parsed.role,
    is_default: false,
  });

  if (membershipError) {
    redirect("/configuracoes?tone=error&message=Falha+ao+vincular+o+operador+ao+condom%C3%ADnio.");
  }

  redirect(
    `/configuracoes?tone=success&message=${encodeURIComponent(
      setupLink
        ? "Operador vinculado. Envie o link de convite Supabase gerado na tela."
        : "Operador já existente vinculado com sucesso.",
    )}${setupLink ? `&setupLink=${encodeURIComponent(setupLink)}` : ""}`,
  );
}

export async function updateOperatorProfile(formData: FormData) {
  const parsed = updateOperatorProfileSchema.parse({
    fullName: formData.get("fullName"),
  });

  const context = await requireOperatorContext();
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("operator_users")
    .update({
      full_name: parsed.fullName.trim(),
    })
    .eq("id", context.user.id);

  if (error) {
    redirect("/conta?tone=error&message=Falha+ao+atualizar+os+dados+da+conta.");
  }

  redirect("/conta?tone=success&message=Conta+atualizada+com+sucesso.");
}
