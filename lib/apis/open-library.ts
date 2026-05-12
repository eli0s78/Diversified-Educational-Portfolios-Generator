/**
 * Open Library API Client (Internet Archive)
 *
 * Free, no authentication required.
 * Massive open dataset of books, many with full text "search inside" capabilities or borrow links.
 * Docs: https://openlibrary.org/dev/docs/api/search
 */

import { AcademicPaper } from "../types/research";

const BASE_URL = "https://openlibrary.org/search.json";

export interface OpenLibraryOptions {
    query: string;
    limit?: number;
}

export async function searchOpenLibrary(options: OpenLibraryOptions): Promise<AcademicPaper[]> {
    const { query, limit = 20 } = options;

    try {
        const url = `${BASE_URL}?q=${encodeURIComponent(query)}&limit=${limit}`;

        console.log(`[Open Library] Searching: "${query}" (limit: ${limit})`);

        const response = await fetch(url, { method: "GET" });

        if (!response.ok) {
            throw new Error(`Open Library API error (${response.status})`);
        }

        const data = await response.json();
        const docs = data.docs || [];

        return docs.map((doc: any) => {
            return {
                id: `openlib-${doc.key?.replace("/works/", "") || Math.random().toString(36).substring(7)}`,
                title: doc.title || "Untitled Book",
                abstract: `First published in ${doc.first_publish_year || 'Unknown'}. Editions: ${doc.edition_count || 1}. Subjects: ${(doc.subject || []).slice(0, 5).join(", ")}.`,
                authors: doc.author_name || [],
                year: doc.first_publish_year || new Date().getFullYear(),
                doi: doc.isbn?.[0] || "", // Repurpose DOI field for primary ISBN
                url: doc.key ? `https://openlibrary.org${doc.key}` : "",
                citationCount: 0,
                source: "open-library",
            };
        });
    } catch (error) {
        console.error("[Open Library] Search failed:", error);
        return [];
    }
}
