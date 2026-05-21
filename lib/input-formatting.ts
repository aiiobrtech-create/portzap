export function extractDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatBrazilPhone(value: string) {
  let digits = extractDigits(value);

  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }

  digits = digits.slice(0, 11);

  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  }

  const ddd = digits.slice(0, 2);

  if (digits.length <= 6) {
    return `(${ddd}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${ddd}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${ddd}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function sanitizeStoredPhone(value: string, options?: { mobileOnly?: boolean }) {
  const raw = value.trim();

  if (!raw) {
    return "";
  }

  let digits = extractDigits(raw);

  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }

  const isValid = options?.mobileOnly
    ? digits.length === 11
    : digits.length === 10 || digits.length === 11;

  if (!isValid) {
    throw new Error(
      options?.mobileOnly
        ? "Telefone invalido. Use WhatsApp com DDD e 9 digitos."
        : "Telefone invalido. Use DDD e numero valido.",
    );
  }

  return formatBrazilPhone(digits);
}

export function normalizeSlugInput(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
