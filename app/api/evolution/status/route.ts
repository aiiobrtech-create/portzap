import { NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ProviderStatus = "sent" | "delivered" | "read" | "failed";

function normalizePhone(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function findPhone(payload: Record<string, unknown>) {
  const candidates = [
    payload.remoteJid,
    payload.from,
    payload.to,
    payload.number,
    payload.phone,
    payload.sender,
    payload.recipient,
  ];

  for (const candidate of candidates) {
    const normalized = normalizePhone(candidate);

    if (normalized) {
      return normalized;
    }
  }

  const key = payload.key;

  if (key && typeof key === "object") {
    const normalized = normalizePhone((key as Record<string, unknown>).remoteJid);

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function mapProviderStatus(value: unknown): ProviderStatus | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.toLowerCase();

  if (["read", "read_ack", "played"].includes(normalized)) {
    return "read";
  }

  if (["delivered", "delivery_ack", "delivered_ack"].includes(normalized)) {
    return "delivered";
  }

  if (["sent", "server_ack", "pending"].includes(normalized)) {
    return "sent";
  }

  if (["failed", "error"].includes(normalized)) {
    return "failed";
  }

  return null;
}

function findStatus(payload: Record<string, unknown>) {
  const candidates = [
    payload.status,
    payload.messageStatus,
    payload.ack,
    payload.event,
    payload.type,
  ];

  for (const candidate of candidates) {
    const mapped = mapProviderStatus(candidate);

    if (mapped) {
      return mapped;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const configuredSecret = env.EVOLUTION_WEBHOOK_SECRET;

  if (configuredSecret) {
    const receivedSecret =
      request.headers.get("x-webhook-secret") ??
      request.headers.get("x-evolution-secret") ??
      request.nextUrl.searchParams.get("secret");

    if (receivedSecret !== configuredSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const payload = await request.json().catch(() => null);

  if (!payload || typeof payload !== "object") {
    return Response.json({ error: "Payload inválido" }, { status: 400 });
  }

  const root = payload as Record<string, unknown>;
  const data = root.data && typeof root.data === "object"
    ? (root.data as Record<string, unknown>)
    : root;
  const status = findStatus(data) ?? findStatus(root);
  const phone = findPhone(data) || findPhone(root);

  if (!status || !phone) {
    return Response.json({ ignored: true, reason: "status_ou_destino_ausente" });
  }

  const supabase = createSupabaseAdminClient();
  const { data: attempts, error } = await supabase
    .from("notification_attempts")
    .select("id")
    .eq("channel", "whatsapp")
    .eq("provider", "evolution")
    .ilike("target", `%${phone.slice(-11)}%`)
    .order("attempted_at", { ascending: false })
    .limit(1);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const attempt = attempts?.[0];

  if (!attempt) {
    return Response.json({ ignored: true, reason: "tentativa_nao_encontrada" });
  }

  const { error: updateError } = await supabase
    .from("notification_attempts")
    .update({
      status,
      response_payload: payload,
    })
    .eq("id", attempt.id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ ok: true, status });
}
