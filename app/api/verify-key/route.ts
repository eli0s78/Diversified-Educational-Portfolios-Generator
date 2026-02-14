import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  resolveClaudeModelList,
  resolveOpenAIModelList,
  resolveGeminiModelList,
  detectGeminiTier,
  isOpenAIReasoningModel,
} from "@/lib/ai/model-resolver";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { aiProvider, apiKey } = body;

    if (!apiKey || !aiProvider) {
      return NextResponse.json(
        { valid: false, error: "Missing provider or API key" },
        { status: 400 }
      );
    }

    // Basic key format pre-check
    const formatError = checkKeyFormat(aiProvider, apiKey);
    if (formatError) {
      return NextResponse.json(
        { valid: false, error: formatError },
        { status: 400 }
      );
    }

    // Step 1: Get the full ranked model list (throws on invalid key)
    let candidates: string[];
    switch (aiProvider) {
      case "claude": {
        const client = new Anthropic({ apiKey });
        candidates = await resolveClaudeModelList(client);
        break;
      }
      case "openai": {
        const client = new OpenAI({ apiKey });
        candidates = await resolveOpenAIModelList(client);
        break;
      }
      case "gemini": {
        candidates = await resolveGeminiModelList(apiKey);
        break;
      }
      default:
        return NextResponse.json(
          { valid: false, error: `Unknown provider: ${aiProvider}` },
          { status: 400 }
        );
    }

    if (candidates.length === 0) {
      return NextResponse.json(
        { valid: false, error: "No compatible models found for this API key." },
        { status: 401 }
      );
    }

    // Step 2: Pick a diverse spread of candidates (premium + standard + budget)
    // so we quickly find the user's accessible tier without testing every model
    const toTest = selectDiverseCandidates(candidates);
    console.log(`[verify-key] ${aiProvider}: ${candidates.length} total models, testing ${toTest.length} diverse candidates: ${toTest.join(", ")}`);

    // Step 3: Iterate through candidates, test each until one works
    const result = await findWorkingModel(aiProvider, apiKey, toTest);

    if (!result.success) {
      return NextResponse.json(
        { valid: false, error: result.error },
        { status: 401 }
      );
    }

    // Step 3: Detect tier for the working model
    let tier: "free" | "paid" | null = null;
    if (aiProvider === "gemini") {
      const detectedTier = await detectGeminiTier(apiKey, result.model);
      tier = detectedTier === "unknown" ? null : detectedTier;
    } else {
      tier = "paid"; // Claude and OpenAI always require billing
    }

    console.log(`[verify-key] ${aiProvider}: verified model=${result.model}, tier=${tier}, tested=${result.candidatesTried} model(s)`);

    return NextResponse.json({
      valid: true,
      model: result.model,
      tier,
      tested: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    const friendlyMessage = friendlyError(message);
    return NextResponse.json(
      { valid: false, error: friendlyMessage },
      { status: 401 }
    );
  }
}

/**
 * Select a diverse spread of candidates from the ranked list.
 * Instead of just testing the top N (which are all premium), we pick:
 *   - Top 2 (premium tier)
 *   - 2 from the middle (standard tier)
 *   - 2 from the bottom (budget tier — most likely to be accessible)
 * This ensures we quickly find the user's accessible tier.
 */
function selectDiverseCandidates(ranked: string[]): string[] {
  if (ranked.length <= 8) return ranked; // small list, test all

  const selected: string[] = [];
  const add = (model: string) => {
    if (!selected.includes(model)) selected.push(model);
  };

  // Top 2 — premium models (best case)
  add(ranked[0]);
  add(ranked[1]);

  // Middle 2 — standard tier
  const mid = Math.floor(ranked.length / 2);
  add(ranked[mid]);
  add(ranked[Math.min(mid + 1, ranked.length - 1)]);

  // Bottom 2 — budget tier (most accessible)
  add(ranked[ranked.length - 2]);
  add(ranked[ranked.length - 1]);

  // Fill remaining slots from ranked order (up to 10 total)
  for (const m of ranked) {
    if (selected.length >= 10) break;
    add(m);
  }

  return selected;
}

/**
 * Iterate through ranked model candidates, testing each with a real generation.
 * Skips models that fail with quota/permission errors (429/403).
 * Stops on the first model that works, or on hard errors (401 = bad key).
 */
async function findWorkingModel(
  provider: string,
  apiKey: string,
  candidates: string[]
): Promise<
  | { success: true; model: string; candidatesTried: number }
  | { success: false; error: string }
