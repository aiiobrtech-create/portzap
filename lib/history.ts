import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DeliveryStatus } from "@/lib/deliveries";

export type HistoryStatusFilter = DeliveryStatus | "all";

export type DeliveryHistoryEvent = {
  id: string;
  delivery_id: string;
  from_status: DeliveryStatus | null;
  to_status: DeliveryStatus;
  change_reason: string | null;
  actor_label: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  delivery: {
    id: string;
    resident_name: string;
    apartment: string;
    carrier: string | null;
    status: DeliveryStatus;
  } | null;
};

type RawDelivery = {
  id: string;
  resident_name: string;
  apartment: string;
  carrier: string | null;
  status: DeliveryStatus;
  created_at: string;
  received_at: string;
};

export async function listDeliveryHistoryEvents(input: {
  condominiumId: string;
  limit?: number;
  status?: HistoryStatusFilter;
}) {
  const supabase = createSupabaseAdminClient();
  const limit = input.limit ?? 30;
  let query = supabase
    .from("delivery_status_history")
    .select(
      "id, delivery_id, from_status, to_status, change_reason, actor_label, metadata, created_at, deliveries!inner(id, resident_name, apartment, carrier, status, condominium_id)",
    )
    .eq("deliveries.condominium_id", input.condominiumId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.status && input.status !== "all") {
    query = query.eq("to_status", input.status);
  }

  const [{ data, error }, { data: deliveriesData, error: deliveriesError }] = await Promise.all([
    query,
    (() => {
      let deliveriesQuery = supabase
        .from("deliveries")
        .select("id, resident_name, apartment, carrier, status, created_at, received_at")
        .eq("condominium_id", input.condominiumId)
        .order("received_at", { ascending: false })
        .limit(limit);

      if (input.status && input.status !== "all") {
        deliveriesQuery = deliveriesQuery.eq("status", input.status);
      }

      return deliveriesQuery;
    })(),
  ]);

  if (error) {
    throw new Error(`Falha ao listar historico: ${error.message}`);
  }

  if (deliveriesError) {
    throw new Error(`Falha ao listar encomendas do historico: ${deliveriesError.message}`);
  }

  const events = (data ?? []).map((event) => {
    const delivery = Array.isArray(event.deliveries) ? event.deliveries[0] : event.deliveries;

    return {
      id: event.id,
      delivery_id: event.delivery_id,
      from_status: event.from_status as DeliveryStatus | null,
      to_status: event.to_status as DeliveryStatus,
      change_reason: event.change_reason,
      actor_label: event.actor_label,
      metadata:
        event.metadata && typeof event.metadata === "object"
          ? (event.metadata as Record<string, unknown>)
          : {},
      created_at: event.created_at,
      delivery: delivery
        ? {
            id: delivery.id,
            resident_name: delivery.resident_name,
            apartment: delivery.apartment,
            carrier: delivery.carrier,
            status: delivery.status as DeliveryStatus,
          }
        : null,
    };
  }) as DeliveryHistoryEvent[];

  const deliveries = (deliveriesData ?? []) as RawDelivery[];
  const deliveriesWithSnapshot = new Set(
    events
      .filter((event) => event.from_status === null || event.change_reason === "delivery_snapshot")
      .map((event) => event.delivery_id),
  );
  const snapshotEvents: DeliveryHistoryEvent[] = deliveries
    .filter((delivery) => !deliveriesWithSnapshot.has(delivery.id))
    .map((delivery) => ({
      id: `delivery-snapshot-${delivery.id}`,
      delivery_id: delivery.id,
      from_status: null,
      to_status: delivery.status,
      change_reason: "delivery_snapshot",
      actor_label: null,
      metadata: {},
      created_at: delivery.received_at ?? delivery.created_at,
      delivery: {
        id: delivery.id,
        resident_name: delivery.resident_name,
        apartment: delivery.apartment,
        carrier: delivery.carrier,
        status: delivery.status,
      },
    }));

  return [...events, ...snapshotEvents]
    .sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at))
    .slice(0, limit);
}
