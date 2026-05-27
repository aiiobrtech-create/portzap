import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const deliveryStatuses = ["pending", "notified", "picked_up", "cancelled"] as const;

export type DeliveryStatus = (typeof deliveryStatuses)[number];

export type DeliveryRecord = {
  id: string;
  resident_name: string;
  resident_phone: string | null;
  apartment: string;
  carrier: string | null;
  description: string | null;
  package_photo_url: string | null;
  internal_notes: string | null;
  status: DeliveryStatus;
  created_at: string;
  received_at: string;
  notified_at: string | null;
  picked_up_at: string | null;
  cancelled_at: string | null;
};

export type DeliveryListFilters = {
  condominiumId?: string;
  query?: string;
  status?: DeliveryStatus | "all";
};

function extractPackagePhotoUrlFromNotes(internalNotes: string | null) {
  if (!internalNotes) {
    return null;
  }

  const match = internalNotes.match(/(?:^|\n)\s*Foto:\s*(https?:\/\/\S+)/i);

  return match?.[1] ?? null;
}

export function getDeliveryPackagePhotoUrl(delivery: Pick<DeliveryRecord, "package_photo_url" | "internal_notes">) {
  return delivery.package_photo_url ?? extractPackagePhotoUrlFromNotes(delivery.internal_notes);
}

export async function listRecentDeliveries(limit = 8, filters: DeliveryListFilters = {}) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("deliveries")
    .select(
      "id, resident_name, resident_phone, apartment, carrier, description, package_photo_url, internal_notes, status, created_at, received_at, notified_at, picked_up_at, cancelled_at",
    )
    .order("received_at", { ascending: false })
    .limit(limit);

  if (filters.condominiumId) {
    query = query.eq("condominium_id", filters.condominiumId);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.query) {
    const normalized = filters.query.trim();

    if (normalized) {
      query = query.or(
        [
          `resident_name.ilike.%${normalized}%`,
          `apartment.ilike.%${normalized}%`,
          `carrier.ilike.%${normalized}%`,
        ].join(","),
      );
    }
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Falha ao listar encomendas: ${error.message}`);
  }

  return (data ?? []) as DeliveryRecord[];
}

export async function getDeliveryMetrics(condominiumId?: string) {
  const deliveries = await listRecentDeliveries(100, { condominiumId });

  return {
    total: deliveries.length,
    pending: deliveries.filter((item) => item.status === "pending").length,
    notified: deliveries.filter((item) => item.status === "notified").length,
    pickedUp: deliveries.filter((item) => item.status === "picked_up").length,
    cancelled: deliveries.filter((item) => item.status === "cancelled").length,
  };
}
