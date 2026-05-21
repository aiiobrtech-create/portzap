import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isPickupExpired } from "@/lib/pickups";

export const pickupTokenStatuses = ["active", "used", "cancelled", "expired"] as const;

export type PickupTokenStatus = (typeof pickupTokenStatuses)[number];

export type PickupTokenRecord = {
  id: string;
  delivery_id: string;
  condominium_id: string;
  token_value: string;
  status: PickupTokenStatus;
  expires_at: string;
  created_at: string;
  used_at: string | null;
  delivery: {
    id: string;
    resident_name: string;
    apartment: string;
    status: string;
    carrier: string | null;
    description: string | null;
  } | null;
};

function normalizePickupTokenRow(
  row: {
    id: string;
    delivery_id: string;
    condominium_id: string;
    token_value: string;
    status: string;
    expires_at: string;
    created_at: string;
    used_at: string | null;
    deliveries:
      | {
          id: string;
          resident_name: string;
          apartment: string;
          status: string;
          carrier: string | null;
          description: string | null;
        }
      | Array<{
          id: string;
          resident_name: string;
          apartment: string;
          status: string;
          carrier: string | null;
          description: string | null;
        }>
      | null;
  },
) {
  const delivery = Array.isArray(row.deliveries) ? row.deliveries[0] : row.deliveries;

  return {
    id: row.id,
    delivery_id: row.delivery_id,
    condominium_id: row.condominium_id,
    token_value: row.token_value,
    status: row.status as PickupTokenStatus,
    expires_at: row.expires_at,
    created_at: row.created_at,
    used_at: row.used_at,
    delivery: delivery
      ? {
          id: delivery.id,
          resident_name: delivery.resident_name,
          apartment: delivery.apartment,
          status: delivery.status,
          carrier: delivery.carrier,
          description: delivery.description,
        }
      : null,
  } satisfies PickupTokenRecord;
}

export async function getPickupTokenByValue(tokenValue: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("delivery_pickup_tokens")
    .select(
      "id, delivery_id, condominium_id, token_value, status, expires_at, created_at, used_at, deliveries(id, resident_name, apartment, status, carrier, description)",
    )
    .eq("token_value", tokenValue)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw new Error(`Falha ao localizar token de retirada: ${error.message}`);
  }

  return normalizePickupTokenRow(data);
}

export async function getActivePickupTokenForDelivery(deliveryId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("delivery_pickup_tokens")
    .select(
      "id, delivery_id, condominium_id, token_value, status, expires_at, created_at, used_at, deliveries(id, resident_name, apartment, status, carrier, description)",
    )
    .eq("delivery_id", deliveryId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao localizar QR ativo da encomenda: ${error.message}`);
  }

  return data ? normalizePickupTokenRow(data) : null;
}

export async function getActivePickupTokensForDeliveries(deliveryIds: string[]) {
  if (deliveryIds.length === 0) {
    return new Map<string, PickupTokenRecord>();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("delivery_pickup_tokens")
    .select(
      "id, delivery_id, condominium_id, token_value, status, expires_at, created_at, used_at, deliveries(id, resident_name, apartment, status, carrier, description)",
    )
    .in("delivery_id", deliveryIds)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Falha ao listar QRs ativos: ${error.message}`);
  }

  const tokens = new Map<string, PickupTokenRecord>();

  for (const row of data ?? []) {
    if (tokens.has(row.delivery_id)) {
      continue;
    }

    const normalized = normalizePickupTokenRow(row);

    if (isPickupExpired(normalized.expires_at)) {
      continue;
    }

    tokens.set(row.delivery_id, normalized);
  }

  return tokens;
}
