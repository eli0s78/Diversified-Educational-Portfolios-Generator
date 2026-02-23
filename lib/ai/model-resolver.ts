// --- Cache infrastructure ---

interface CachedModel {
  modelId: string;
  resolvedAt: number;
}

const MODEL_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const modelCache = new Map<string, CachedModel>();

function getCacheKey(apiKey: string): string {
  const fingerprint = apiKey.slice(0, 8) + apiKey.slice(-4);
  return `gemini:${fingerprint}`;
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

// --- Resolve options ---

export interface ResolveOptions {
  /** When true, throw on API errors instead of returning fallback model */
  strict?: boolean;
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
  const cacheKey = getCacheKey(apiKey);
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

    for (const [key, value] of response.headers.entries()) {
      const lk = key.toLowerCase();
      if (
        (lk.includes("ratelimit") || lk.includes("rate-limit")) &&
        (lk.includes("limit") && !lk.includes("remaining") && !lk.includes("reset"))
      ) {
        const limit = parseInt(value);
        if (!isNaN(limit)) {
          console.log(`[model-resolver] Gemini rate limit header: ${key}=${value}`);
          if (limit <= 30) return "free";
          if (limit >= 50) return "paid";
        }
      }
    }

    const headerEntries: string[] = [];
    response.headers.forEach((v, k) => headerEntries.push(`${k}: ${v}`));
    console.log(`[model-resolver] Gemini tier detection — no rate limit header found. All headers:`, headerEntries.join("; "));

    return "unknown";
  } catch (err) {
    console.warn("[model-resolver] Gemini tier detection failed:", err);
    return "unknown";
  }
}
