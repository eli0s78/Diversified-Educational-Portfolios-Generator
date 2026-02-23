/**
 * Bureau of Labor Statistics (BLS) API Client
 *
 * Free tier: 500 daily queries, 25 series per query
 * Docs: https://www.bls.gov/developers/api_signature_v2.htm
 */

const BASE_URL = "https://api.bls.gov/publicAPI/v2";

export interface BLSSeriesData {
  year: string;
  period: string;
  periodName: string;
  value: string;
  footnotes?: Array<{ code: string; text: string }>;
}

export interface BLSSeries {
  seriesID: string;
  data: BLSSeriesData[];
}

export interface BLSResponse {
  status: string;
  responseTime: number;
  message?: string[];
  Results: {
    series: BLSSeries[];
  };
}

/**
 * Get employment and wage data from BLS
 *
 * Common series IDs:
 * - OEWS (Occupational Employment and Wage Statistics): "OEUN..." or "OEUM..."
 * - Employment Projections: "EPU..."
 *
 * Example series ID format:
 * - OEUM000000XXXXXX0 (median annual wage for occupation XXXXXX)
 * - OEUN000000XXXXXX0 (employment estimate for occupation XXXXXX)
 *
 * Occupation code is 6-digit SOC code without hyphen (e.g., "436014" for "43-6014")
 */
export async function getBLSData(
  seriesIds: string[],
  startYear: number,
  endYear: number,
  apiKey?: string
): Promise<BLSSeries[]> {
  if (seriesIds.length > 25) {
    throw new Error("BLS API supports max 25 series per request");
  }

  const requestBody = {
    seriesid: seriesIds,
    startyear: startYear.toString(),
    endyear: endYear.toString(),
    registrationkey: apiKey,
  };

  const response = await fetch(`${BASE_URL}/timeseries/data/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`BLS API error (${response.status}): ${errorText}`);
  }

  const data: BLSResponse = await response.json();

  if (data.status !== "REQUEST_SUCCEEDED") {
    const errorMsg = data.message?.join("; ") || "Unknown error";
    throw new Error(`BLS API request failed: ${errorMsg}`);
  }

  return data.Results?.series || [];
}

/**
 * Convert SOC code to BLS format (remove hyphen)
 * Example: "43-6014" → "436014"
 */
export function socToBLS(socCode: string): string {
  return socCode.replace(/-/g, "");
}

/**
 * Get median wage series ID for occupation
 * Example: "43-6014" → "OEUM000000436014000000004"
 */
export function getWageSeriesId(socCode: string): string {
  const blsCode = socToBLS(socCode);
  return `OEUM000000${blsCode}000000004`; // 4 = median annual wage
}

/**
 * Get employment series ID for occupation
 * Example: "43-6014" → "OEUN000000436014000000001"
 */
export function getEmploymentSeriesId(socCode: string): string {
  const blsCode = socToBLS(socCode);
  return `OEUN000000${blsCode}000000001`; // 1 = employment estimate
}

/**
 * Parse BLS series data for latest value
 */
export function getLatestValue(series: BLSSeries): number | null {
  if (!series.data || series.data.length === 0) {
    return null;
  }

  // BLS data is sorted most recent first
  const latest = series.data[0];
  const value = parseFloat(latest.value);

  return isNaN(value) ? null : value;
}

/**
 * Parse BLS series data for trend (historical values)
 */
export function getTrend(series: BLSSeries): Array<{ year: number; value: number }> {
  if (!series.data || series.data.length === 0) {
    return [];
  }

  return series.data
    .map((d) => ({
      year: parseInt(d.year, 10),
      value: parseFloat(d.value),
    }))
    .filter((d) => !isNaN(d.year) && !isNaN(d.value))
    .sort((a, b) => a.year - b.year);
}
