import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../lib/security/password.ts";

test("password hashing validates the original secret", () => {
  const hash = hashPassword("SenhaForte123");

  assert.ok(hash.startsWith("scrypt:"));
  assert.equal(verifyPassword("SenhaForte123", hash), true);
  assert.equal(verifyPassword("SenhaErrada123", hash), false);
});

test("weak passwords are rejected", () => {
  assert.throws(() => hashPassword("1234567"), /8 caracteres/i);
});
