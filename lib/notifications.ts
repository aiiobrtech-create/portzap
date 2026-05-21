import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NotificationAttemptStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export type NotificationAttemptRecord = {
  id: string;
  delivery_id: string;
  channel: string;
  provider: string;
  status: NotificationAttemptStatus;
  target: string | null;
  error_message: string | null;
  attempted_at: string;
  delivery: {
    resident_name: string;
    apartment: string;
    carrier: string | null;
  } | null;
};

export async function listNotificationAttempts(input: {
  condominiumId: string;
  limit?: number;
  status?: NotificationAttemptStatus | "all";
}) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("notification_attempts")
    .select(
      "id, delivery_id, channel, provider, status, target, error_message, attempted_at, deliveries!inner(resident_name, apartment, carrier, condominium_id)",
    )
    .eq("deliveries.condominium_id", input.condominiumId)
    .order("attempted_at", { ascending: false })
    .limit(input.limit ?? 20);

  if (input.status && input.status !== "all") {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Falha ao listar tentativas de notificacao: ${error.message}`);
  }

  return (data ?? []).map((attempt) => {
    const delivery = Array.isArray(attempt.deliveries) ? attempt.deliveries[0] : attempt.deliveries;

    return {
      id: attempt.id,
      delivery_id: attempt.delivery_id,
      channel: attempt.channel,
      provider: attempt.provider,
      status: attempt.status as NotificationAttemptStatus,
      target: attempt.target,
      error_message: attempt.error_message,
      attempted_at: attempt.attempted_at,
      delivery: delivery
        ? {
            resident_name: delivery.resident_name,
            apartment: delivery.apartment,
            carrier: delivery.carrier,
          }
        : null,
    };
  }) as NotificationAttemptRecord[];
}
