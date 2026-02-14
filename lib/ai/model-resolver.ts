import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";

// --- Resolve options ---

export interface ResolveOptions {
  /** When true, throw on API errors instead of returning fallback model */
  strict?: boolean;
}

// --- Cache infrastructure ---

interface CachedModel {
  modelId: string;
  resolvedAt: number;
}

const MODEL_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const modelCache = new Map<string, CachedModel>();

function getCacheKey(provider: string, apiKey: string): string {
  const fingerprint = apiKey.slice(0, 8) + apiKey.slice(-4);
  return `${provider}:${fingerprint}`;
}

function getCached(key: string): string | null {
  const entry = modelCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.resolvedAt > MODEL_CACHE_TTL_MS) {
    modelCache.delete(key);
    return null;
  }
  return entry.modelId;
}

function setCache(key: string, modelId: string): void {
  modelCache.set(key, { modelId, resolvedAt: Date.now() });
}

// --- Claude model resolver ---

const CLAUDE_TIER_RANK: Record<string, number> = {
  opus: 3,
  sonnet: 2,
  haiku: 1,
};

function parseClaudeModel(id: string) {
  // Match: claude-{tier}-{version parts}-{8-digit date}
  // Examples: claude-opus-4-6-20260201, claude-sonnet-4-5-20250929, claude-haiku-3-5-20241022
  const match = id.match(/^claude-(\w+)-([\d-]+?)-(\d{8})$/);
  if (!match) return null;
  const [, tierStr, versionStr, date] = match;
  const tier = CLAUDE_TIER_RANK[tierStr] ?? 0;
  if (tier === 0 && !(tierStr in CLAUDE_TIER_RANK)) {
    console.warn(`[model-resolver] Unknown Claude tier: "${tierStr}" in model ${id}`);
  }
  // Version like "4" or "4-5" → 4.0 or 4.5
  const parts = versionStr.split("-");
  const version = parseInt(parts[0]) + (parseInt(parts[1] ?? "0") / 10);
  return { tier, version, date };
}

const CLAUDE_FALLBACK = "claude-sonnet-4-5-20250929";

/**
 * Fetch and rank all Claude models. Throws on API errors.
 * Returns the full ranked list of model IDs (best first).
 */
export async function resolveClaudeModelList(client: Anthropic): Promise<string[]> {
  const models: Array<{ id: string }> = [];
  for await (const model of client.models.list()) {
    models.push(model);
  }

  if (models.length === 0) {
    throw new Error("No models available for this API key");
  }

  const ranked = models
    .map((m) => ({ id: m.id, parsed: parseClaudeModel(m.id) }))
    .filter((m) => m.parsed !== null)
    .sort((a, b) => {
      const ap = a.parsed!, bp = b.parsed!;
      if (ap.tier !== bp.tier) return bp.tier - ap.tier;
      if (ap.version !== bp.version) return bp.version - ap.version;
      return bp.date.localeCompare(ap.date);
    });

  console.log(`[model-resolver] Claude: ranked ${ranked.length} models from ${models.length} total: ${ranked.slice(0, 5).map(m => m.id).join(", ")}...`);
  return ranked.map((m) => m.id);
}

export async function resolveClaudeModel(client: Anthropic, apiKey: string, options?: ResolveOptions): Promise<string> {
  const cacheKey = getCacheKey("claude", apiKey);
  if (!options?.strict) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  try {
    const ranked = await resolveClaudeModelList(client);
    const best = ranked[0] ?? CLAUDE_FALLBACK;
    setCache(cacheKey, best);
    return best;
  } catch (err) {
    if (options?.strict) throw err;
    console.warn(`[model-resolver] Claude model listing failed, using fallback ${CLAUDE_FALLBACK}:`, err);
    setCache(cacheKey, CLAUDE_FALLBACK);
    return CLAUDE_FALLBACK;
  }
}

// --- OpenAI model resolver ---

const OPENAI_NON_CHAT = [
  "embed", "dall-e", "tts", "whisper", "davinci", "babbage",
  "moderation", "canary", "realtime", "codex",
];

const OPENAI_VARIANT_RANK: Record<string, number> = {
  pro: 10,
  turbo: 5,
  chat: 3,
  mini: -5,
};

