/**
 * arXiv API Client
 *
 * Free, no API key required
 * Docs: https://info.arxiv.org/help/api/index.html
 */

import type { AcademicPaper } from "@/lib/types/research";
import { XMLParser } from "fast-xml-parser";

const BASE_URL = "http://export.arxiv.org/api/query";

export interface ArxivSearchParams {
    query: string;
    limit?: number; // max 100 per page recommended
    start?: number;
    sortBy?: "relevance" | "lastUpdatedDate" | "submittedDate";
    sortOrder?: "ascending" | "descending";
}

/**
 * Search papers via arXiv API
 */
export async function searchArxiv(
    params: ArxivSearchParams
): Promise<AcademicPaper[]> {
    const {
        query,
        limit = 100,
        start = 0,
        sortBy = "relevance",
        sortOrder = "descending",
    } = params;

    const url = new URL(BASE_URL);
    // Simple "all fields" query conversion for now, arXiv expects specific formatted queries
    url.searchParams.set("search_query", `all:"${query}"`);
    url.searchParams.set("start", start.toString());
    url.searchParams.set("max_results", limit.toString());
    url.searchParams.set("sortBy", sortBy);
    url.searchParams.set("sortOrder", sortOrder);

    console.log(`[arXiv] Searching: ${url.toString()}`);

    const response = await fetch(url.toString());

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`arXiv API error (${response.status}): ${errorText}`);
    }

    const xmlData = await response.text();

    // Parse XML response
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text"
    });
    const parsedData = parser.parse(xmlData);

    let entries = parsedData.feed.entry;
    if (!entries) return [];
    if (!Array.isArray(entries)) entries = [entries];

    const papers: AcademicPaper[] = entries.map((entry: any) => {
        // arXiv id usually looks like "http://arxiv.org/abs/2101.12345v1"
        const entryIdUrl = entry.id || "";
        const idMatch = entryIdUrl.match(/abs\/(.+)$/);
        const arxivId = idMatch ? idMatch[1] : entryIdUrl;

        // Authors can be one or an array
        const authorsStrOrArray = entry.author;
        let authors: string[] = [];
        if (Array.isArray(authorsStrOrArray)) {
            authors = authorsStrOrArray.map((a: any) => a.name);
        } else if (authorsStrOrArray && authorsStrOrArray.name) {
            authors = [authorsStrOrArray.name];
        }

        const year = entry.published ? new Date(entry.published).getFullYear() : new Date().getFullYear();

        // Find PDF link
        // e.g. <link title="pdf" href="http://arxiv.org/pdf/2101.12345v1" rel="related" type="application/pdf"/>
        const links = Array.isArray(entry.link) ? entry.link : [entry.link];
        const pdfLink = links.find((l: any) => l["@_title"] === "pdf" || l["@_type"] === "application/pdf");
        const pdfUrl = pdfLink ? pdfLink["@_href"] : undefined;

        // Categories
        const categories = Array.isArray(entry.category) ? entry.category : (entry.category ? [entry.category] : []);
        const fields = categories.map((c: any) => c["@_term"]).filter(Boolean);

        return {
            id: `ARXIV:${arxivId}`,
            title: entry.title ? entry.title.replace(/\n/g, " ").trim() : "Untitled",
            abstract: entry.summary ? entry.summary.replace(/\n/g, " ").trim() : undefined,
            year: year,
            authors: authors,
            url: entryIdUrl,     // landing page url
            // Additional properties we can temporarily attach for Unpaywall usage:
            // We pass the PDF link as a secondary fallback if needed, or we just rely on the landing page URL
            source: "arXiv",
            fields: fields,
        };
    });

    console.log(`[arXiv] Found ${papers.length} papers`);

    return papers;
}
