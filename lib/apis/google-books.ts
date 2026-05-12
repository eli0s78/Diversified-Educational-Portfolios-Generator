/**
 * Google Books API Client
 *
 * Free, optionally requires an API key for higher rate limits.
 * Excellent for finding textbooks and reference books.
 * Docs: https://developers.google.com/books/docs/v1/reference/volumes/list
 */

import { AcademicPaper } from "../types/research";

const BASE_URL = "https://www.googleapis.com/books/v1/volumes";

export interface GoogleBooksOptions {
    query: string;
    limit?: number;
    freeOnly?: boolean;
}

export async function searchGoogleBooks(options: GoogleBooksOptions, apiKey?: string): Promise<AcademicPaper[]> {
    const { query, limit = 20, freeOnly = false } = options;

    try {
        let url = `${BASE_URL}?q=${encodeURIComponent(query)}&maxResults=${Math.min(limit, 40)}`;
        if (freeOnly) {
            url += "&filter=free-ebooks";
        }
        if (apiKey) {
            url += `&key=${apiKey}`;
        }

        console.log(`[Google Books] Searching: "${query}" (limit: ${limit}, freeOnly: ${freeOnly})`);

        const response = await fetch(url, { method: "GET" });

        if (!response.ok) {
            throw new Error(`Google Books API error (${response.status})`);
        }

        const data = await response.json();
        const items = data.items || [];

        return items.map((item: any) => {
            const vol = item.volumeInfo || {};
            const access = item.accessInfo || {};

            return {
                id: `gbooks-${item.id}`,
                title: vol.title || "Untitled Book",
                abstract: vol.description || "",
                authors: vol.authors || [],
                year: vol.publishedDate ? parseInt(vol.publishedDate.substring(0, 4), 10) : new Date().getFullYear(),
                doi: vol.industryIdentifiers?.find((id: any) => id.type === "ISBN_13")?.identifier || "", // Repurpose DOI field for ISBN
                url: access.webReaderLink || vol.previewLink || vol.infoLink || "",
                citationCount: 0,
                source: "google-books",
                // Extra metadata we can sneak in the fullText string as markdown frontmatter, 
                // or just rely on the abstract description.
            };
        });
    } catch (error) {
        console.error("[Google Books] Search failed:", error);
        return [];
    }
}
