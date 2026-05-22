import "server-only";

import { getServerEnv } from "@/lib/env";

type SendDeliveryEmailInput = {
  to: string;
  residentName: string;
  apartment: string;
  carrier?: string;
  description?: string;
  pickupCode?: string;
  qrImageUrl?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isEmailConfigured() {
  const env = getServerEnv();
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export async function sendDeliveryEmail(input: SendDeliveryEmailInput) {
  const env = getServerEnv();

  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new Error("Envio de e-mail não configurado. Defina RESEND_API_KEY e EMAIL_FROM.");
  }

  const details = [
    `Unidade: ${input.apartment}`,
    input.carrier ? `Transportadora: ${input.carrier}` : null,
    input.description ? `Item: ${input.description}` : null,
    input.pickupCode ? `Código manual: ${input.pickupCode}` : null,
  ].filter(Boolean);
  const htmlDetails = details.map((detail) => `<li>${escapeHtml(String(detail))}</li>`).join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [input.to],
      subject: `Encomenda disponível - Unidade ${input.apartment}`,
      html: [
        `<p>Olá, ${escapeHtml(input.residentName)}.</p>`,
        "<p>Sua encomenda chegou na portaria.</p>",
        input.qrImageUrl
          ? `<p><img src="${escapeHtml(input.qrImageUrl)}" alt="QR code de retirada" style="max-width:280px;width:100%;height:auto;display:block;border:0;" /></p>`
          : "",
        `<ul>${htmlDetails}</ul>`,
        "<p>Apresente o QR ou use o código manual no momento da retirada.</p>",
      ].join(""),
      text: [
        `Olá, ${input.residentName}.`,
        "Sua encomenda chegou na portaria.",
        ...details.map(String),
        "Apresente o QR ou use o código manual no momento da retirada.",
      ].join("\n"),
    }),
  });

  const payload = await response.json().catch(async () => ({ raw: await response.text() }));

  if (!response.ok) {
    throw new Error(`Resend API error (${response.status}): ${JSON.stringify(payload)}`);
  }

  return payload;
}
