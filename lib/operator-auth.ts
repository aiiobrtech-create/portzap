import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  ACTIVE_CONDOMINIUM_COOKIE_NAME,
  buildSessionExpiry,
  generateOpaqueToken,
  hashOpaqueToken,
  ONBOARDING_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";

export const operatorRoles = ["admin", "operator"] as const;

export type OperatorRole = (typeof operatorRoles)[number];

export type OperatorUser = {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  password_set_at: string | null;
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
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const tokenHash = hashOpaqueToken(sessionToken);
  const now = new Date().toISOString();

  const { data: session, error: sessionError } = await supabase
    .from("operator_sessions")
    .select("id, user_id, expires_at, invalidated_at, operator_users!inner(id, full_name, email, is_active, password_set_at, onboarding_completed)")
    .eq("token_hash", tokenHash)
    .is("invalidated_at", null)
    .gt("expires_at", now)
    .single();

  if (sessionError || !session) {
    return null;
  }

  const user = Array.isArray(session.operator_users) ? session.operator_users[0] : session.operator_users;

  if (!user?.is_active) {
    return null;
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("operator_memberships")
    .select("id, role, is_default, condominiums!inner(id, name, slug, contact_phone, is_active)")
    .eq("user_id", session.user_id)
    .eq("is_active", true);

  if (membershipError) {
    throw new Error(`Falha ao carregar vínculos do operador: ${membershipError.message}`);
  }

  const authorizedCondominiums = mapMemberships(memberships ?? []);
  const requestedCondominiumId = cookieStore.get(ACTIVE_CONDOMINIUM_COOKIE_NAME)?.value;
  const activeCondominium =
    authorizedCondominiums.find((membership) => membership.id === requestedCondominiumId) ??
    authorizedCondominiums.find((membership) => membership.isDefault) ??
    authorizedCondominiums[0] ??
    null;

  return {
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      is_active: user.is_active,
      password_set_at: user.password_set_at,
      onboarding_completed: user.onboarding_completed,
    },
    memberships: authorizedCondominiums,
    activeCondominium,
  };
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

export async function createOperatorSession(
  userId: string,
  activeCondominiumId?: string | null,
  onboardingCompleted = false,
) {
  const supabase = createSupabaseAdminClient();
  const rawToken = generateOpaqueToken();
  const expiresAt = buildSessionExpiry();
  const { error } = await supabase.from("operator_sessions").insert({
    user_id: userId,
    token_hash: hashOpaqueToken(rawToken),
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    throw new Error(`Falha ao criar sessão do operador: ${error.message}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: getSecureCookieFlag(),
    expires: expiresAt,
    path: "/",
  });

  cookieStore.set(ONBOARDING_COOKIE_NAME, onboardingCompleted ? "done" : "pending", {
    httpOnly: true,
    sameSite: "lax",
    secure: getSecureCookieFlag(),
    expires: expiresAt,
    path: "/",
  });

  if (activeCondominiumId) {
    cookieStore.set(ACTIVE_CONDOMINIUM_COOKIE_NAME, activeCondominiumId, {
      httpOnly: true,
      sameSite: "lax",
      secure: getSecureCookieFlag(),
      expires: expiresAt,
      path: "/",
    });
  }
}

export async function invalidateCurrentOperatorSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    const supabase = createSupabaseAdminClient();
    await supabase
      .from("operator_sessions")
      .update({
        invalidated_at: new Date().toISOString(),
      })
      .eq("token_hash", hashOpaqueToken(rawToken))
      .is("invalidated_at", null);
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(ACTIVE_CONDOMINIUM_COOKIE_NAME);
  cookieStore.delete(ONBOARDING_COOKIE_NAME);
}

export async function setActiveCondominiumCookie(condominiumId: string) {
  const cookieStore = await cookies();
  const expiresAt = buildSessionExpiry();

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
  const expiresAt = buildSessionExpiry();

  cookieStore.set(ONBOARDING_COOKIE_NAME, isCompleted ? "done" : "pending", {
    httpOnly: true,
    sameSite: "lax",
    secure: getSecureCookieFlag(),
    expires: expiresAt,
    path: "/",
  });
}