> {
  let lastError = "";

  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i];
    console.log(`[verify-key] Testing ${provider} model: ${model} (${i + 1}/${candidates.length})`);

    const result = await testGeneration(provider, apiKey, model);

    if (result.success) {
      return { success: true, model, candidatesTried: i + 1 };
    }

    const err = result.error ?? "";
    const isQuotaOrPermission =
      err.includes("429") ||
      err.includes("quota") ||
      err.includes("exceeded") ||
      err.includes("billing") ||
      err.includes("insufficient_quota") ||
      err.includes("access") ||
      err.includes("not available") ||
      err.includes("does not exist") ||
      err.includes("not found");

    if (isQuotaOrPermission) {
      console.log(`[verify-key] Model ${model} not accessible (${err.slice(0, 80)}), trying next...`);
      lastError = err;
      continue;
    }

    // Hard error (e.g., 401 auth failure) — stop immediately
    return { success: false, error: err };
  }

  return {
    success: false,
    error: `Tested ${candidates.length} models (${candidates.join(", ")}) — all returned quota/permission errors. Your OpenAI plan may need billing enabled or a higher usage tier.`,
  };
}

/**
 * Basic key format pre-check — catches obvious mismatches before hitting the API.
 */
function checkKeyFormat(provider: string, key: string): string | null {
  const trimmed = key.trim();
  if (trimmed.length < 10) {
    return "API key is too short";
  }

  switch (provider) {
    case "claude":
      if (trimmed.startsWith("AIza")) {
        return "This looks like a Google/Gemini API key, not a Claude key. Please select the correct provider.";
      }
      if (trimmed.startsWith("sk-proj-") || (trimmed.startsWith("sk-") && !trimmed.startsWith("sk-ant-"))) {
        return "This looks like an OpenAI API key, not a Claude key. Please select the correct provider.";
      }
      break;
    case "openai":
      if (trimmed.startsWith("AIza")) {
        return "This looks like a Google/Gemini API key, not an OpenAI key. Please select the correct provider.";
      }
      if (trimmed.startsWith("sk-ant-")) {
        return "This looks like a Claude (Anthropic) API key, not an OpenAI key. Please select the correct provider.";
      }
      break;
    case "gemini":
      if (trimmed.startsWith("sk-ant-")) {
        return "This looks like a Claude (Anthropic) API key, not a Gemini key. Please select the correct provider.";
      }
      if (trimmed.startsWith("sk-proj-") || trimmed.startsWith("sk-")) {
        return "This looks like an OpenAI API key, not a Gemini key. Please select the correct provider.";
      }
      break;
  }

  return null;
}

/**
 * Test actual generation to confirm the key + model work end-to-end.
 */
async function testGeneration(
  provider: string,
  apiKey: string,
  modelId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (provider) {
      case "claude": {
        const client = new Anthropic({ apiKey });
        const response = await client.messages.create({
          model: modelId,
          max_tokens: 5,
          messages: [{ role: "user", content: "Reply with only the word OK" }],
        });
        const text = response.content.find((b) => b.type === "text");
        if (!text) throw new Error("Empty response from model");
        return { success: true };
      }
      case "openai": {
        const client = new OpenAI({ apiKey });
        const isReasoning = isOpenAIReasoningModel(modelId);
        const response = await client.chat.completions.create({
          model: modelId,
          ...(isReasoning
            ? { max_completion_tokens: 5 }
            : { max_tokens: 5 }),
          messages: [{ role: "user", content: "Reply with only the word OK" }],
        });
        if (!response.choices[0]?.message?.content) {
          throw new Error("Empty response from model");
        }
        return { success: true };
      }
      case "gemini": {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Reply with only the word OK" }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(
            (data as { error?: { message?: string } }).error?.message ||
              `HTTP ${response.status}`
          );
        }
        return { success: true };
      }
      default:
        return { success: false, error: `Unknown provider: ${provider}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Test generation failed";
    return { success: false, error: message };
  }
}

/**
 * Transform raw API error messages into user-friendly text.
 */
function friendlyError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("invalid x-api-key") || lower.includes("incorrect api key")) {
    return "Invalid API key. Please check your key and try again.";
  }
  if (lower.includes("403") || lower.includes("forbidden")) {
    return "API key does not have permission. Check that billing is enabled.";
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Rate limited. Please wait a moment and try again.";
  }
  if (lower.includes("api_key_invalid") || lower.includes("invalid_api_key")) {
    return "Invalid API key. Please check your key and try again.";
  }
  if (lower.includes("enotfound") || lower.includes("econnrefused") || lower.includes("fetch failed")) {
    return "Could not connect to the API. Check your internet connection.";
  }
  return message;
}
