import { getServerEnv } from "../env.ts";

type SendTextInput = {
  phone: string;
  message: string;
};

type SendImageInput = {
  phone: string;
  imageUrl: string;
  caption?: string;
};

export class EvolutionClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly instance: string;

  constructor() {
    const env = getServerEnv();
    this.baseUrl = env.EVOLUTION_BASE_URL.trim().replace(/\/$/, "");
    this.apiKey = env.EVOLUTION_API_KEY.trim();
    this.instance = env.EVOLUTION_INSTANCE.trim();
  }

  async sendText({ phone, message }: SendTextInput) {
    return this.request("/message/sendText", {
      number: phone,
      text: message,
      delay: 500,
    });
  }

  async sendImage({ phone, imageUrl, caption }: SendImageInput) {
    return this.request("/message/sendMedia", {
      number: phone,
      mediatype: "image",
      media: imageUrl,
      caption,
      delay: 500,
    });
  }

  private async request(path: string, body: Record<string, unknown>) {
    const url = `${this.baseUrl}${path}/${encodeURIComponent(this.instance)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: this.apiKey,
        "x-api-key": this.apiKey,
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const authHint =
        response.status === 401
          ? " Verifique EVOLUTION_API_KEY, EVOLUTION_INSTANCE e se a Evolution aceita o header apikey nessa instalação."
          : "";
      throw new Error(
        `Evolution API error (${response.status}): ${errorBody || "sem resposta"}.${authHint}`,
      );
    }

    return response.json();
  }
}
