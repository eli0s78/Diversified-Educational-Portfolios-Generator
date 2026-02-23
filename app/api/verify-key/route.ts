import { NextRequest, NextResponse } from "next/server";
import {
  resolveGeminiModelList,
  detectGeminiTier,
} from "@/lib/ai/model-resolver";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        { valid: false, error: "Missing API key" },
        { status: 400 }
      );
    }

    // Basic key format check
    const formatError = checkKeyFormat(apiKey);
    if (formatError) {
      return NextResponse.json(
        { valid: false, error: formatError },
        { status: 400 }
      );
    }

    // Step 1: Get the full ranked model list (throws on invalid key)
    const candidates = await resolveGeminiModelList(apiKey);

    if (candidates.length === 0) {
      return NextResponse.json(
        { valid: false, error: "No compatible models found for this API key." },
        { status: 401 }
      );
    }

    // Step 2: Pick a diverse spread of candidates
    const toTest = selectDiverseCandidates(candidates);
    console.log(`[verify-key] Gemini: ${candidates.length} total models, testing ${toTest.length} diverse candidates: ${toTest.join(", ")}`);

    // Step 3: Iterate through candidates, test each until one works
    const result = await findWorkingModel(apiKey, toTest);

    if (!result.success) {
      return NextResponse.json(
        { valid: false, error: result.error },
        { status: 401 }
      );
    }

    // Step 4: Detect tier for the working model
    const detectedTier = await detectGeminiTier(apiKey, result.model);
    const tier = detectedTier === "unknown" ? null : detectedTier;

    console.log(`[verify-key] Gemini: verified model=${result.model}, tier=${tier}, tested=${result.candidatesTried} model(s)`);

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
 */
function selectDiverseCandidates(ranked: string[]): string[] {
  if (ranked.length <= 8) return ranked;

  const selected: string[] = [];
  const add = (model: string) => {
    if (!selected.includes(model)) selected.push(model);
  };

  add(ranked[0]);
  add(ranked[1]);

  const mid = Math.floor(ranked.length / 2);
  add(ranked[mid]);
  add(ranked[Math.min(mid + 1, ranked.length - 1)]);

  add(ranked[ranked.length - 2]);
  add(ranked[ranked.length - 1]);

  for (const m of ranked) {
    if (selected.length >= 10) break;
    add(m);
  }

  return selected;
}

/**
 * Iterate through ranked model candidates, testing each with a real generation.
 */
async function findWorkingModel(
  apiKey: string,
  candidates: string[]
): Promise<
  | { success: true; model: string; candidatesTried: number }
  | { success: false; error: string }
> {
  let lastError = "";

  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i];
    console.log(`[verify-key] Testing Gemini model: ${model} (${i + 1}/${candidates.length})`);

    const result = await testGeneration(apiKey, model);

    if (result.success) {
      return { success: true, model, candidatesTried: i + 1 };
    }

    const err = result.error ?? "";
    const isQuotaOrPermission =
      err.includes("429") ||
      err.includes("quota") ||
      err.includes("exceeded") ||
      err.includes("billing") ||
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
    error: `Tested ${candidates.length} models (${candidates.join(", ")}) — all returned quota/permission errors. Your Google AI plan may need billing enabled.`,
  };
}

/**
 * Basic key format check.
 */
function checkKeyFormat(key: string): string | null {
  const trimmed = key.trim();
  if (trimmed.length < 10) {
    return "API key is too short";
  }
  if (trimmed.startsWith("sk-ant-")) {
    return "This looks like a Claude (Anthropic) API key, not a Gemini key.";
  }
  if (trimmed.startsWith("sk-proj-") || trimmed.startsWith("sk-")) {
    return "This looks like an OpenAI API key, not a Gemini key.";
  }
  return null;
}

/**
 * Test actual generation to confirm the key + model work end-to-end.
 */
async function testGeneration(
  apiKey: string,
  modelId: string
): Promise<{ success: boolean; error?: string }> {
  try {
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
  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("incorrect api key")) {
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
