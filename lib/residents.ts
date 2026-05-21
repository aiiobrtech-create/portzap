import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type UnitRecord = {
  id: string;
  label: string;
  block: string | null;
  floor: string | null;
  is_active: boolean;
  created_at: string;
};

export type ResidentRecord = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  unit_id: string | null;
  units:
    | {
        label: string;
        block: string | null;
        floor: string | null;
      }
    | null;
};

export async function listUnits(limit = 100, condominiumId?: string) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("units")
    .select("id, label, block, floor, is_active, created_at")
    .order("label", { ascending: true })
    .limit(limit);

  if (condominiumId) {
    query = query.eq("condominium_id", condominiumId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Falha ao listar unidades: ${error.message}`);
  }

  return (data ?? []) as UnitRecord[];
}

export async function listResidents(limit = 100, condominiumId?: string) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("residents")
    .select("id, full_name, phone, email, is_active, created_at, unit_id, units(label, block, floor)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (condominiumId) {
    query = query.eq("condominium_id", condominiumId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Falha ao listar moradores: ${error.message}`);
  }

  return (data ?? []).map((resident) => ({
    id: resident.id,
    full_name: resident.full_name,
    phone: resident.phone,
    email: resident.email,
    is_active: resident.is_active,
    created_at: resident.created_at,
    unit_id: resident.unit_id,
    units: Array.isArray(resident.units) ? (resident.units[0] ?? null) : resident.units ?? null,
  })) as ResidentRecord[];
}
