/**
 * PMC BioC Full-Text API Client
 *
 * Free, no authentication required.
 * Retrieves structured XML/JSON full text for Open Access articles in PubMed Central.
 * Docs: https://www.ncbi.nlm.nih.gov/research/bionlp/APIs/BioC-PMC/
 */

const BASE_URL = "https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi/BioC_json";

/**
 * Given a PMCID (e.g., "PMC8383212"), retrieves its structured full-text paragraphs.
 */
export async function getPMCFullText(pmcid: string): Promise<string | null> {
    if (!pmcid) return null;

    // Normalizing pmcid. Sometimes they have 'PMC' prefix, sometimes not. The API needs the prefix.
    const normalizedId = pmcid.toUpperCase().startsWith("PMC") ? pmcid.toUpperCase() : `PMC${pmcid}`;

    try {
        const url = `${BASE_URL}/${encodeURIComponent(normalizedId)}/unicode`;
        console.log(`[PMC BioC] Fetching formal full text for: ${normalizedId}`);

        const response = await fetch(url, {
            method: "GET",
        });

        if (!response.ok) {
            if (response.status === 404) {
                return null; // Article not in Open Access subset
            }
            throw new Error(`PMC BioC error (${response.status})`);
        }

        // Response is an array of documents (usually length 1)
        const docArray = await response.json();
        if (!docArray || docArray.length === 0) return null;

        const doc = docArray[0];
        if (!doc.passages || !Array.isArray(doc.passages)) return null;

        // Extract and combine the text blocks
        const texts = doc.passages
            .filter((p: any) => p.text)
            .map((p: any) => {
                // If it's a section title, give it markdown heading formatting
                if (p.infons?.section_type && p.infons?.type === "title") {
                    return `### ${p.text}\n\n`;
                }
                return `${p.text}\n\n`;
            });

        const fullText = texts.join("").trim();
        return fullText.length > 50 ? fullText : null;
    } catch (error) {
        console.error(`[PMC BioC] Failed to retrieve ${normalizedId}:`, error);
        return null; // Graceful failure
    }
}
