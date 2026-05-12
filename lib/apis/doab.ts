/**
 * DOAB API Client (Directory of Open Access Books)
 *
 * Free, no authentication required.
 * Indexes peer-reviewed open access academic books.
 * Docs: https://directory.doabooks.org/
 */

import { AcademicPaper } from "../types/research";

const BASE_URL = "https://directory.doabooks.org/rest/search";

export interface DOABOptions {
    query: string;
    limit?: number;
}

export async function searchDOAB(options: DOABOptions): Promise<AcademicPaper[]> {
    const { query, limit = 20 } = options;

    try {
        const url = `${BASE_URL}?query=${encodeURIComponent(query)}&expand=metadata&limit=${limit}`;

        console.log(`[DOAB] Searching: "${query}" (limit: ${limit})`);

        // DOAB returns JSON if accept header is set
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`DOAB API error (${response.status})`);
        }

        const data = await response.json();
        // The REST payload has items in an array under root or under a specific key depending on content neg.
        const items = Array.isArray(data) ? data : (data.items || []);

        return items.map((item: any) => {
            // Find metadata fields
            const md = item.metadata || [];

            const getField = (key: string) => {
                const f = md.find((m: any) => m.key === key);
                return f ? f.value : "";
            };

            const getFields = (key: string) => {
                return md.filter((m: any) => m.key === key).map((m: any) => m.value);
            };

            const title = getField("dc.title") || "Untitled OA Book";
            const abstract = getField("dc.description.abstract") || getField("dc.description") || "";
            const authors = getFields("dc.contributor.author");
            const dateStr = getField("dc.date.issued");
            const year = dateStr ? parseInt(dateStr.substring(0, 4), 10) : new Date().getFullYear();
            const identifier = getField("dc.identifier.doi") || getField("dc.identifier.isbn") || "";

            // Link to the handle page
            const handle = item.handle ? `https://directory.doabooks.org/handle/${item.handle}` : "";

            return {
                id: `doab-${item.id || item.uuid || Math.random().toString(36).substring(7)}`,
                title,
                abstract,
                authors: authors.length > 0 ? authors : getFields("dc.contributor.editor"), // fallback to editors
                year,
                doi: identifier,
                url: handle,
                citationCount: 0,
                source: "doab",
            };
        });
    } catch (error) {
        console.error("[DOAB] Search failed:", error);
        return [];
    }
}