function parseOpenAIModel(id: string) {
  // Filter out non-chat models
  if (OPENAI_NON_CHAT.some((s) => id.includes(s))) return null;

  // Match GPT models: gpt-{version}[o][-variant][-date]
  // Examples: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-5, gpt-5.2, gpt-5.2-pro
  const gptMatch = id.match(/^gpt-(\d+(?:\.\d+)?)(o)?(?:-(.+?))?(?:-(\d{4}-\d{2}-\d{2}))?$/);
  if (gptMatch) {
    const [, versionStr, oSuffix, variant] = gptMatch;
    const version = parseFloat(versionStr);
    // "o" suffix is a sub-variant improvement (GPT-4o > GPT-4)
    const oBonus = oSuffix ? 0.1 : 0;
    // Filter out known non-generation variants
    if (variant === "audio" || variant === "search") return null;
    const variantRank = variant ? (OPENAI_VARIANT_RANK[variant] ?? 0) : 0;
    return { version: version + oBonus, variantRank };
  }

  // Match o-series reasoning models: o{version}[-variant][-date]
  // Examples: o1, o3, o4-mini, o3-pro
  const oMatch = id.match(/^o(\d+)(?:-(.+?))?(?:-(\d{4}-\d{2}-\d{2}))?$/);
  if (oMatch) {
    const [, versionStr, variant] = oMatch;
    const version = parseInt(versionStr);
    // o-series are reasoning models; rank them alongside GPT by treating oN as version N+0.5
    // This makes o4 (4.5) rank between gpt-4o (4.1) and gpt-5 (5.0)
    const variantRank = variant ? (OPENAI_VARIANT_RANK[variant] ?? 0) : 0;
    return { version: version + 0.5, variantRank };
  }

  return null;
}

const OPENAI_FALLBACK = "gpt-4.1";

/**
 * Fetch and rank all OpenAI models. Throws on API errors.
 * Returns the full ranked list of model IDs (best first).
 */
export async function resolveOpenAIModelList(client: OpenAI): Promise<string[]> {
  const models: Array<{ id: string; created: number }> = [];
  for await (const model of client.models.list()) {
    models.push({ id: model.id, created: model.created });
  }

  if (models.length === 0) {
    throw new Error("No models available for this API key");
  }

  const ranked = models
    .map((m) => ({ ...m, parsed: parseOpenAIModel(m.id) }))
    .filter((m) => m.parsed !== null)
    .sort((a, b) => {
      const ap = a.parsed!, bp = b.parsed!;
      if (ap.version !== bp.version) return bp.version - ap.version;
      if (ap.variantRank !== bp.variantRank) return bp.variantRank - ap.variantRank;
      return b.created - a.created;
    });

  console.log(`[model-resolver] OpenAI: ranked ${ranked.length} chat models from ${models.length} total: ${ranked.slice(0, 8).map(m => m.id).join(", ")}...`);
  return ranked.map((m) => m.id);
}

export async function resolveOpenAIModel(client: OpenAI, apiKey: string, options?: ResolveOptions): Promise<string> {
  const cacheKey = getCacheKey("openai", apiKey);
  if (!options?.strict) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  try {
    const ranked = await resolveOpenAIModelList(client);
    const best = ranked[0] ?? OPENAI_FALLBACK;
    setCache(cacheKey, best);
    return best;
  } catch (err) {
    if (options?.strict) throw err;
    console.warn(`[model-resolver] OpenAI model listing failed, using fallback ${OPENAI_FALLBACK}:`, err);
    setCache(cacheKey, OPENAI_FALLBACK);
    return OPENAI_FALLBACK;
  }
}

// --- Gemini model resolver ---

interface GeminiModel {
  name: string;
  displayName: string;
  description: string;
  supportedGenerationMethods: string[];
  inputTokenLimit: number;
  outputTokenLimit: number;
}

interface GeminiModelListResponse {
  models: GeminiModel[];
  nextPageToken?: string;
}

const GEMINI_TIER_RANK: Record<string, number> = {
  ultra: 4,
  pro: 3,
  flash: 2,
  nano: 1,
};

function parseGeminiModel(name: string) {
  // name: "models/gemini-3.0-pro" or "models/gemini-2.5-flash-lite"
  // Also handles: "models/gemini-3-pro" (no minor version)
  const id = name.replace("models/", "");
  const match = id.match(/^gemini-(\d+)(?:\.(\d+))?-(\w+)(?:-(.+))?$/);
  if (!match) return null;
  const [, major, minor, tierStr, variant] = match;
  const tier = GEMINI_TIER_RANK[tierStr] ?? 0;
  if (tier === 0 && !(tierStr in GEMINI_TIER_RANK)) {
    console.warn(`[model-resolver] Unknown Gemini tier: "${tierStr}" in model ${id}`);
  }
  const version = parseInt(major) * 10 + parseInt(minor ?? "0");
  return { id, tier, version, variant: variant ?? "" };
}

