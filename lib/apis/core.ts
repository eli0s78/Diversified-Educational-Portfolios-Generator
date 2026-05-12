/**
 * CORE API Client (v3)
 *
 * Supports two modes:
 *   1. Authenticated — uses a Bearer API key for higher rate limits.
 *   2. Free tier     — no key required, rate-limited to 1 batch /
 *                      5 single requests per 10 seconds.
 *
 * If an API key is provided but has expired (HTTP 401/403), the client
 * automatically retries the same request on the free tier and returns a
 * `warning` field so the UI can inform the user.
 *
 * Docs: https://core.ac.uk/services/api
 */

import { AcademicPaper } from "../types/research";

const BASE_URL = "https://api.core.ac.uk/v3/search/works";

export interface CoreOptions {
    query: string;
    limit?: number;
}

export interface CoreSearchResult {
    papers: AcademicPaper[];
    /** If present, the UI should surface this message to the user */
    warning?: string;
}

/**
 * Execute a single CORE search request.
 * When `apiKey` is undefined the request is sent anonymously (free tier).
 */
async function executeCoreSearch(
    url: string,
    apiKey?: string
): Promise<Response> {
    const headers: Record<string, string> = {
        Accept: "application/json",
    };

    if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
    }

    return fetch(url, { method: "GET", headers });
}

function mapResults(data: any): AcademicPaper[] {
    const results = data.results || [];
    return results.map((item: any) => {
        const authors = item.authors?.map((a: any) => a.name) || [];
        return {
            id: `core-${item.id}`,
            title: item.title || "Untitled Paper",
            abstract: item.abstract || "",
            authors,
            year: item.publishedDate
                ? new Date(item.publishedDate).getFullYear()
                : item.year || new Date().getFullYear(),
            doi: item.doi || "",
            url: item.downloadUrl || item.sourceFulltextUrls?.[0] || "",
            citationCount: item.citationCount || 0,
            source: "core" as const,
            fullText: item.fullText || undefined,
        };
    });
}

export async function searchCore(
    options: CoreOptions,
    apiKey?: string
): Promise<AcademicPaper[]> {
    const result = await searchCoreWithFallback(options, apiKey);
    return result.papers;
}

/**
 * Search CORE with automatic free-tier fallback.
 *
 * Returns both the papers **and** an optional `warning` string that the
 * caller can surface to the user (e.g. "Your CORE API key has expired").
 */
export async function searchCoreWithFallback(
    options: CoreOptions,
    apiKey?: string
): Promise<CoreSearchResult> {
    const { query, limit = 50 } = options;
    const url = `${BASE_URL}?q=${encodeURIComponent(query)}&limit=${limit}`;

    // ── 1. No key at all → free tier directly ────────────────────
    if (!apiKey) {
        console.log(`[CORE] Searching (free tier, no key): "${query}" (limit: ${limit})`);
        try {
            const response = await executeCoreSearch(url);

            if (!response.ok) {
                throw new Error(`CORE free-tier error (${response.status})`);
            }

            const data = await response.json();
            return { papers: mapResults(data) };
        } catch (error) {
            console.error("[CORE] Free-tier search failed:", error);
            return { papers: [] };
        }
    }

    // ── 2. Key provided → try authenticated first ────────────────
    console.log(`[CORE] Searching (authenticated): "${query}" (limit: ${limit})`);

    try {
        const response = await executeCoreSearch(url, apiKey);

        // Key works → return results normally
        if (response.ok) {
            const data = await response.json();
            return { papers: mapResults(data) };
        }

        // Key rejected (expired / invalid) → fall back to free tier
        if (response.status === 401 || response.status === 403) {
            console.warn(
                `[CORE] API key rejected (HTTP ${response.status}). ` +
                `Falling back to free tier (no key).`
            );

            const fallbackResponse = await executeCoreSearch(url);

            if (!fallbackResponse.ok) {
                throw new Error(
                    `CORE free-tier fallback also failed (${fallbackResponse.status})`
                );
            }

            const data = await fallbackResponse.json();
            return {
                papers: mapResults(data),
                warning:
                    "Your CORE API key appears to have expired. " +
                    "The app has automatically switched to the free tier " +
                    "(1 batch or 5 single requests per 10 seconds). " +
                    "You can clear the expired key in Settings to dismiss this notice.",
            };
        }

        // Other HTTP error
        throw new Error(`CORE API error (${response.status})`);
    } catch (error) {
        console.error("[CORE] Search failed:", error);
        return { papers: [] };
    }
}
