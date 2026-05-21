import test from "node:test";
import assert from "node:assert/strict";
import { EvolutionClient } from "../lib/evolution/client.ts";

test("EvolutionClient trims env values and sends compatible auth headers", async () => {
  const originalEnv = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    EVOLUTION_BASE_URL: process.env.EVOLUTION_BASE_URL,
    EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY,
    EVOLUTION_INSTANCE: process.env.EVOLUTION_INSTANCE,
  };
  const originalFetch = globalThis.fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.EVOLUTION_BASE_URL = "https://evolution.example.com/";
  process.env.EVOLUTION_API_KEY = "  api-key  ";
  process.env.EVOLUTION_INSTANCE = "  port zap  ";

  const calls: Array<{ url: string; init: RequestInit }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      init: init ?? {},
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const client = new EvolutionClient();
    await client.sendText({
      phone: "5511999999999",
      message: "Teste",
    });
  } finally {
    globalThis.fetch = originalFetch;
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://evolution.example.com/message/sendText/port%20zap",
  );

  const headers = new Headers(calls[0].init.headers);
  assert.equal(headers.get("apikey"), "api-key");
  assert.equal(headers.get("x-api-key"), "api-key");
  assert.equal(headers.get("authorization"), "Bearer api-key");
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(headers.get("accept"), "application/json");
});
