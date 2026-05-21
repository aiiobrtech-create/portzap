import { randomBytes } from "node:crypto";

export const PICKUP_TOKEN_TTL_HOURS = 72;

export function generatePickupToken() {
  return randomBytes(24).toString("base64url");
}

export function buildPickupExpiryDate(now = new Date()) {
  return new Date(now.getTime() + PICKUP_TOKEN_TTL_HOURS * 60 * 60 * 1000);
}

export function isPickupExpired(expiresAt: string | Date, now = new Date()) {
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime();
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
      return directToken;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const lastSegment = segments.at(-1)?.trim();

    return lastSegment || null;
  } catch {
    return normalized;
  }
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
