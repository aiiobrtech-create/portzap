import test from "node:test";
import assert from "node:assert/strict";
import { formatBrazilPhone, normalizeSlugInput, sanitizeStoredPhone } from "../lib/input-formatting.ts";

test("formatBrazilPhone applies Brazilian mask and clamps length", () => {
  assert.equal(formatBrazilPhone("119999900001234"), "(11) 99999-0000");
  assert.equal(formatBrazilPhone("1133334444"), "(11) 3333-4444");
});

test("sanitizeStoredPhone validates and normalizes phone values", () => {
  assert.equal(sanitizeStoredPhone("11 99999-0000", { mobileOnly: true }), "(11) 99999-0000");
  assert.equal(sanitizeStoredPhone("+55 (11) 3333-4444"), "(11) 3333-4444");
  assert.throws(() => sanitizeStoredPhone("12345", { mobileOnly: true }), /WhatsApp com DDD/i);
});

test("normalizeSlugInput removes invalid characters and collapses separators", () => {
  assert.equal(normalizeSlugInput(" Condomínio Parque Central!!! "), "condominio-parque-central");
});
