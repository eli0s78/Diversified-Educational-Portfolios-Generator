/**
 * SEC EDGAR Full-Text Search API Client
 *
 * Free, requires User-Agent identifying application and email
 * Docs: https://www.sec.gov/os/accessing-edgar-data
 */

const BASE_URL = "https://efts.sec.gov/LATEST/search-index";

export interface EdgarSearchResult {
    ciks: string[];
    entityName: string;
    formType: string;
    fileDate: string;
    hits: {
        fragments: string[];
    };
}

/**
 * Searches 10-K filings for mentions of specific keywords/occupations
 */
export async function searchEdgar10K(
    query: string
): Promise<EdgarSearchResult[]> {
    try {
        // Looking for 10-K filings from the last 2 years 
        // with the target keyword in the document
        const currentYear = new Date().getFullYear();
        const requestBody = {
            q: `"${query}"`,
            dateRange: "custom",
            startdt: `${currentYear - 2}-01-01`,
            enddt: `${currentYear}-12-31`,
            forms: ["10-K"],
            // Limit to a few top hits
            from: 0,
            size: 5
        };

        console.log(`[EDGAR] Searching 10-Ks for: ${query}`);

        const response = await fetch(BASE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // SEC requires a defined User-Agent
                "User-Agent": "DiversifiedEducationalPortfoliosGenerator/1.0 (contact: admin@example.com)",
                "Accept": "application/json"
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            console.warn(`[EDGAR] API error (${response.status})`);
            return [];
        }

        const data = await response.json();

        if (!data.hits || !data.hits.hits) {
            return [];
        }

        return data.hits.hits.map((hit: any) => ({
            ciks: hit._source.ciks,
            entityName: hit._source.display_names[0] || "Unknown Entity",
            formType: hit._source.form,
            fileDate: hit._source.file_date,
            hits: {
                fragments: hit.highlight ? Object.values(hit.highlight).flat() : []
            }
        }));

    } catch (error) {
        console.warn(`[EDGAR] Failed to search:`, error);
        return [];
    }
}
