import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "operator-session";
export const ACTIVE_CONDOMINIUM_COOKIE_NAME = "active-condominium-id";
export const ONBOARDING_COOKIE_NAME = "operator-onboarding";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function generateOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function buildSessionExpiry(now = Date.now()) {
  return new Date(now + SESSION_DURATION_MS);
}
