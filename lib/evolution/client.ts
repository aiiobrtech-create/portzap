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

function getFileNameFromUrl(imageUrl: string) {
  try {
    const url = new URL(imageUrl);
    const fileName = url.pathname.split("/").filter(Boolean).pop();

    return fileName && fileName.includes(".") ? fileName : "foto.jpg";
  } catch {
    return "foto.jpg";
  }
}

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
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      throw new Error(`Falha ao carregar a imagem para envio: ${imageResponse.status}`);
    }

    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const media = imageBuffer.toString("base64");

    return this.request("/message/sendMedia", {
      number: phone,
      mediatype: "image",
      mimetype: contentType,
      media,
      caption,
      fileName: getFileNameFromUrl(imageUrl),
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
