import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPickupResidentUrl,
  buildPickupValidationUrl,
  extractPickupTokenFromInput,
  isPickupExpired,
} from "../lib/pickups.ts";

test("pickup helpers build stable URLs", () => {
  assert.equal(
    buildPickupResidentUrl("https://portzap.local", "abc123"),
    "https://portzap.local/q/abc123",
  );
  assert.equal(
    buildPickupValidationUrl("https://portzap.local", "abc123"),
    "https://portzap.local/retirada?token=abc123",
  );
});

test("pickup helpers extract token from raw text or URLs", () => {
  assert.equal(extractPickupTokenFromInput("abc123"), "abc123");
  assert.equal(
    extractPickupTokenFromInput("https://portzap.local/retirada?token=abc123"),
    "abc123",
  );
  assert.equal(
    extractPickupTokenFromInput("https://portzap.local/q/abc123"),
    "abc123",
  );
});

test("pickup expiry helper detects past and future dates", () => {
  assert.equal(isPickupExpired(new Date(Date.now() - 1_000)), true);
  assert.equal(isPickupExpired(new Date(Date.now() + 60_000)), false);
});
