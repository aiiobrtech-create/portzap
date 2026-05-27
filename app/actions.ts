"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppBaseUrl } from "@/lib/app-url";
import { EvolutionClient } from "@/lib/evolution/client";
import {
  buildOperatorLabel,
  requireAuthorizedCondominium,
  requireOperatorContext,
  setActiveCondominiumCookie,
} from "@/lib/operator-auth";
import { buildPickupLinkForDelivery, cancelActivePickupTokensForDelivery, consumePickupToken } from "@/lib/pickup-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deliveryStatuses, type DeliveryStatus } from "@/lib/deliveries";
import { sanitizeStoredPhone } from "@/lib/input-formatting";
import { buildPickupValidationUrl, buildQrImageUrl, extractPickupTokenFromInput } from "@/lib/pickups";

const createDeliverySchema = z.object({
  residentId: z.string().uuid("Morador invalido.").optional().or(z.literal("")),
  unitId: z.string().uuid("Unidade invalida.").optional().or(z.literal("")),
  linkResidentToUnit: z.boolean().default(false),
  residentName: z.string().trim().max(120).optional(),
  residentPhone: z.string().trim().max(20).optional(),
  packageRecipientName: z.string().trim().max(120).optional(),
  apartment: z.string().trim().max(20).optional(),
  carrier: z.string().trim().max(80).optional(),
  description: z.string().trim().max(240).optional(),
  internalNotes: z.string().trim().max(1000).optional(),
  status: z.enum(deliveryStatuses).default("pending"),
});

const updateDeliveryStatusSchema = z.object({
  id: z.string().uuid("Identificador de encomenda invalido."),
});

const createUnitSchema = z.object({
  condominiumId: z.string().uuid("Condominio invalido."),
  label: z.string().trim().min(1, "Informe a unidade.").max(20, "Use ate 20 caracteres na unidade."),
  block: z.string().trim().max(40).optional(),
  floor: z.string().trim().max(40).optional(),
});

const createUnitsBatchSchema = z.object({
  condominiumId: z.string().uuid("Condominio invalido."),
  towersCount: z.coerce.number().int().min(1, "Informe ao menos uma torre.").max(20, "Limite de 20 torres por lote."),
  floorsPerTower: z.coerce.number().int().min(1, "Informe ao menos um andar.").max(80, "Limite de 80 andares por torre."),
  unitsPerFloor: z.coerce.number().int().min(1, "Informe ao menos uma unidade por andar.").max(30, "Limite de 30 unidades por andar."),
  floorStart: z.coerce.number().int().min(0, "Andar inicial invalido.").max(200, "Andar inicial muito alto."),
  towerNaming: z.enum(["letters", "numbers"]).default("letters"),
  towerPrefix: z.string().trim().max(20).optional(),
  unitPattern: z.enum(["compact-floor-unit", "floor-sequence", "padded-floor-sequence"]).default("compact-floor-unit"),
});

const createResidentSchema = z.object({
  condominiumId: z.string().uuid("Condominio invalido."),
  fullName: z.string().trim().min(3, "Informe o nome do morador.").max(120, "Use ate 120 caracteres."),
  phone: z.string().trim().max(20).optional(),
  email: z.email("Informe um e-mail valido.").optional().or(z.literal("")),
  unitId: z.string().uuid("Selecione uma unidade."),
});

const updateUnitSchema = z.object({
  condominiumId: z.string().uuid("Condominio invalido."),
  id: z.string().uuid("Unidade invalida."),
  label: z.string().trim().min(1, "Informe a unidade.").max(20, "Use ate 20 caracteres na unidade."),
  block: z.string().trim().max(40).optional(),
  floor: z.string().trim().max(40).optional(),
});

const updateResidentSchema = z.object({
  condominiumId: z.string().uuid("Condominio invalido."),
  id: z.string().uuid("Morador invalido."),
  fullName: z.string().trim().min(3, "Informe o nome do morador.").max(120, "Use ate 120 caracteres."),
  phone: z.string().trim().max(20).optional(),
  email: z.email("Informe um e-mail valido.").optional().or(z.literal("")),
  unitId: z.string().uuid("Selecione uma unidade."),
});

const toggleActiveSchema = z.object({
  condominiumId: z.string().uuid("Condominio invalido."),
  id: z.string().uuid("Registro invalido."),
  nextState: z.enum(["true", "false"]),
});

const createCondominiumSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome do condominio.").max(120, "Use ate 120 caracteres."),
  slug: z
    .string()
    .trim()
    .min(3, "Informe o identificador.")
    .max(80, "Use ate 80 caracteres no slug.")
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minusculas, numeros e hifens."),
  contactPhone: z.string().trim().max(20).optional(),
});

const validatePickupTokenSchema = z.object({
  token: z.string().trim().min(1, "Informe o QR ou o código de retirada."),
});

type NotificationPayload = {
  normalizedPhone: string;
  message: string;
  response: unknown;
  deliveryMode?: "image" | "text";
  fallbackError?: string;
};

type NotificationChannel = "whatsapp";
type NotificationAttemptStatus = "pending" | "sent" | "delivered" | "read" | "failed";
export type DeliveryFormValues = {
  residentId: string;
  unitId: string;
  linkResidentToUnit: boolean;
  residentName: string;
  residentPhone: string;
  packageRecipientName: string;
  apartment: string;
  carrier: string;
  description: string;
  internalNotes: string;
  status: DeliveryStatus;
};

export type DeliveryActionState = {
  tone: "idle" | "error";
  message: string;
  values?: DeliveryFormValues;
  formKey?: string;
};

const maxDeliveryPhotoBytes = 5 * 1024 * 1024;
const deliveryPhotosBucketName = process.env.SUPABASE_DELIVERY_PHOTOS_BUCKET?.trim() || "delivery-photos";
let deliveryPhotosBucketReady: Promise<void> | null = null;

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getDeliveryFormValues(formData: FormData): DeliveryFormValues {
  const status = getFormString(formData, "status");

  return {
    residentId: getFormString(formData, "residentId"),
    unitId: getFormString(formData, "unitId"),
    linkResidentToUnit: formData.get("linkResidentToUnit") === "on",
    residentName: getFormString(formData, "residentName"),
    residentPhone: getFormString(formData, "residentPhone"),
    packageRecipientName: getFormString(formData, "packageRecipientName"),
    apartment: getFormString(formData, "apartment"),
    carrier: getFormString(formData, "carrier"),
    description: getFormString(formData, "description"),
    internalNotes: getFormString(formData, "internalNotes"),
    status: deliveryStatuses.includes(status as DeliveryStatus) ? (status as DeliveryStatus) : "pending",
  };
}

