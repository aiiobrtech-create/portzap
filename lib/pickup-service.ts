import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildPickupExpiryDate,
  buildPickupResidentUrl,
  generatePickupToken,
  isPickupExpired,
} from "@/lib/pickups";

export async function cancelActivePickupTokensForDelivery(
  deliveryId: string,
  condominiumId: string,
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("delivery_pickup_tokens")
    .update({
      status: "cancelled",
      invalidated_at: new Date().toISOString(),
    })
    .eq("delivery_id", deliveryId)
    .eq("condominium_id", condominiumId)
    .eq("status", "active");

  if (error) {
    throw new Error(`Falha ao invalidar QRs ativos: ${error.message}`);
  }
}

export async function createPickupTokenForDelivery(input: {
  deliveryId: string;
  condominiumId: string;
  createdBy: string;
}) {
  await cancelActivePickupTokensForDelivery(input.deliveryId, input.condominiumId);

  const supabase = createSupabaseAdminClient();
  const tokenValue = generatePickupToken();
  const expiresAt = buildPickupExpiryDate();
  const { data, error } = await supabase
    .from("delivery_pickup_tokens")
    .insert({
      delivery_id: input.deliveryId,
      condominium_id: input.condominiumId,
      token_value: tokenValue,
      expires_at: expiresAt.toISOString(),
      created_by: input.createdBy,
      status: "active",
    })
    .select("id, token_value, expires_at")
    .single();

  if (error || !data) {
    throw new Error(`Falha ao gerar QR de retirada: ${error?.message ?? "sem retorno"}`);
  }

  return data;
}

export async function buildPickupLinkForDelivery(input: {
  deliveryId: string;
  condominiumId: string;
  createdBy: string;
  baseUrl: string;
}) {
  const token = await createPickupTokenForDelivery(input);

  return {
    tokenValue: token.token_value,
    expiresAt: token.expires_at,
    residentUrl: buildPickupResidentUrl(input.baseUrl, token.token_value),
  };
}

export async function consumePickupToken(input: {
  tokenValue: string;
  operatorId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("delivery_pickup_tokens")
    .select("id, delivery_id, condominium_id, token_value, status, expires_at, used_at")
    .eq("token_value", input.tokenValue)
    .single();

  if (error || !data) {
    throw new Error("QR de retirada não encontrado.");
  }

  if (data.status === "used") {
    throw new Error("Esse QR já foi utilizado.");
  }

  if (data.status === "cancelled") {
    throw new Error("Esse QR foi invalidado.");
  }

  if (data.status === "expired" || isPickupExpired(data.expires_at)) {
    await supabase
      .from("delivery_pickup_tokens")
      .update({
        status: "expired",
      })
      .eq("id", data.id);

    throw new Error("Esse QR expirou.");
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("delivery_pickup_tokens")
    .update({
      status: "used",
      used_at: now,
      used_by: input.operatorId,
    })
    .eq("id", data.id)
    .eq("status", "active");

  if (updateError) {
    throw new Error(`Falha ao consumir QR de retirada: ${updateError.message}`);
  }

  return {
    deliveryId: data.delivery_id,
    condominiumId: data.condominium_id,
    usedAt: now,
  };
}
