/**
 * Crossref API Client
 *
 * Free, no authentication required.
 * Generous rate limits when an email is provided in the `mailto` parameter (Polite Pool).
 * Docs: https://api.crossref.org/swagger-ui/index.html
 */

import { AcademicPaper } from "../types/research";

const BASE_URL = "https://api.crossref.org/works";
const MAILTO = "eli0s@yahoo.com";

export interface CrossrefOptions {
    query: string;
    limit?: number;
    offset?: number;
}

export async function searchCrossref(options: CrossrefOptions): Promise<AcademicPaper[]> {
    const { query, limit = 50, offset = 0 } = options;

    try {
        const url = `${BASE_URL}?query=${encodeURIComponent(query)}&rows=${limit}&offset=${offset}&mailto=${encodeURIComponent(MAILTO)}`;

        console.log(`[Crossref] Searching: "${query}" (limit: ${limit})`);

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json",
            }
        });

        if (!response.ok) {
            throw new Error(`Crossref API error (${response.status})`);
        }

        const data = await response.json();
        const items = data.message?.items || [];

        return items.map((item: any) => {
            // Extract authors
            const authors = item.author?.map((auth: any) => {
                if (auth.family && auth.given) {
                    return `${auth.given} ${auth.family}`;
                }
                return auth.family || auth.name || "Unknown Author";
            }) || [];

            return {
                id: item.DOI ? `crossref-${item.DOI}` : `crossref-${Math.random().toString(36).substring(7)}`,
                title: item.title?.[0] || "Untitled Work",
                abstract: item.abstract || "",
                authors,
                year: item.published?.["date-parts"]?.[0]?.[0] || item.created?.["date-parts"]?.[0]?.[0] || new Date().getFullYear(),
                doi: item.DOI || "",
                url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : ""),
                citationCount: item["is-referenced-by-count"] || 0,
                source: "crossref",
            };
        });
    } catch (error) {
        console.error("[Crossref] Search failed:", error);
        return [];
    }
}
