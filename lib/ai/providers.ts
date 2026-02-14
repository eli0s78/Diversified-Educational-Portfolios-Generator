import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  resolveClaudeModel,
  resolveOpenAIModel,
  resolveGeminiModel,
  isOpenAIReasoningModel,
} from "./model-resolver";

export type AIProviderType = "claude" | "openai" | "gemini";

export interface GenerateParams {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIProvider {
  generate(params: GenerateParams): Promise<string>;
}

class ClaudeProvider implements AIProvider {
  private client: Anthropic;
  private apiKey: string;
  private resolvedModelId: string | null = null;

  constructor(apiKey: string, modelId?: string) {
    this.apiKey = apiKey;
    this.client = new Anthropic({ apiKey });
    if (modelId) this.resolvedModelId = modelId;
  }

  private async resolveModel(): Promise<string> {
    if (!this.resolvedModelId) {
      this.resolvedModelId = await resolveClaudeModel(this.client, this.apiKey);
    }
    return this.resolvedModelId;
  }

  async generate(params: GenerateParams): Promise<string> {
    const modelId = await this.resolveModel();
    const response = await this.client.messages.create({
      model: modelId,
      max_tokens: params.maxTokens ?? 4096,
      system: params.systemPrompt,
      messages: [{ role: "user", content: params.userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock ? textBlock.text : "";
  }
}

class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private apiKey: string;
  private resolvedModelId: string | null = null;

  constructor(apiKey: string, modelId?: string) {
    this.apiKey = apiKey;
    this.client = new OpenAI({ apiKey });
    if (modelId) this.resolvedModelId = modelId;
  }

  private async resolveModel(): Promise<string> {
    if (!this.resolvedModelId) {
      this.resolvedModelId = await resolveOpenAIModel(this.client, this.apiKey);
    }
    return this.resolvedModelId;
  }

  async generate(params: GenerateParams): Promise<string> {
    const modelId = await this.resolveModel();
    const isReasoning = isOpenAIReasoningModel(modelId);

    const response = await this.client.chat.completions.create({
      model: modelId,
      ...(isReasoning
        ? { max_completion_tokens: params.maxTokens ?? 4096 }
        : {
            max_tokens: params.maxTokens ?? 4096,
            temperature: params.temperature ?? 0.4,
          }),
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    });

    return response.choices[0]?.message?.content ?? "";
  }
}

class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;
  private apiKey: string;
  private maxRetries = 3;
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
    const model = this.client.getGenerativeModel({
      model: modelId,
      systemInstruction: params.systemPrompt,
    });

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await model.generateContent(params.userPrompt);
        return result.response.text();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const isRateLimit = message.includes("429") || message.includes("Too Many Requests");
        if (!isRateLimit || attempt === this.maxRetries) throw err;

        // Extract retry delay from error message, default to 60s
        const delayMatch = message.match(/retry in ([\d.]+)s/i);
        const delaySec = delayMatch ? Math.ceil(parseFloat(delayMatch[1])) : 60;
        console.log(`Gemini rate limited. Retrying in ${delaySec}s (attempt ${attempt + 1}/${this.maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
      }
    }
    throw new Error("Gemini: max retries exceeded");
  }
}

/**
 * Create an AI provider. If `modelId` is provided, use that exact model
 * instead of auto-resolving (avoids picking models the user's plan can't access).
 */
export function createAIProvider(
  type: AIProviderType,
  apiKey: string,
  modelId?: string
): AIProvider {
  switch (type) {
    case "claude":
      return new ClaudeProvider(apiKey, modelId);
    case "openai":
      return new OpenAIProvider(apiKey, modelId);
    case "gemini":
      return new GeminiProvider(apiKey, modelId);
    default:
      throw new Error(`Unknown AI provider: ${type}`);
  }
}

export function getServerProvider(): AIProvider | null {
  if (process.env.ANTHROPIC_API_KEY) {
    return createAIProvider("claude", process.env.ANTHROPIC_API_KEY);
  }
  if (process.env.OPENAI_API_KEY) {
    return createAIProvider("openai", process.env.OPENAI_API_KEY);
  }
  if (process.env.GEMINI_API_KEY) {
    return createAIProvider("gemini", process.env.GEMINI_API_KEY);
  }
  return null;
}
