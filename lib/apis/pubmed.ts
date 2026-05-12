/**
 * PubMed API Client (NCBI E-utilities)
 *
 * Free, no API key required for up to 3 requests/second
 * API key recommended for up to 10 requests/second
 * Docs: https://www.ncbi.nlm.nih.gov/books/NBK25499/
 */

import type { AcademicPaper } from "@/lib/types/research";

const ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const ESUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";

export interface PubMedSearchParams {
    query: string;
    limit?: number; // max typically 100-500
    retstart?: number;
    apiKey?: string;
}

/**
 * Search works via PubMed E-utilities
 */
export async function searchPubMed(
    params: PubMedSearchParams
): Promise<AcademicPaper[]> {
    const { query, limit = 100, retstart = 0, apiKey } = params;

    // 1. Search for IDs
    const searchUrl = new URL(ESEARCH_URL);
    searchUrl.searchParams.set("db", "pubmed");
    searchUrl.searchParams.set("term", query);
    searchUrl.searchParams.set("retmode", "json");
    searchUrl.searchParams.set("retstart", retstart.toString());
    searchUrl.searchParams.set("retmax", limit.toString());
    if (apiKey) searchUrl.searchParams.set("api_key", apiKey);

    console.log(`[PubMed] Searching: ${searchUrl.toString()}`);

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) {
        throw new Error(`PubMed Search API error: ${searchRes.statusText}`);
    }
    const searchData = await searchRes.json();
    const idList = searchData.esearchresult?.idlist || [];

    if (idList.length === 0) {
        console.log(`[PubMed] Found 0 papers`);
        return [];
    }

    // 2. Fetch Summaries for those IDs
    const summaryUrl = new URL(ESUMMARY_URL);
    summaryUrl.searchParams.set("db", "pubmed");
    summaryUrl.searchParams.set("id", idList.join(","));
    summaryUrl.searchParams.set("retmode", "json");
    if (apiKey) summaryUrl.searchParams.set("api_key", apiKey);

    const summaryRes = await fetch(summaryUrl.toString());
    if (!summaryRes.ok) {
        throw new Error(`PubMed Summary API error: ${summaryRes.statusText}`);
    }
    const summaryData = await summaryRes.json();
    const resultObj = summaryData.result || {};

    const papers: AcademicPaper[] = [];

    for (const uid of idList) {
        const paperInfo = resultObj[uid];
        if (!paperInfo) continue;

        // Authors
        let authors: string[] = [];
        if (paperInfo.authors && Array.isArray(paperInfo.authors)) {
            authors = paperInfo.authors.map((a: any) => a.name);
        }

        // DOI
        let doi: string | undefined;
        if (paperInfo.articleids) {
            const doiObj = paperInfo.articleids.find((i: any) => i.idtype === "doi");
            if (doiObj) doi = doiObj.value;
        }

        // Year
        let year = 0;
        if (paperInfo.pubdate) {
            const pYear = parseInt(paperInfo.pubdate.substring(0, 4), 10);
            if (!isNaN(pYear)) year = pYear;
        }

        papers.push({
            id: `PUBMED:${uid}`,
            doi: doi,
            title: paperInfo.title,
            // PubMed summary doesn't always contain the abstract. We rely on efetch XML for complete abstracts.
            // Esummary only provides limited info. Often we must scrape Unpaywall/Jina using the DOI.
            abstract: undefined,
            year,
            venue: paperInfo.fulljournalname || paperInfo.source,
            authors: authors,
            url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
            source: "PubMed",
        });
    }

    console.log(`[PubMed] Found ${papers.length} summaries`);
    return papers;
}
