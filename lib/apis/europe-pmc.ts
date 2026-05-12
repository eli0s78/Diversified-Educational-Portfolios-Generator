/**
 * Europe PMC API Client
 *
 * Free, no authentication required.
 * Supersedes PubMed by indexing PubMed Central, PubMed, and 20+ preprint servers.
 * Docs: https://europepmc.org/RestfulWebService
 */

import { AcademicPaper } from "../types/research";

const BASE_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";

export interface EuropePMCOptions {
    query: string;
    limit?: number;
}

export async function searchEuropePMC(options: EuropePMCOptions): Promise<AcademicPaper[]> {
    const { query, limit = 50 } = options;

    try {
        // format=json ensures we get JSON back, resultType=core gives us abstracts
        const url = `${BASE_URL}?query=${encodeURIComponent(query)}&format=json&resultType=core&pageSize=${limit}`;

        console.log(`[Europe PMC] Searching: "${query}" (limit: ${limit})`);

        const response = await fetch(url, {
            method: "GET",
        });

        if (!response.ok) {
            throw new Error(`Europe PMC API error (${response.status})`);
        }

        const data = await response.json();
        const results = data.resultList?.result || [];

        return results.map((item: any) => {
            return {
                id: item.pmid ? `epmc-pmid-${item.pmid}` : item.pmcid ? `epmc-${item.pmcid}` : `epmc-${Math.random().toString(36).substring(7)}`,
                title: item.title || "Untitled Paper",
                abstract: item.abstractText || "",
                authors: item.authorString ? item.authorString.split(", ") : [],
                year: item.pubYear ? parseInt(item.pubYear, 10) : new Date().getFullYear(),
                doi: item.doi || "",
                url: item.pmcid ? `https://europepmc.org/article/PMC/${item.pmcid}` : (item.doi ? `https://doi.org/${item.doi}` : ""),
                citationCount: item.citedByCount || 0,
                source: "europe-pmc",
                pmcid: item.pmcid || undefined, // Useful for the BioC full-text extractor
            };
        });
    } catch (error) {
        console.error("[Europe PMC] Search failed:", error);
        return [];
    }
}
