/**
 * Unpaywall API Client (Open Access Resolver)
 *
 * Free, requires email in query parameter.
 * Docs: https://unpaywall.org/products/api
 */

const BASE_URL = "https://api.unpaywall.org/v2";
const EMAIL = "eli0s@yahoo.com"; // Required by Unpaywall

export interface UnpaywallResponse {
    doi: string;
    is_oa: boolean;
    oa_status: "gold" | "green" | "hybrid" | "bronze" | "closed";
    title: string;
    best_oa_location: {
        url_for_pdf?: string;
        url_for_landing_page?: string;
        version: "submittedVersion" | "acceptedVersion" | "publishedVersion";
        host_type: "publisher" | "repository";
    } | null;
}

export interface OAOptions {
    doi: string;
}

/**
 * Get Open Access links for a DOI via Unpaywall
 */
export async function getOpenAccessInfo(
    params: OAOptions
): Promise<UnpaywallResponse | null> {
    const { doi } = params;

    if (!doi) return null;

    try {
        const url = `${BASE_URL}/${encodeURIComponent(doi)}?email=${encodeURIComponent(EMAIL)}`;
        console.log(`[Unpaywall] Checking DOI: ${doi}`);

        const response = await fetch(url, {
            method: "GET",
        });

        if (!response.ok) {
            if (response.status === 404) {
                return null; // DOI not found in Unpaywall database
            }
            throw new Error(`Unpaywall API error (${response.status})`);
        }

        const data = await response.json();
        return data as UnpaywallResponse;
    } catch (error) {
        console.warn(`[Unpaywall] Failed to check DOI ${doi}:`, error);
        return null;
    }
}
