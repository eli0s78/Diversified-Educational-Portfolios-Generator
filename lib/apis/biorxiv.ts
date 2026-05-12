/**
 * bioRxiv / medRxiv API Client
 *
 * Free, no authentication required.
 * Searches life/health sciences preprints.
 * Docs: https://api.biorxiv.org/
 */

import { AcademicPaper } from "../types/research";

const BASE_URL = "https://api.biorxiv.org/details";

export interface BiorxivOptions {
    server?: "biorxiv" | "medrxiv";
    fromYear: number;
    toYear: number;
}

export async function fetchBiorxivDates(options: BiorxivOptions): Promise<AcademicPaper[]> {
    const { server = "biorxiv", fromYear, toYear } = options;

    // The API expects dates in YYYY-MM-DD format
    // For a broad search, we'll search across the requested years
    const fromDate = `${fromYear}-01-01`;
    const toDate = `${toYear}-12-31`;

    try {
        // Note: The /details endpoint does not support keyword search natively. 
        // We fetch by date range, then the pipeline filters down by text if needed.
        // For efficiency, we just grab exactly 100 recent papers in the timeframe since
        // fetching *all* papers in a 5-year span is millions of records.
        // In a real production architecture where keyword search is mandatory, 
        // Europe PMC inherently handles bioRxiv keyword search better anyway.
        // But for direct server access, we hit the recent 100.
        const url = `${BASE_URL}/${server}/${fromDate}/${toDate}/0`;

        console.log(`[${server}] Fetching recent preprints...`);

        const response = await fetch(url, {
            method: "GET",
        });

        if (!response.ok) {
            throw new Error(`${server} API error (${response.status})`);
        }

        const data = await response.json();

        // Grab up to 100 maximum from the response collection.
        const results = (data.collection || []).slice(0, 100);

        return results.map((item: any) => {
            return {
                id: `${server}-${item.doi}`,
                title: item.title || "Untitled Preprint",
                abstract: item.abstract || "",
                authors: item.authors ? item.authors.split("; ") : [],
                year: item.date ? parseInt(item.date.split("-")[0], 10) : new Date().getFullYear(),
                doi: item.doi || "",
                url: `https://www.${server}.org/content/${item.doi}v${item.version}`,
                citationCount: 0, // Not provided by this API
                source: server,
            };
        });
    } catch (error) {
        console.error(`[${server}] Fetch failed:`, error);
        return [];
    }
}
