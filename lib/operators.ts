import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { OperatorRole } from "@/lib/operator-auth";

export type CondominiumOperatorRecord = {
  membership_id: string;
  role: OperatorRole;
  is_default: boolean;
  is_active: boolean;
  user: {
    id: string;
    full_name: string;
    email: string;
    is_active: boolean;
  };
};

export async function listCondominiumOperators(condominiumId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("operator_memberships")
    .select("id, role, is_default, is_active, operator_users!inner(id, full_name, email, is_active)")
    .eq("condominium_id", condominiumId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Falha ao listar operadores do condomínio: ${error.message}`);
  }

  return (data ?? []).map((membership) => {
    const user = Array.isArray(membership.operator_users)
      ? membership.operator_users[0]
      : membership.operator_users;

    return {
      membership_id: membership.id,
      role: membership.role as OperatorRole,
      is_default: membership.is_default,
      is_active: membership.is_active,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        is_active: user.is_active,
      },
    };
  }) as CondominiumOperatorRecord[];
}