function buildHomeRedirect(input: {
  path?: string;
  condominiumId?: string;
  tone: "success" | "error";
  message: string;
}) {
  const params = new URLSearchParams({
    tone: input.tone,
    message: input.message,
  });

  if (input.condominiumId) {
    params.set("condominiumId", input.condominiumId);
  }

  return `${input.path ?? "/"}?${params.toString()}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Falha inesperada na operacao.";
}

function isStorageNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    message?: string;
    status?: number;
    statusCode?: string;
  };

  return (
    candidate.status === 404 ||
    candidate.statusCode === "404" ||
    /bucket not found|not found/i.test(candidate.message ?? "")
  );
}

function isStorageConflictError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    message?: string;
    status?: number;
    statusCode?: string;
  };

  return (
    candidate.status === 409 ||
    candidate.statusCode === "409" ||
    /already exists|conflict/i.test(candidate.message ?? "")
  );
}

async function ensureDeliveryPhotosBucket() {
  if (!deliveryPhotosBucketReady) {
    deliveryPhotosBucketReady = (async () => {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.storage.getBucket(deliveryPhotosBucketName);

      if (!error) {
        return;
      }

      if (!isStorageNotFoundError(error)) {
        throw new Error(`Falha ao verificar bucket de fotos "${deliveryPhotosBucketName}": ${error.message}`);
      }

      const { error: createError } = await supabase.storage.createBucket(deliveryPhotosBucketName, {
        public: true,
        fileSizeLimit: maxDeliveryPhotoBytes,
        allowedMimeTypes: ["image/*"],
      });

      if (createError && !isStorageConflictError(createError)) {
        throw new Error(
          `Falha ao criar bucket de fotos "${deliveryPhotosBucketName}": ${createError.message}`,
        );
      }
    })().catch((error) => {
      deliveryPhotosBucketReady = null;
      throw error;
    });
  }

  await deliveryPhotosBucketReady;
}

function getTowerToken(index: number, naming: "letters" | "numbers") {
  if (naming === "numbers") {
    return String(index + 1);
  }

  let current = index;
  let token = "";

  do {
    token = String.fromCharCode(65 + (current % 26)) + token;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return token;
}

function buildUnitLabel(input: {
  towerToken: string;
  towerCount: number;
  floorNumber: number;
  unitIndex: number;
  pattern: "compact-floor-unit" | "floor-sequence" | "padded-floor-sequence";
}) {
  const apartmentNumber = String(input.unitIndex + 1);
  const apartmentSuffix =
    input.pattern === "compact-floor-unit" ? apartmentNumber : apartmentNumber.padStart(2, "0");
  const floorToken =
    input.pattern === "padded-floor-sequence"
      ? String(input.floorNumber).padStart(2, "0")
      : String(input.floorNumber);
  const unitNumber = `${floorToken}${apartmentSuffix}`;

  return input.towerCount > 1 ? `${input.towerToken}-${unitNumber}` : unitNumber;
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 11) {
    return `55${digits}`;
  }

  if (digits.length === 13 && digits.startsWith("55")) {
    return digits;
  }

  throw new Error("Telefone invalido. Use DDD + numero do morador.");
}

function buildNotificationMessage(input: {
  residentName: string;
  apartment: string;
  carrier?: string;
  description?: string;
  packagePhotoUrl?: string | null;
  qrImageUrl?: string | null;
  pickupCode?: string | null;
}) {
  const detail = input.description ? ` Item: ${input.description}.` : "";
  const carrier = input.carrier ? ` Transportadora: ${input.carrier}.` : "";
  const packagePhoto = input.packagePhotoUrl ? " Foto da encomenda anexada." : "";
  const qrPhoto = input.qrImageUrl ? " QR da retirada anexado." : "";
  const code = input.pickupCode ? ` Código manual: ${input.pickupCode}.` : "";

  return [
    `Ola, ${input.residentName}.`,
    `Sua encomenda chegou na portaria da unidade ${input.apartment}.`,
    carrier,
    detail,
    packagePhoto,
    qrPhoto,
    code,
    "Retire quando for conveniente.",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function notifyResident(input: {
  residentName: string;
  residentPhone: string;
  apartment: string;
  carrier?: string;
  description?: string;
  packagePhotoUrl?: string | null;
  qrImageUrl?: string | null;
  pickupCode?: string | null;
}) {
  const normalizedPhone = normalizePhone(input.residentPhone);
  const message = buildNotificationMessage(input);
  const evolution = new EvolutionClient();
  const responses: Array<{ kind: string; response: unknown }> = [];
  const errors: string[] = [];

  const sendMedia = async (kind: string, imageUrl: string, caption: string) => {
    try {
      const response = await evolution.sendImage({
        phone: normalizedPhone,
        imageUrl,
        caption,
      });
      responses.push({ kind, response });
    } catch (imageError) {
      errors.push(imageError instanceof Error ? imageError.message : `Falha inesperada ao enviar ${kind}.`);
    }
  };

  if (input.packagePhotoUrl) {
    await sendMedia("foto da encomenda", input.packagePhotoUrl, message);
  }

  if (input.qrImageUrl) {
    await sendMedia(
      "qr da retirada",
      input.qrImageUrl,
      input.packagePhotoUrl ? "QR de retirada." : message,
    );
  }

  if (responses.length === 0) {
    const response = await evolution.sendText({
      phone: normalizedPhone,
      message,
    });

    return {
      normalizedPhone,
      message,
      response,
      deliveryMode: "text",
      fallbackError: errors[0] ?? undefined,
    } satisfies NotificationPayload;
  }

  return {
    normalizedPhone,
    message,
    response:
      responses.length === 1
        ? responses[0].response
        : {
            messages: responses,
          },
    deliveryMode: "image",
    fallbackError: errors[0] ?? undefined,
  } satisfies NotificationPayload;
}

function extractPackagePhotoUrlFromNotes(internalNotes?: string | null) {
  if (!internalNotes) {
    return null;
  }

  const match = internalNotes.match(/(?:^|\n)\s*Foto:\s*(https?:\/\/\S+)/i);

  return match?.[1] ?? null;
}

async function createStatusHistoryEntry(input: {
  deliveryId: string;
  fromStatus: DeliveryStatus | null;
  toStatus: DeliveryStatus;
  changeReason: string;
  actorLabel: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("delivery_status_history").insert({
    delivery_id: input.deliveryId,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    change_reason: input.changeReason,
    actor_label: input.actorLabel,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(`Falha ao registrar historico da encomenda: ${error.message}`);
  }
}

async function createNotificationAttemptEntry(input: {
  deliveryId: string;
  target: string;
  channel?: NotificationChannel;
  provider?: string;
  status: NotificationAttemptStatus;
  requestPayload: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  errorMessage?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("notification_attempts").insert({
    delivery_id: input.deliveryId,
    channel: input.channel ?? "whatsapp",
    provider: input.provider ?? "evolution",
    target: input.target,
    status: input.status,
    request_payload: input.requestPayload,
    response_payload: input.responsePayload ?? {},
    error_message: input.errorMessage ?? null,
  });

  if (error) {
    throw new Error(`Falha ao registrar tentativa de notificacao: ${error.message}`);
  }
}

function canTransitionStatus(currentStatus: DeliveryStatus, nextStatus: Exclude<DeliveryStatus, "pending">) {
  if (currentStatus === nextStatus) {
    return true;
  }

  if (currentStatus === "picked_up" || currentStatus === "cancelled") {
    return false;
  }

  if (currentStatus === "pending") {
    return true;
  }

  return nextStatus === "picked_up" || nextStatus === "cancelled";
}

async function transitionDeliveryStatus(input: {
  deliveryId: string;
  condominiumId?: string;
  currentStatus: DeliveryStatus;
  nextStatus: Exclude<DeliveryStatus, "pending">;
  actorLabel: string;
  metadata?: Record<string, unknown>;
}) {
  if (input.currentStatus === input.nextStatus) {
    return;
  }

  if (!canTransitionStatus(input.currentStatus, input.nextStatus)) {
    throw new Error(
      `Transicao invalida de status: ${input.currentStatus} -> ${input.nextStatus}.`,
    );
  }

  const now = new Date().toISOString();
  const supabase = createSupabaseAdminClient();
  const updatePayload: {
    status: Exclude<DeliveryStatus, "pending">;
    notified_at?: string;
    picked_up_at?: string;
    cancelled_at?: string;
  } = {
    status: input.nextStatus,
  };

  if (input.nextStatus === "notified") {
    updatePayload.notified_at = now;
  }

  if (input.nextStatus === "picked_up") {
    updatePayload.picked_up_at = now;
  }

  if (input.nextStatus === "cancelled") {
    updatePayload.cancelled_at = now;
  }

  let query = supabase
    .from("deliveries")
    .update(updatePayload)
    .eq("id", input.deliveryId);

  if (input.condominiumId) {
    query = query.eq("condominium_id", input.condominiumId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Falha ao atualizar encomenda: ${error.message}`);
  }

  await createStatusHistoryEntry({
    deliveryId: input.deliveryId,
    fromStatus: input.currentStatus,
    toStatus: input.nextStatus,
    changeReason: "manual_status_update",
    actorLabel: input.actorLabel,
    metadata: input.metadata,
  });
}

