import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ACTIVE_CONDOMINIUM_COOKIE_NAME,
  ONBOARDING_COOKIE_NAME,
} from "@/lib/auth/session";

export const operatorRoles = ["admin", "operator"] as const;

export type OperatorRole = (typeof operatorRoles)[number];

export type OperatorUser = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  is_active: boolean;
  onboarding_completed: boolean;
};

export type AuthorizedCondominium = {
  id: string;
  name: string;
  slug: string | null;
  contact_phone: string | null;
  is_active: boolean;
  membershipId: string;
  role: OperatorRole;
  isDefault: boolean;
};

export type OperatorContext = {
  user: OperatorUser;
  memberships: AuthorizedCondominium[];
  activeCondominium: AuthorizedCondominium | null;
};

type AuthSessionUser = {
  id: string;
  email: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function getSecureCookieFlag() {
  return process.env.NODE_ENV === "production";
}

function mapMemberships(
  rows: Array<{
    id: string;
    role: string;
    is_default: boolean;
    condominiums:
      | {
          id: string;
          name: string;
          slug: string | null;
          contact_phone: string | null;
          is_active: boolean;
        }
      | Array<{
          id: string;
          name: string;
          slug: string | null;
          contact_phone: string | null;
          is_active: boolean;
        }>
      | null;
  }>,
) {
  return rows
    .map((membership) => {
      const condominium = Array.isArray(membership.condominiums)
        ? membership.condominiums[0]
        : membership.condominiums;

      if (!condominium?.is_active) {
        return null;
      }

      return {
        id: condominium.id,
        name: condominium.name,
        slug: condominium.slug,
        contact_phone: condominium.contact_phone,
        is_active: condominium.is_active,
        membershipId: membership.id,
        role: membership.role as OperatorRole,
        isDefault: membership.is_default,
      } satisfies AuthorizedCondominium;
    })
    .filter(Boolean) as AuthorizedCondominium[];
}

function mapOperatorUser(row: {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  is_active: boolean;
  onboarding_completed: boolean;
}): OperatorUser {
  return {
    id: row.id,
    auth_user_id: row.auth_user_id,
    full_name: row.full_name,
    email: row.email,
    is_active: row.is_active,
    onboarding_completed: row.onboarding_completed,
  };
}

export async function ensureOperatorProfileForAuthUser(authUser: AuthSessionUser) {
  const supabase = createSupabaseAdminClient();
  const normalizedEmail = authUser.email?.trim().toLowerCase() ?? null;
  const fullNameFromMetadata =
    typeof authUser.user_metadata?.full_name === "string"
      ? authUser.user_metadata.full_name.trim()
      : "";

  const { data: existingProfile, error: profileError } = await supabase
    .from("operator_users")
    .select("id, auth_user_id, full_name, email, is_active, onboarding_completed")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Falha ao carregar o perfil do operador: ${profileError.message}`);
  }

  if (existingProfile) {
    return mapOperatorUser(existingProfile);
  }

  if (!normalizedEmail) {
    throw new Error("Conta Supabase sem e-mail não pode ser vinculada ao operador.");
  }

  const { data: emailProfile, error: emailProfileError } = await supabase
    .from("operator_users")
    .select("id, auth_user_id, full_name, email, is_active, onboarding_completed")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (emailProfileError) {
    throw new Error(`Falha ao localizar o perfil do operador pelo e-mail: ${emailProfileError.message}`);
  }

  if (emailProfile) {
    if (emailProfile.auth_user_id !== authUser.id) {
      const { error: linkError } = await supabase
        .from("operator_users")
        .update({
          auth_user_id: authUser.id,
        })
        .eq("id", emailProfile.id);

      if (linkError) {
        throw new Error(`Falha ao vincular conta Supabase ao operador: ${linkError.message}`);
      }
    }

    return mapOperatorUser({
      ...emailProfile,
      auth_user_id: authUser.id,
    });
  }

  const { data: createdProfile, error: createError } = await supabase
    .from("operator_users")
    .insert({
      auth_user_id: authUser.id,
      full_name: fullNameFromMetadata || normalizedEmail,
      email: normalizedEmail,
      onboarding_completed: false,
      is_active: true,
    })
    .select("id, auth_user_id, full_name, email, is_active, onboarding_completed")
    .single();

  if (createError || !createdProfile) {
    throw new Error(`Falha ao criar perfil do operador: ${createError?.message ?? "sem retorno"}`);
  }

  return mapOperatorUser(createdProfile);
}

export async function countOperatorUsers() {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("operator_users")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(`Falha ao contar operadores: ${error.message}`);
  }

  return count ?? 0;
}

export const getCurrentOperatorContext = cache(async (): Promise<OperatorContext | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return null;
    }

    const profile = await ensureOperatorProfileForAuthUser({
      id: authData.user.id,
      email: authData.user.email ?? null,
      user_metadata: authData.user.user_metadata,
    });

    if (!profile.is_active) {
      return null;
    }

    const adminClient = createSupabaseAdminClient();
    const { data: memberships, error: membershipError } = await adminClient
      .from("operator_memberships")
      .select("id, role, is_default, condominiums!inner(id, name, slug, contact_phone, is_active)")
      .eq("user_id", profile.id)
      .eq("is_active", true);

    if (membershipError) {
      throw new Error(`Falha ao carregar vínculos do operador: ${membershipError.message}`);
    }

    const authorizedCondominiums = mapMemberships(memberships ?? []);
    if (authorizedCondominiums.length === 0) {
      return null;
    }

    const cookieStore = await cookies();
    const requestedCondominiumId = cookieStore.get(ACTIVE_CONDOMINIUM_COOKIE_NAME)?.value;
    const activeCondominium =
      authorizedCondominiums.find((membership) => membership.id === requestedCondominiumId) ??
      authorizedCondominiums.find((membership) => membership.isDefault) ??
      authorizedCondominiums[0] ??
      null;

    return {
      user: profile,
      memberships: authorizedCondominiums,
      activeCondominium,
    };
  } catch (error) {
    console.error("Falha ao resolver contexto do operador:", error);
    return null;
  }
});

export async function requireOperatorContext() {
  const context = await getCurrentOperatorContext();

  if (!context) {
    redirect("/login");
  }

  return context;
}

export async function requireAuthorizedCondominium(requestedCondominiumId?: string) {
  const context = await requireOperatorContext();
  const resolved =
    (requestedCondominiumId
      ? context.memberships.find((membership) => membership.id === requestedCondominiumId)
      : context.activeCondominium) ?? null;

  if (!resolved) {
    throw new Error("O operador autenticado não tem acesso ao condomínio solicitado.");
  }

  return {
    user: context.user,
    memberships: context.memberships,
    activeCondominium: resolved,
    activeMembership: context.memberships.find((membership) => membership.id === resolved.id) ?? resolved,
  };
}

export function buildOperatorLabel(user: Pick<OperatorUser, "full_name" | "email">) {
  return `${user.full_name} (${user.email})`;
}

export async function setActiveCondominiumCookie(condominiumId: string) {
  const cookieStore = await cookies();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  cookieStore.set(ACTIVE_CONDOMINIUM_COOKIE_NAME, condominiumId, {
    httpOnly: true,
    sameSite: "lax",
    secure: getSecureCookieFlag(),
    expires: expiresAt,
    path: "/",
  });
}

export async function setOnboardingCookie(isCompleted: boolean) {
  const cookieStore = await cookies();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  cookieStore.set(ONBOARDING_COOKIE_NAME, isCompleted ? "done" : "pending", {
    httpOnly: true,
    sameSite: "lax",
    secure: getSecureCookieFlag(),
    expires: expiresAt,
    path: "/",
  });
}
