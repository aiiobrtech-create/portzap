import { randomBytes } from "node:crypto";

export const PICKUP_TOKEN_TTL_HOURS = 72;
export const PICKUP_TOKEN_LENGTH = 8;
const PICKUP_TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PICKUP_TOKEN_GROUP_SIZE = 4;

export function generatePickupToken() {
  const bytes = randomBytes(PICKUP_TOKEN_LENGTH * 2);
  let token = "";
  const usableRange = Math.floor(256 / PICKUP_TOKEN_ALPHABET.length) * PICKUP_TOKEN_ALPHABET.length;

  for (const byte of bytes) {
    if (byte >= usableRange) {
      continue;
    }

    token += PICKUP_TOKEN_ALPHABET[byte % PICKUP_TOKEN_ALPHABET.length];

    if (token.length === PICKUP_TOKEN_LENGTH) {
      break;
    }
  }

  if (token.length !== PICKUP_TOKEN_LENGTH) {
    return generatePickupToken();
  }

  return token;
}

export function buildPickupExpiryDate(now = new Date()) {
  return new Date(now.getTime() + PICKUP_TOKEN_TTL_HOURS * 60 * 60 * 1000);
}

export function isPickupExpired(expiresAt: string | Date, now = new Date()) {
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime();
}

function normalizeStandardPickupToken(value: string) {
  const compact = value.trim().replace(/[\s-]/g, "");

  if (compact.length === PICKUP_TOKEN_LENGTH && /^[a-zA-Z0-9]+$/.test(compact)) {
    return compact.toUpperCase();
  }

  return value.trim();
}

export function extractPickupTokenFromInput(input: string) {
  const normalized = input.trim();

  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    const directToken = url.searchParams.get("token")?.trim();

    if (directToken) {
      return normalizeStandardPickupToken(directToken);
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const lastSegment = segments.at(-1)?.trim();

    return lastSegment ? normalizeStandardPickupToken(lastSegment) : null;
  } catch {
    return normalizeStandardPickupToken(normalized);
  }
}

export function formatPickupCode(token: string) {
  const compact = token.trim().replace(/[\s-]/g, "");

  if (compact.length === PICKUP_TOKEN_LENGTH && /^[a-zA-Z0-9]+$/.test(compact)) {
    const normalized = compact.toUpperCase();
    return [
      normalized.slice(0, PICKUP_TOKEN_GROUP_SIZE),
      normalized.slice(PICKUP_TOKEN_GROUP_SIZE),
    ].join("-");
  }

  return token.trim();
}

export function buildPickupResidentUrl(baseUrl: string, token: string) {
  return new URL(`/q/${token}`, baseUrl).toString();
}

export function buildPickupValidationUrl(baseUrl: string, token: string) {
  const url = new URL("/retirada", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export function buildQrImageUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=0&data=${encodeURIComponent(data)}`;
}