const GEMINI_FALLBACK = "gemini-2.5-flash";

async function fetchAllGeminiModels(apiKey: string): Promise<GeminiModel[]> {
  const allModels: GeminiModel[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ key: apiKey, pageSize: "1000" });
    if (pageToken) params.set("pageToken", pageToken);

    const url = `https://generativelanguage.googleapis.com/v1beta/models?${params}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const data: GeminiModelListResponse = await response.json();
    allModels.push(...(data.models || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allModels;
}

/**
 * Fetch and rank all Gemini models. Throws on API errors.
 * Returns the full ranked list of model IDs (best first).
 */
export async function resolveGeminiModelList(apiKey: string): Promise<string[]> {
  const allModels = await fetchAllGeminiModels(apiKey);

  if (allModels.length === 0) {
    throw new Error("No models available for this API key");
  }

  const generative = allModels.filter((m) =>
    m.supportedGenerationMethods.includes("generateContent")
  );

  const parsed = generative
    .map((m) => ({ name: m.name, parsed: parseGeminiModel(m.name) }))
    .filter((m) => m.parsed !== null);

  console.log(
    `[model-resolver] Gemini: ${allModels.length} total, ${generative.length} generative, ${parsed.length} parsed:`,
    parsed.map((m) => `${m.parsed!.id} (v${m.parsed!.version}, tier=${m.parsed!.tier}, variant="${m.parsed!.variant}")`).join(", ")
  );

  const ranked = parsed
    .filter((m) => !m.parsed!.variant.includes("thinking") && !m.parsed!.variant.includes("lite"))
    .sort((a, b) => {
      const ap = a.parsed!, bp = b.parsed!;
      if (ap.version !== bp.version) return bp.version - ap.version;
      if (ap.tier !== bp.tier) return bp.tier - ap.tier;
      if (ap.variant === "" && bp.variant !== "") return -1;
      if (ap.variant !== "" && bp.variant === "") return 1;
      return 0;
    });

  console.log(`[model-resolver] Gemini: top ranked: ${ranked.slice(0, 5).map(m => m.parsed!.id).join(", ")}`);
  return ranked.map((m) => m.parsed!.id);
}

export async function resolveGeminiModel(apiKey: string, options?: ResolveOptions): Promise<string> {
  const cacheKey = getCacheKey("gemini", apiKey);
  if (!options?.strict) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  try {
    const ranked = await resolveGeminiModelList(apiKey);
    const best = ranked[0] ?? GEMINI_FALLBACK;
    setCache(cacheKey, best);
    return best;
  } catch (err) {
    if (options?.strict) throw err;
    console.warn(`[model-resolver] Gemini model listing failed, using fallback ${GEMINI_FALLBACK}:`, err);
    setCache(cacheKey, GEMINI_FALLBACK);
    return GEMINI_FALLBACK;
  }
}

// --- Gemini tier detection ---

export async function detectGeminiTier(
  apiKey: string,
  modelId: string
): Promise<"free" | "paid" | "unknown"> {
  try {
    // Use countTokens — lightweight, free, and returns rate-limit headers
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:countTokens?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "test" }] }],
      }),
    });

    if (!response.ok) {
      console.warn(`[model-resolver] Gemini tier detection request failed: ${response.status}`);
      return "unknown";
    }

    // Check rate limit headers — Google uses various formats
    for (const [key, value] of response.headers.entries()) {
      const lk = key.toLowerCase();
      // Look for per-minute request limit headers
      if (
        (lk.includes("ratelimit") || lk.includes("rate-limit")) &&
        (lk.includes("limit") && !lk.includes("remaining") && !lk.includes("reset"))
      ) {
        const limit = parseInt(value);
        if (!isNaN(limit)) {
          console.log(`[model-resolver] Gemini rate limit header: ${key}=${value}`);
          // Free tier: 2-15 RPM depending on model; Paid Tier 1: 100-1000+ RPM
          if (limit <= 30) return "free";
          if (limit >= 50) return "paid";
        }
      }
    }

    // Fallback: log all headers for debugging
    const headerEntries: string[] = [];
    response.headers.forEach((v, k) => headerEntries.push(`${k}: ${v}`));
    console.log(`[model-resolver] Gemini tier detection — no rate limit header found. All headers:`, headerEntries.join("; "));

    return "unknown";
  } catch (err) {
    console.warn("[model-resolver] Gemini tier detection failed:", err);
    return "unknown";
  }
}

// --- Utility for OpenAI parameter compatibility ---

export function isOpenAIReasoningModel(modelId: string): boolean {
  return /^o\d/.test(modelId);
}
