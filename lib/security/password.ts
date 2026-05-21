import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PASSWORD_HASH_PREFIX = "scrypt";
const PASSWORD_KEY_LENGTH = 64;

function normalizePassword(password: string) {
  return password.normalize("NFKC");
}

export function validatePasswordStrength(password: string) {
  const normalized = normalizePassword(password);

  if (normalized.length < 8) {
    throw new Error("A senha deve ter pelo menos 8 caracteres.");
  }

  return normalized;
}

export function hashPassword(password: string) {
  const normalized = validatePasswordStrength(password);
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(normalized, salt, PASSWORD_KEY_LENGTH).toString("hex");

  return `${PASSWORD_HASH_PREFIX}:${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [prefix, salt, storedDerivedKey] = storedHash.split(":");

  if (prefix !== PASSWORD_HASH_PREFIX || !salt || !storedDerivedKey) {
    return false;
  }

  const candidate = scryptSync(normalizePassword(password), salt, PASSWORD_KEY_LENGTH);
  const stored = Buffer.from(storedDerivedKey, "hex");

  if (candidate.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(candidate, stored);
}
