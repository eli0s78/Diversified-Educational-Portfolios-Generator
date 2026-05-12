/**
 * FRED (Federal Reserve Economic Data) API Client
 *
 * Free, requires API key
 * Docs: https://fred.stlouisfed.org/docs/api/fred/
 */

const BASE_URL = "https://api.stlouisfed.org/fred";

export interface FredObservation {
    date: string;
    value: string;
}

export interface FredSeriesData {
    seriesId: string;
    title: string;
    observations: FredObservation[];
}

/**
 * Helper to determine which macro series to pull based on sector
 */
export function getRelevantFredSeries(occupation: string, keywords: string[]): string[] {
    const genericSeries = ["UNRATE", "GDP"]; // Unemployment and GDP
    const lowerOc = occupation.toLowerCase();
    const lowerKw = keywords.map(k => k.toLowerCase()).join(" ");
    const combined = lowerOc + " " + lowerKw;

    if (combined.includes("health") || combined.includes("medic")) {
        return [...genericSeries, "HLTHPRVD"]; // Employment in Healthcare
    }
    if (combined.includes("tech") || combined.includes("software") || combined.includes("data")) {
        return [...genericSeries, "CES5000000001"]; // Information Services Employment
    }
    if (combined.includes("finance") || combined.includes("bank")) {
        return [...genericSeries, "USGO15YR"]; // Financial metrics
    }
    if (combined.includes("manufactur")) {
        return [...genericSeries, "OUTMS"]; // Manufacturing output
    }

    return genericSeries;
}

/**
 * Fetch observations for a given FRED series
 */
export async function getFredSeries(
    seriesId: string,
    apiKey: string,
    limit: number = 12 // last 12 observations (months/quarters)
): Promise<FredSeriesData | null> {
    if (!apiKey) return null;

    try {
        // 1. Get Series Info
        const infoUrl = `${BASE_URL}/series?series_id=${seriesId}&api_key=${apiKey}&file_type=json`;
        const infoRes = await fetch(infoUrl);
        if (!infoRes.ok) return null;
        const infoData = await infoRes.json();
        const title = infoData.seriess && infoData.seriess[0] ? infoData.seriess[0].title : seriesId;

        // 2. Get Observations (sort descending, limit to N)
        const obsUrl = `${BASE_URL}/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`;
        console.log(`[FRED] Fetching series: ${seriesId}`);

        const obsRes = await fetch(obsUrl);
        if (!obsRes.ok) return null;
        const obsData = await obsRes.json();

        if (!obsData.observations) return null;

        return {
            seriesId,
            title,
            // Reverse so it's chronological (oldest to newest)
            observations: obsData.observations.reverse().map((o: any) => ({
                date: o.date,
                value: o.value
            }))
        };
    } catch (error) {
        console.warn(`[FRED] Failed to fetch series ${seriesId}:`, error);
        return null;
    }
}
