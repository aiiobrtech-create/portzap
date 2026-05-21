import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperatorContext } from "@/lib/operator-auth";

export type CondominiumRecord = {
  id: string;
  name: string;
  slug: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_at?: string;
};

export async function listCondominiums(limit = 100) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("condominiums")
    .select("id, name, slug, contact_phone, is_active, created_at")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Falha ao listar condominios: ${error.message}`);
  }

  return (data ?? []) as CondominiumRecord[];
}

export async function resolveCondominiumContext() {
  const operatorContext = await getCurrentOperatorContext();
  const condominiums = operatorContext?.memberships ?? [];
  const activeCondominium = operatorContext?.activeCondominium ?? null;

  return {
    condominiums,
    activeCondominium,
  };
}
