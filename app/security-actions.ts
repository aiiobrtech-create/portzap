"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createOperatorSession,
  invalidateCurrentOperatorSession,
  requireAuthorizedCondominium,
  requireOperatorContext,
  setActiveCondominiumCookie,
  setOnboardingCookie,
} from "@/lib/operator-auth";
import { buildSessionExpiry, generateOpaqueToken, hashOpaqueToken } from "@/lib/auth/session";
import { sanitizeStoredPhone } from "@/lib/input-formatting";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashPassword, verifyPassword } from "@/lib/security/password";

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
  token: z.string().trim().min(1, "Link inválido."),
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

  const supabase = createSupabaseAdminClient();
  const { data: user, error } = await supabase
    .from("operator_users")
    .select("id, full_name, email, password_hash, is_active, password_set_at, onboarding_completed")
    .eq("email", normalizeEmail(parsed.email))
    .single();

  if (
    error ||
    !user ||
    !user.is_active ||
    !user.password_hash ||
    !user.password_set_at ||
    !verifyPassword(parsed.password, user.password_hash)
  ) {
    redirect("/login?tone=error&message=Credenciais+inv%C3%A1lidas.");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("operator_memberships")
    .select("condominium_id, is_default, condominiums!inner(id, is_active)")
    .eq("user_id", user.id)
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

  await createOperatorSession(user.id, defaultMembership.condominium_id, user.onboarding_completed);
  redirect("/");
}

export async function completeInitialPassword(formData: FormData) {
  const parsed = initialPasswordSchema.parse({
    token: formData.get("token"),
    password: formData.get("password"),
  });

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const tokenHash = hashOpaqueToken(parsed.token);
  const { data: tokenRow, error } = await supabase
    .from("operator_password_setup_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", now)
    .single();

  if (error || !tokenRow) {
    redirect("/definir-senha?tone=error&message=Link+de+defini%C3%A7%C3%A3o+de+senha+inv%C3%A1lido+ou+expirado.");
  }

  const passwordHash = hashPassword(parsed.password);
  const { error: userError } = await supabase
    .from("operator_users")
    .update({
      password_hash: passwordHash,
      password_set_at: now,
    })
    .eq("id", tokenRow.user_id);

  if (userError) {
    redirect("/definir-senha?tone=error&message=Falha+ao+definir+a+senha.");
  }

  await supabase
    .from("operator_password_setup_tokens")
    .update({
      used_at: now,
    })
    .eq("id", tokenRow.id);

  redirect("/login?tone=success&message=Senha+definida+com+sucesso.+Agora+fa%C3%A7a+login.");
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
  await invalidateCurrentOperatorSession();
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
  let operatorUserId = "";
  let setupToken: string | null = null;

  const { data: existingUser } = await supabase
    .from("operator_users")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingUser?.id) {
    operatorUserId = existingUser.id;
  } else {
    const { data: createdUser, error: createUserError } = await supabase
      .from("operator_users")
      .insert({
        full_name: parsed.fullName.trim(),
        email: normalizedEmail,
        password_hash: null,
        password_set_at: null,
        onboarding_completed: false,
      })
      .select("id")
      .single();

    if (createUserError || !createdUser) {
      redirect("/configuracoes?tone=error&message=Falha+ao+cadastrar+o+novo+operador.");
    }

    operatorUserId = createdUser.id;
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

  if (!existingUser?.id) {
    setupToken = generateOpaqueToken();
    const expiresAt = buildSessionExpiry();
    const { error: tokenError } = await supabase.from("operator_password_setup_tokens").insert({
      user_id: operatorUserId,
      token_hash: hashOpaqueToken(setupToken),
      expires_at: expiresAt.toISOString(),
    });

    if (tokenError) {
      redirect("/configuracoes?tone=error&message=Operador+criado,+mas+falhou+a+gera%C3%A7%C3%A3o+do+link+de+senha.");
    }
  }

  redirect(
    `/configuracoes?tone=success&message=${encodeURIComponent(
      setupToken
        ? "Operador vinculado. Envie o link de definição de senha gerado na tela."
        : "Operador já existente vinculado com sucesso.",
    )}${setupToken ? `&setupToken=${encodeURIComponent(setupToken)}` : ""}`,
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