async function uploadDeliveryPhoto(input: {
  condominiumId: string;
  deliveryId: string;
  file: File;
  purpose?: "package" | "pickup";
}) {
  if (!input.file || input.file.size === 0) {
    return null;
  }

  if (!input.file.type.startsWith("image/")) {
    throw new Error("Envie uma foto em formato de imagem.");
  }

  if (input.file.size > maxDeliveryPhotoBytes) {
    throw new Error("A foto ainda está muito pesada. Selecione uma imagem com até 5 MB.");
  }

  const fileExtension = input.file.name.includes(".")
    ? input.file.name.split(".").pop()?.toLowerCase() ?? "jpg"
    : "jpg";
  const filePurpose = input.purpose ?? "package";
  const filePath = `${input.condominiumId}/${input.deliveryId}-${filePurpose}-${crypto.randomUUID()}.${fileExtension}`;
  const supabase = createSupabaseAdminClient();
  await ensureDeliveryPhotosBucket();
  const fileBytes = Buffer.from(await input.file.arrayBuffer());
  const { error } = await supabase.storage
    .from(deliveryPhotosBucketName)
    .upload(filePath, fileBytes, {
      cacheControl: "3600",
      contentType: input.file.type || "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw new Error(`Falha ao enviar foto da encomenda: ${error.message}`);
  }

  const { data } = supabase.storage.from(deliveryPhotosBucketName).getPublicUrl(filePath);

  return data.publicUrl;
}

async function appendInternalDeliveryNote(input: {
  deliveryId: string;
  condominiumId: string;
  note: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("deliveries")
    .select("internal_notes")
    .eq("id", input.deliveryId)
    .eq("condominium_id", input.condominiumId)
    .single();

  if (error || !data) {
    throw new Error(`Falha ao localizar observações da encomenda: ${error?.message ?? "nao encontrada"}`);
  }

  const nextNotes = [data.internal_notes, input.note].filter(Boolean).join("\n");
  const { error: updateError } = await supabase
    .from("deliveries")
    .update({ internal_notes: nextNotes })
    .eq("id", input.deliveryId)
    .eq("condominium_id", input.condominiumId);

  if (updateError) {
    throw new Error(`Falha ao registrar evidência da encomenda: ${updateError.message}`);
  }
}

async function uploadPickupProofPhoto(input: {
  formData: FormData;
  condominiumId: string;
  deliveryId: string;
}) {
  const proofFile = input.formData.get("pickupPhoto");

  if (!(proofFile instanceof File) || proofFile.size === 0) {
    return null;
  }

  const photoUrl = await uploadDeliveryPhoto({
    condominiumId: input.condominiumId,
    deliveryId: input.deliveryId,
    file: proofFile,
    purpose: "pickup",
  });

  if (photoUrl) {
    await appendInternalDeliveryNote({
      deliveryId: input.deliveryId,
      condominiumId: input.condominiumId,
      note: `Foto retirada: ${photoUrl}`,
    });
  }

  return photoUrl;
}

export async function createDelivery(_prevState: DeliveryActionState, formData: FormData) {
  const submittedValues = getDeliveryFormValues(formData);
  const condominiumId =
    typeof formData.get("condominiumId") === "string"
      ? String(formData.get("condominiumId"))
      : undefined;
  const redirectPath =
    typeof formData.get("redirectPath") === "string"
      ? String(formData.get("redirectPath"))
      : "/";

  try {
    const parsed = createDeliverySchema.parse({
      residentId: formData.get("residentId") || undefined,
      unitId: formData.get("unitId") || undefined,
      linkResidentToUnit: formData.get("linkResidentToUnit") === "on",
      residentName: formData.get("residentName"),
      residentPhone: formData.get("residentPhone"),
      packageRecipientName: formData.get("packageRecipientName"),
      apartment: formData.get("apartment"),
      carrier: formData.get("carrier") || undefined,
      description: formData.get("description") || undefined,
      internalNotes: formData.get("internalNotes") || undefined,
      status: formData.get("status") || "pending",
    });

    if (parsed.status === "picked_up") {
      throw new Error("A encomenda só pode ser marcada como retirada após leitura do QR ou código do morador.");
    }

    const { user, activeCondominium } = await requireAuthorizedCondominium(condominiumId);
    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const initialStatus = parsed.status === "notified" ? "pending" : parsed.status;
    const actorLabel = buildOperatorLabel(user);

    let resolvedResidentId: string | null = parsed.residentId || null;
    let resolvedUnitId: string | null = parsed.unitId || null;
    let resolvedResidentName = parsed.residentName?.trim() ?? "";
    let resolvedResidentPhone = parsed.residentPhone?.trim() ?? "";
    let resolvedApartment = parsed.apartment?.trim() ?? "";
    let notificationResidentName = resolvedResidentName;

    if (resolvedResidentId && parsed.linkResidentToUnit) {
      const { data: resident, error: residentError } = await supabase
        .from("residents")
        .select("id, full_name, phone, email, unit_id, units(label)")
        .eq("id", resolvedResidentId)
        .eq("condominium_id", activeCondominium.id)
        .single();

      if (residentError || !resident) {
        throw new Error(`Falha ao localizar morador: ${residentError?.message ?? "nao encontrado"}`);
      }

      const residentRecord = resident as {
        id: string;
        full_name: string;
        phone: string | null;
        email: string | null;
        unit_id: string | null;
        units: { label: string } | Array<{ label: string }> | null;
      };
      const residentUnitLabel = Array.isArray(residentRecord.units)
        ? residentRecord.units[0]?.label
        : residentRecord.units?.label;

      if (!resolvedResidentName) {
        resolvedResidentName = residentRecord.full_name;
      }
      notificationResidentName = residentRecord.full_name;
      resolvedResidentPhone = residentRecord.phone?.trim() ?? resolvedResidentPhone;
      if (parsed.unitId && residentRecord.unit_id && parsed.unitId !== residentRecord.unit_id) {
        throw new Error("O morador selecionado pertence a outra unidade.");
      }

      resolvedUnitId = residentRecord.unit_id ?? resolvedUnitId;
      resolvedApartment = residentUnitLabel ?? resolvedApartment;
    }

    if (resolvedUnitId) {
      const { data: unit, error: unitError } = await supabase
        .from("units")
        .select("id, label")
        .eq("id", resolvedUnitId)
        .eq("condominium_id", activeCondominium.id)
        .single();

      if (unitError || !unit) {
        throw new Error(`Falha ao localizar unidade: ${unitError?.message ?? "nao encontrada"}`);
      }

      if (!resolvedApartment) {
        resolvedApartment = unit.label;
      }
    }

    if (!resolvedResidentId && parsed.linkResidentToUnit && resolvedUnitId) {
      if (!resolvedResidentName || resolvedResidentName.length < 3) {
        throw new Error("Informe o nome do morador para vincular a unidade.");
      }

      if (!resolvedResidentPhone) {
        throw new Error("Informe o WhatsApp do morador para vincular a unidade.");
      }

      const storedResidentPhone = sanitizeStoredPhone(resolvedResidentPhone, { mobileOnly: true });
      const { data: createdResident, error: createResidentError } = await supabase
        .from("residents")
        .insert({
          condominium_id: activeCondominium.id,
          unit_id: resolvedUnitId,
          full_name: resolvedResidentName,
          phone: storedResidentPhone,
          email: null,
        })
        .select("id, full_name, phone")
        .single();

      if (createResidentError || !createdResident) {
        throw new Error(`Falha ao vincular morador a unidade: ${createResidentError?.message ?? "nao criado"}`);
      }

      resolvedResidentId = createdResident.id;
      resolvedResidentPhone = createdResident.phone?.trim() ?? storedResidentPhone;
      notificationResidentName = createdResident.full_name;
    }

    const resolvedPackageRecipientName = parsed.packageRecipientName?.trim() || resolvedResidentName;

    if (!resolvedPackageRecipientName || resolvedPackageRecipientName.length < 3) {
      throw new Error("Informe o nome no pacote/remetente.");
    }

    if (!notificationResidentName) {
      notificationResidentName = resolvedPackageRecipientName;
    }

    if (!resolvedApartment) {
      throw new Error("Informe a unidade ou selecione um morador/unidade cadastrados.");
    }

    if (resolvedResidentPhone) {
      resolvedResidentPhone = sanitizeStoredPhone(resolvedResidentPhone, { mobileOnly: true });
    }

    if (!resolvedResidentPhone) {
      throw new Error("Informe o telefone do morador ou mantenha um cadastro com telefone.");
    }

    const photoFile = formData.get("photo");
    let qrImageUrl: string | null = null;
    let packagePhotoUrl: string | null = null;
    let pickupCode: string | null = null;
    const { data, error } = await supabase
      .from("deliveries")
      .insert({
        condominium_id: activeCondominium.id,
        unit_id: parsed.linkResidentToUnit ? resolvedUnitId : null,
        resident_id: parsed.linkResidentToUnit ? resolvedResidentId : null,
        resident_name: resolvedPackageRecipientName,
        resident_phone: resolvedResidentPhone,
        apartment: resolvedApartment,
        carrier: parsed.carrier || null,
        description: parsed.description || null,
        internal_notes: parsed.internalNotes || null,
        source: "manual",
        status: initialStatus,
        received_at: now,
        notified_at: null,
        picked_up_at: null,
        cancelled_at: parsed.status === "cancelled" ? now : null,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Falha ao cadastrar encomenda: ${error.message}`);
    }

    if (photoFile instanceof File && photoFile.size > 0) {
      packagePhotoUrl = await uploadDeliveryPhoto({
        condominiumId: activeCondominium.id,
        deliveryId: data.id,
        file: photoFile,
        purpose: "package",
      });

      if (packagePhotoUrl) {
        const notesWithPhoto = [parsed.internalNotes?.trim(), `Foto: ${packagePhotoUrl}`]
          .filter(Boolean)
          .join("\n");
        const { error: photoUpdateError } = await supabase
          .from("deliveries")
          .update({
            package_photo_url: packagePhotoUrl,
            internal_notes: notesWithPhoto,
          })
          .eq("id", data.id)
          .eq("condominium_id", activeCondominium.id);

        if (photoUpdateError) {
          throw new Error(`Falha ao vincular foto na encomenda: ${photoUpdateError.message}`);
        }
      }
    }

    await createStatusHistoryEntry({
      deliveryId: data.id,
      fromStatus: null,
      toStatus: initialStatus,
      changeReason: "manual_delivery_created",
      actorLabel,
    });

    if (parsed.status === "notified") {
      try {
        const baseUrl = await getAppBaseUrl();
        const pickupLink = await buildPickupLinkForDelivery({
          deliveryId: data.id,
          condominiumId: activeCondominium.id,
          createdBy: user.id,
          baseUrl,
        });
        pickupCode = pickupLink.tokenValue;
        qrImageUrl = buildQrImageUrl(buildPickupValidationUrl(baseUrl, pickupLink.tokenValue));

        const notification = await notifyResident({
          residentName: notificationResidentName,
          residentPhone: resolvedResidentPhone,
          apartment: resolvedApartment,
          carrier: parsed.carrier,
          description: parsed.description,
          packagePhotoUrl,
          qrImageUrl,
          pickupCode,
        });

        await createNotificationAttemptEntry({
          deliveryId: data.id,
          target: notification.normalizedPhone,
          status: "sent",
          requestPayload: {
            phone: notification.normalizedPhone,
            message: notification.message,
            packagePhotoUrl,
            qrImageUrl,
            pickupCode,
            deliveryMode: notification.deliveryMode ?? "text",
            fallbackError: notification.fallbackError ?? null,
          },
          responsePayload:
            notification.response && typeof notification.response === "object"
              ? (notification.response as Record<string, unknown>)
              : { raw: notification.response },
        });

        await transitionDeliveryStatus({
          deliveryId: data.id,
          condominiumId: activeCondominium.id,
          currentStatus: "pending",
          nextStatus: "notified",
          actorLabel,
          metadata: {
            pickupTokenExpiresAt: pickupLink.expiresAt,
          },
        });

        await createStatusHistoryEntry({
          deliveryId: data.id,
          fromStatus: "notified",
          toStatus: "notified",
          changeReason: "pickup_qr_generated",
          actorLabel,
          metadata: {
            expiresAt: pickupLink.expiresAt,
          },
        });
      } catch (notifyError) {
        await cancelActivePickupTokensForDelivery(data.id, activeCondominium.id);
        await createNotificationAttemptEntry({
          deliveryId: data.id,
          target: resolvedResidentPhone,
          status: "failed",
          requestPayload: {
            phone: resolvedResidentPhone,
            message: buildNotificationMessage({
              residentName: resolvedResidentName,
              apartment: resolvedApartment,
              carrier: parsed.carrier,
              description: parsed.description,
              packagePhotoUrl,
              qrImageUrl,
              pickupCode,
            }),
            packagePhotoUrl,
            qrImageUrl,
            pickupCode,
          },
          errorMessage:
            notifyError instanceof Error
              ? notifyError.message
              : "Falha inesperada ao notificar morador.",
        });

        throw notifyError;
      }
    }

    revalidatePath("/");
    revalidatePath("/historico");
  } catch (error) {
    return {
      tone: "error" as const,
      message: getErrorMessage(error),
      values: submittedValues,
      formKey: crypto.randomUUID(),
    };
  }

  redirect(
    buildHomeRedirect({
      path: redirectPath,
      tone: "success",
      condominiumId,
      message: "Encomenda cadastrada com sucesso.",
    }),
  );
}

export async function markDeliveryNotified(formData: FormData) {
  const condominiumId = String(formData.get("condominiumId") ?? "");

  try {
    const parsed = updateDeliveryStatusSchema.parse({
      id: formData.get("id"),
    });

    const { user, activeCondominium } = await requireAuthorizedCondominium(condominiumId);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("deliveries")
      .select(
        "id, resident_name, resident_phone, apartment, carrier, description, status, internal_notes, package_photo_url",
      )
      .eq("id", parsed.id)
      .eq("condominium_id", activeCondominium.id)
      .single();

    if (error || !data) {
      throw new Error(`Falha ao localizar encomenda: ${error?.message ?? "nao encontrada"}`);
    }

    if (!data.resident_phone) {
      throw new Error("Nao foi possivel avisar: telefone do morador ausente.");
    }

    if (data.status !== "pending") {
      revalidatePath("/");
      redirect(
        buildHomeRedirect({
          tone: "success",
          condominiumId,
          message: "A encomenda ja estava fora do estado pendente.",
        }),
      );
    }

    let pickupLink: Awaited<ReturnType<typeof buildPickupLinkForDelivery>> | null = null;
    let qrImageUrl: string | null = null;
    const packagePhotoUrl = data.package_photo_url ?? extractPackagePhotoUrlFromNotes(data.internal_notes);
    let pickupCode: string | null = null;

    try {
      const baseUrl = await getAppBaseUrl();
      pickupLink = await buildPickupLinkForDelivery({
        deliveryId: parsed.id,
        condominiumId: activeCondominium.id,
        createdBy: user.id,
        baseUrl,
      });
      pickupCode = pickupLink.tokenValue;
      qrImageUrl = buildQrImageUrl(buildPickupValidationUrl(baseUrl, pickupLink.tokenValue));

      const notification = await notifyResident({
        residentName: data.resident_name,
        residentPhone: data.resident_phone,
        apartment: data.apartment,
        carrier: data.carrier ?? undefined,
        description: data.description ?? undefined,
        packagePhotoUrl,
        qrImageUrl,
        pickupCode,
      });

      await createNotificationAttemptEntry({
        deliveryId: parsed.id,
        target: notification.normalizedPhone,
        status: "sent",
        requestPayload: {
          phone: notification.normalizedPhone,
          message: notification.message,
          packagePhotoUrl,
          qrImageUrl,
          pickupCode,
        },
        responsePayload:
          notification.response && typeof notification.response === "object"
            ? (notification.response as Record<string, unknown>)
            : { raw: notification.response },
      });
    } catch (notifyError) {
      await cancelActivePickupTokensForDelivery(parsed.id, activeCondominium.id);
      await createNotificationAttemptEntry({
        deliveryId: parsed.id,
        target: data.resident_phone,
        status: "failed",
        requestPayload: {
          phone: data.resident_phone,
          message: buildNotificationMessage({
            residentName: data.resident_name,
            apartment: data.apartment,
            carrier: data.carrier ?? undefined,
            description: data.description ?? undefined,
            packagePhotoUrl,
            qrImageUrl: null,
            pickupCode,
          }),
          packagePhotoUrl,
          pickupCode,
        },
        errorMessage:
          notifyError instanceof Error
            ? notifyError.message
            : "Falha inesperada ao notificar morador.",
      });

      throw notifyError;
    }

    await transitionDeliveryStatus({
      deliveryId: parsed.id,
      condominiumId: activeCondominium.id,
      currentStatus: "pending",
      nextStatus: "notified",
      actorLabel: buildOperatorLabel(user),
    });

    await createStatusHistoryEntry({
      deliveryId: parsed.id,
      fromStatus: "notified",
      toStatus: "notified",
      changeReason: "pickup_qr_generated",
      actorLabel: buildOperatorLabel(user),
      metadata: {
        expiresAt: pickupLink?.expiresAt ?? null,
      },
    });

    revalidatePath("/");
    revalidatePath("/historico");
    revalidatePath("/retirada");
  } catch (error) {
    redirect(
      buildHomeRedirect({
        tone: "error",
        condominiumId,
        message: getErrorMessage(error),
      }),
    );
  }

  redirect(
    buildHomeRedirect({
      tone: "success",
      condominiumId,
      message: "Morador avisado com sucesso.",
    }),
  );
}

export async function markDeliveryPickedUp(formData: FormData) {
  const condominiumId = String(formData.get("condominiumId") ?? "");

  redirect(
    buildHomeRedirect({
      tone: "error",
      condominiumId,
      message: "A retirada só pode ser registrada pela leitura do QR ou digitação do código do morador.",
    }),
  );
}

export async function markDeliveryCancelled(formData: FormData) {
  const condominiumId = String(formData.get("condominiumId") ?? "");

  try {
    const parsed = updateDeliveryStatusSchema.parse({
      id: formData.get("id"),
    });

    const { user, activeCondominium } = await requireAuthorizedCondominium(condominiumId);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("deliveries")
      .select("id, status")
      .eq("id", parsed.id)
      .eq("condominium_id", activeCondominium.id)
      .single();

    if (error || !data) {
      throw new Error(`Falha ao localizar encomenda: ${error?.message ?? "nao encontrada"}`);
    }

    if (data.status === "cancelled") {
      revalidatePath("/");
      redirect(
        buildHomeRedirect({
          tone: "success",
          condominiumId,
          message: "A encomenda ja estava cancelada.",
        }),
      );
    }

    await transitionDeliveryStatus({
      deliveryId: parsed.id,
      condominiumId: activeCondominium.id,
      currentStatus: data.status as DeliveryStatus,
      nextStatus: "cancelled",
      actorLabel: buildOperatorLabel(user),
    });

    await cancelActivePickupTokensForDelivery(parsed.id, activeCondominium.id);

    revalidatePath("/");
    revalidatePath("/retirada");
  } catch (error) {
    redirect(
      buildHomeRedirect({
        tone: "error",
        condominiumId,
        message: getErrorMessage(error),
      }),
    );
  }

  redirect(
    buildHomeRedirect({
      tone: "success",
      condominiumId,
      message: "Registro cancelado com sucesso.",
    }),
  );
}

export async function markUnitDeliveriesPickedUp(formData: FormData) {
  const condominiumId = String(formData.get("condominiumId") ?? "");

  redirect(
    buildHomeRedirect({
      path: "/retirada",
      tone: "error",
      condominiumId,
      message: "Retirada agrupada manual bloqueada. Valide cada retirada pelo QR ou código do morador.",
    }),
  );
}

export async function createUnit(formData: FormData) {
  const condominiumId =
    typeof formData.get("condominiumId") === "string"
      ? String(formData.get("condominiumId"))
      : undefined;

  try {
    const parsed = createUnitSchema.parse({
      condominiumId: formData.get("condominiumId"),
      label: formData.get("label"),
      block: formData.get("block") || undefined,
      floor: formData.get("floor") || undefined,
    });

    await requireAuthorizedCondominium(parsed.condominiumId);
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("units").insert({
      condominium_id: parsed.condominiumId,
      label: parsed.label,
      block: parsed.block || null,
      floor: parsed.floor || null,
    });

    if (error) {
      throw new Error(`Falha ao cadastrar unidade: ${error.message}`);
    }

    revalidatePath("/moradores");
  } catch (error) {
    redirect(
      buildHomeRedirect({
        path: "/moradores",
        tone: "error",
        condominiumId,
        message: getErrorMessage(error),
      }),
    );
  }

  redirect(
    buildHomeRedirect({
      path: "/moradores",
      tone: "success",
      condominiumId,
      message: "Unidade cadastrada com sucesso.",
    }),
  );
}

export async function createUnitsBatch(formData: FormData) {
  const condominiumId =
    typeof formData.get("condominiumId") === "string"
      ? String(formData.get("condominiumId"))
      : undefined;

  try {
    const parsed = createUnitsBatchSchema.parse({
      condominiumId: formData.get("condominiumId"),
      towersCount: formData.get("towersCount"),
      floorsPerTower: formData.get("floorsPerTower"),
      unitsPerFloor: formData.get("unitsPerFloor"),
      floorStart: formData.get("floorStart") || 1,
      towerNaming: formData.get("towerNaming") || "letters",
      towerPrefix: formData.get("towerPrefix") || undefined,
      unitPattern: formData.get("unitPattern") || "compact-floor-unit",
    });

    await requireAuthorizedCondominium(parsed.condominiumId);
    const totalUnits =
      parsed.towersCount * parsed.floorsPerTower * parsed.unitsPerFloor;

    if (totalUnits > 5000) {
      throw new Error("O lote ficou grande demais. Gere no maximo 5000 unidades por vez.");
    }

    const towerPrefix = parsed.towerPrefix?.trim() || "Torre";
    const unitRows = [];

    for (let towerIndex = 0; towerIndex < parsed.towersCount; towerIndex += 1) {
      const towerToken = getTowerToken(towerIndex, parsed.towerNaming);
      const blockLabel = parsed.towersCount > 1 ? `${towerPrefix} ${towerToken}` : null;

      for (let floorOffset = 0; floorOffset < parsed.floorsPerTower; floorOffset += 1) {
        const floorNumber = parsed.floorStart + floorOffset;

        for (let unitIndex = 0; unitIndex < parsed.unitsPerFloor; unitIndex += 1) {
          unitRows.push({
            condominium_id: parsed.condominiumId,
            label: buildUnitLabel({
              towerToken,
              towerCount: parsed.towersCount,
              floorNumber,
              unitIndex,
              pattern: parsed.unitPattern,
            }),
            block: blockLabel,
            floor: String(floorNumber),
          });
        }
      }
    }

    const supabase = createSupabaseAdminClient();
    const labels = unitRows.map((item) => item.label);
    const { data: existing, error: existingError } = await supabase
      .from("units")
      .select("label")
      .eq("condominium_id", parsed.condominiumId)
      .in("label", labels);

    if (existingError) {
      throw new Error(`Falha ao verificar unidades existentes: ${existingError.message}`);
    }

    if ((existing?.length ?? 0) > 0) {
      throw new Error(
        `Ja existem unidades nesse padrao. Exemplo duplicado: ${existing?.[0]?.label ?? "unidade existente"}.`,
      );
    }

    const { error } = await supabase.from("units").insert(unitRows);

    if (error) {
      throw new Error(`Falha ao gerar unidades em lote: ${error.message}`);
    }

    revalidatePath("/moradores");
  } catch (error) {
    redirect(
      buildHomeRedirect({
        path: "/moradores",
        tone: "error",
        condominiumId,
        message: getErrorMessage(error),
      }),
    );
  }

  redirect(
    buildHomeRedirect({
      path: "/moradores",
      tone: "success",
      condominiumId,
      message: "Unidades geradas com sucesso.",
    }),
  );
}

export async function updateUnit(formData: FormData) {
  const condominiumId =
    typeof formData.get("condominiumId") === "string"
      ? String(formData.get("condominiumId"))
      : undefined;

  try {
    const parsed = updateUnitSchema.parse({
      condominiumId: formData.get("condominiumId"),
      id: formData.get("id"),
      label: formData.get("label"),
      block: formData.get("block") || undefined,
      floor: formData.get("floor") || undefined,
    });

    await requireAuthorizedCondominium(parsed.condominiumId);
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("units")
      .update({
        label: parsed.label,
        block: parsed.block || null,
        floor: parsed.floor || null,
      })
      .eq("id", parsed.id)
      .eq("condominium_id", parsed.condominiumId);

    if (error) {
      throw new Error(`Falha ao atualizar unidade: ${error.message}`);
    }

    revalidatePath("/moradores");
  } catch (error) {
    redirect(
      buildHomeRedirect({
        path: "/moradores",
        tone: "error",
        condominiumId,
        message: getErrorMessage(error),
      }),
    );
  }

  redirect(
    buildHomeRedirect({
      path: "/moradores",
      tone: "success",
      condominiumId,
      message: "Unidade atualizada com sucesso.",
    }),
  );
}

export async function toggleUnitActive(formData: FormData) {
  const condominiumId =
    typeof formData.get("condominiumId") === "string"
      ? String(formData.get("condominiumId"))
      : undefined;

  try {
    const parsed = toggleActiveSchema.parse({
      condominiumId: formData.get("condominiumId"),
      id: formData.get("id"),
      nextState: formData.get("nextState"),
    });

    await requireAuthorizedCondominium(parsed.condominiumId);
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("units")
      .update({
        is_active: parsed.nextState === "true",
      })
      .eq("id", parsed.id)
      .eq("condominium_id", parsed.condominiumId);

    if (error) {
      throw new Error(`Falha ao atualizar status da unidade: ${error.message}`);
    }

    revalidatePath("/moradores");
  } catch (error) {
    redirect(
      buildHomeRedirect({
        path: "/moradores",
        tone: "error",
        condominiumId,
        message: getErrorMessage(error),
      }),
    );
  }

  redirect(
    buildHomeRedirect({
      path: "/moradores",
      tone: "success",
      condominiumId,
      message: "Status da unidade atualizado com sucesso.",
    }),
  );
}

export async function createResident(formData: FormData) {
  const condominiumId =
    typeof formData.get("condominiumId") === "string"
      ? String(formData.get("condominiumId"))
      : undefined;

  try {
    const parsed = createResidentSchema.parse({
      condominiumId: formData.get("condominiumId"),
      fullName: formData.get("fullName"),
      phone: formData.get("phone") || undefined,
      email: formData.get("email") || undefined,
      unitId: formData.get("unitId"),
    });

    await requireAuthorizedCondominium(parsed.condominiumId);
    const storedPhone = parsed.phone ? sanitizeStoredPhone(parsed.phone, { mobileOnly: true }) : null;
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("residents").insert({
      condominium_id: parsed.condominiumId,
      unit_id: parsed.unitId,
      full_name: parsed.fullName,
      phone: storedPhone,
      email: parsed.email || null,
    });

    if (error) {
      throw new Error(`Falha ao cadastrar morador: ${error.message}`);
    }

    revalidatePath("/moradores");
  } catch (error) {
    redirect(
      buildHomeRedirect({
        path: "/moradores",
        tone: "error",
        condominiumId,
        message: getErrorMessage(error),
      }),
    );
  }

  redirect(
    buildHomeRedirect({
      path: "/moradores",
      tone: "success",
      condominiumId,
      message: "Morador cadastrado com sucesso.",
    }),
  );
}

export async function updateResident(formData: FormData) {
  const condominiumId =
    typeof formData.get("condominiumId") === "string"
      ? String(formData.get("condominiumId"))
      : undefined;

  try {
    const parsed = updateResidentSchema.parse({
      condominiumId: formData.get("condominiumId"),
      id: formData.get("id"),
      fullName: formData.get("fullName"),
      phone: formData.get("phone") || undefined,
      email: formData.get("email") || undefined,
      unitId: formData.get("unitId"),
    });

    await requireAuthorizedCondominium(parsed.condominiumId);
    const storedPhone = parsed.phone ? sanitizeStoredPhone(parsed.phone, { mobileOnly: true }) : null;
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("residents")
      .update({
        full_name: parsed.fullName,
        phone: storedPhone,
        email: parsed.email || null,
        unit_id: parsed.unitId,
      })
      .eq("id", parsed.id)
      .eq("condominium_id", parsed.condominiumId);

    if (error) {
      throw new Error(`Falha ao atualizar morador: ${error.message}`);
    }

    revalidatePath("/moradores");
  } catch (error) {
    redirect(
      buildHomeRedirect({
        path: "/moradores",
        tone: "error",
        condominiumId,
        message: getErrorMessage(error),
      }),
    );
  }

  redirect(
    buildHomeRedirect({
      path: "/moradores",
      tone: "success",
      condominiumId,
      message: "Morador atualizado com sucesso.",
    }),
  );
}

export async function toggleResidentActive(formData: FormData) {
  const condominiumId =
    typeof formData.get("condominiumId") === "string"
      ? String(formData.get("condominiumId"))
      : undefined;

  try {
    const parsed = toggleActiveSchema.parse({
      condominiumId: formData.get("condominiumId"),
      id: formData.get("id"),
      nextState: formData.get("nextState"),
    });

    await requireAuthorizedCondominium(parsed.condominiumId);
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("residents")
      .update({
        is_active: parsed.nextState === "true",
      })
      .eq("id", parsed.id)
      .eq("condominium_id", parsed.condominiumId);

    if (error) {
      throw new Error(`Falha ao atualizar status do morador: ${error.message}`);
    }

    revalidatePath("/moradores");
  } catch (error) {
    redirect(
      buildHomeRedirect({
        path: "/moradores",
        tone: "error",
        condominiumId,
        message: getErrorMessage(error),
      }),
    );
  }

  redirect(
    buildHomeRedirect({
      path: "/moradores",
      tone: "success",
      condominiumId,
      message: "Status do morador atualizado com sucesso.",
    }),
  );
}

export async function createCondominium(formData: FormData) {
  let createdCondominiumId: string | undefined;

  try {
    const operatorContext = await requireOperatorContext();

    if (!operatorContext.memberships.some((membership) => membership.role === "admin")) {
      throw new Error("Somente administradores podem cadastrar novos condomínios.");
    }

    if (operatorContext.memberships.length > 0) {
      throw new Error("Cada operador pode pertencer a apenas um condomínio. Cadastre o condomínio com uma conta sem vínculo prévio.");
    }

    const parsed = createCondominiumSchema.parse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      contactPhone: formData.get("contactPhone") || undefined,
    });

    const storedPhone = parsed.contactPhone ? sanitizeStoredPhone(parsed.contactPhone) : null;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("condominiums")
      .insert({
        name: parsed.name,
        slug: parsed.slug,
        contact_phone: storedPhone,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`Falha ao cadastrar condominio: ${error?.message ?? "sem retorno"}`);
    }

    createdCondominiumId = data.id;
    const { error: membershipError } = await supabase.from("operator_memberships").insert({
      user_id: operatorContext.user.id,
      condominium_id: createdCondominiumId,
      role: "admin",
      is_default: false,
    });

    if (membershipError) {
      throw new Error(`Falha ao vincular administrador ao condomínio: ${membershipError.message}`);
    }

    await setActiveCondominiumCookie(data.id);
    revalidatePath("/configuracoes");
  } catch (error) {
    redirect(
      buildHomeRedirect({
        path: "/configuracoes",
        tone: "error",
        message: getErrorMessage(error),
      }),
    );
  }

  redirect(
    buildHomeRedirect({
      path: "/configuracoes",
      tone: "success",
      condominiumId: createdCondominiumId,
      message: "Condominio cadastrado com sucesso.",
    }),
  );
}

export async function validatePickupToken(formData: FormData) {
  const rawInput = typeof formData.get("token") === "string" ? String(formData.get("token")) : "";
  const redirectPath = typeof formData.get("redirectPath") === "string" ? String(formData.get("redirectPath")) : "/retirada";

  try {
    const parsed = validatePickupTokenSchema.parse({
      token: rawInput,
    });
    const extractedToken = extractPickupTokenFromInput(parsed.token);

    if (!extractedToken) {
      throw new Error("QR de retirada inválido.");
    }

    const { user, activeCondominium } = await requireAuthorizedCondominium();
    const consumed = await consumePickupToken({
      tokenValue: extractedToken,
      operatorId: user.id,
    });

    if (consumed.condominiumId !== activeCondominium.id) {
      throw new Error("Esse QR pertence a outro condomínio autorizado.");
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("deliveries")
      .select("id, status")
      .eq("id", consumed.deliveryId)
      .eq("condominium_id", activeCondominium.id)
      .single();

    if (error || !data) {
      throw new Error(`Falha ao localizar encomenda do QR: ${error?.message ?? "nao encontrada"}`);
    }

    const proofPhotoUrl = await uploadPickupProofPhoto({
      formData,
      condominiumId: activeCondominium.id,
      deliveryId: consumed.deliveryId,
    });

    await transitionDeliveryStatus({
      deliveryId: consumed.deliveryId,
      condominiumId: activeCondominium.id,
      currentStatus: data.status as DeliveryStatus,
      nextStatus: "picked_up",
      actorLabel: buildOperatorLabel(user),
      metadata: {
        pickupValidatedByQr: true,
        pickupPhotoUrl: proofPhotoUrl,
      },
    });

    revalidatePath("/");
    revalidatePath("/historico");
    revalidatePath("/retirada");
  } catch (error) {
    redirect(
      buildHomeRedirect({
        path: redirectPath,
        tone: "error",
        message: getErrorMessage(error),
      }),
    );
  }

  redirect(
    buildHomeRedirect({
      path: redirectPath,
      tone: "success",
      message: "Retirada validada por QR com sucesso.",
    }),
  );
}
