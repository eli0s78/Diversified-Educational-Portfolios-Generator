import { GoogleGenerativeAI, type ResponseSchema } from "@google/generative-ai";
import { resolveGeminiModel } from "./model-resolver";

export interface GenerateParams {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  /** Gemini structured output schema */
  responseSchema?: unknown;
}

export interface AIProvider {
  generate(params: GenerateParams): Promise<string>;
}

class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;
  private apiKey: string;
  private maxRetries = 5;
  private resolvedModelId: string | null = null;

  constructor(apiKey: string, modelId?: string) {
    this.apiKey = apiKey;
    this.client = new GoogleGenerativeAI(apiKey);
    if (modelId) this.resolvedModelId = modelId;
  }

  private async resolveModel(): Promise<string> {
    if (!this.resolvedModelId) {
      this.resolvedModelId = await resolveGeminiModel(this.apiKey);
    }
    return this.resolvedModelId;
  }

  async generate(params: GenerateParams): Promise<string> {
    const modelId = await this.resolveModel();

    // Gemini 3: Google recommends temperature 1.0 — lower values cause
    // looping and degraded reasoning. Always force JSON output.
    const generationConfig: {
      temperature: number;
      maxOutputTokens: number;
      responseMimeType: string;
      responseSchema?: ResponseSchema;
    } = {
      temperature: 1.0,
      maxOutputTokens: params.maxTokens ?? 65536,
      responseMimeType: "application/json",
    };

    if (params.responseSchema) {
      generationConfig.responseSchema = params.responseSchema as ResponseSchema;
    }

    const model = this.client.getGenerativeModel({
      model: modelId,
      systemInstruction: params.systemPrompt,
      generationConfig,
    });

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await model.generateContent(params.userPrompt);
        return result.response.text();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const isRetryable =
          message.includes("429") ||
          message.includes("Too Many Requests") ||
          message.includes("503") ||
          message.includes("Service Unavailable") ||
          message.includes("high demand") ||
          message.includes("fetch failed") ||
          message.includes("ECONNRESET") ||
          message.includes("ETIMEDOUT");

        if (!isRetryable || attempt === this.maxRetries) throw err;

        // Base delay of 5 seconds, exponential backoff (5s, 10s, 20s, 40s...)
        let delaySec = 5 * Math.pow(2, attempt);

        // If the error explicitly gave a retry time, use it if it's longer
        const delayMatch = message.match(/retry in ([\d.]+)s/i);
        if (delayMatch) {
          delaySec = Math.max(delaySec, Math.ceil(parseFloat(delayMatch[1])));
        }

        const errorType = message.includes("503") ? "503 High Demand" :
          message.includes("fetch failed") ? "Network Fetch Failed" :
            message.includes("ECONNRESET") ? "Connection Reset" :
              "429 Rate Limit";

        console.log(`Gemini API issue (${errorType}). Retrying in ${delaySec}s (attempt ${attempt + 1}/${this.maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
      }
    }
    throw new Error("Gemini: max retries exceeded");
  }
}

/**
 * Create the AI provider (Gemini only).
 * If `modelId` is provided, use that exact model instead of auto-resolving.
 */
export function createAIProvider(
  apiKey: string,
  modelId?: string
): AIProvider {
  return new GeminiProvider(apiKey, modelId);
}
