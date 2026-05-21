import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashOpaqueToken } from "@/lib/auth/session";

export async function getPasswordSetupInviteByToken(token: string) {
  if (!token.trim()) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("operator_password_setup_tokens")
    .select("id, user_id, expires_at, used_at, operator_users!inner(id, email, full_name)")
    .eq("token_hash", hashOpaqueToken(token))
    .is("used_at", null)
    .gt("expires_at", now)
    .single();

  if (error || !data) {
    return null;
  }

  const user = Array.isArray(data.operator_users) ? data.operator_users[0] : data.operator_users;

  return {
    id: data.id,
    user_id: data.user_id,
    expires_at: data.expires_at,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
    },
  };
}
