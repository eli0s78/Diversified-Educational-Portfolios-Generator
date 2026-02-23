/**
 * Eurostat API Client
 *
 * Free, no API key required
 * Docs: https://ec.europa.eu/eurostat/web/json-and-unicode-web-services/getting-started/rest-request
 */

const BASE_URL = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";

export interface EurostatDimension {
  label: string;
  category: {
    index: Record<string, number>;
    label: Record<string, string>;
  };
}

export interface EurostatDataset {
  version: string;
  label: string;
  source: string;
  updated: string;
  id: string[];
  size: number[];
  dimension: Record<string, EurostatDimension>;
  value: Record<string, number>;
}

/**
 * Get employment data by occupation (ISCO-08)
 *
 * Dataset: lfsa_egais (Employment by sex, age and occupation (ISCO-08))
 */
export async function getEurostatEmploymentByOccupation(
  iscoCode: string, // e.g., "4" for clerical support workers
  year?: number
): Promise<EurostatDataset | null> {
  // ISCO-08 major groups: 1-9 (single digit), or 11-96 (two digits)
  const dataset = "lfsa_egais";

  // Build filter: isco08 (occupation), geo (country), time (year)
  const filters: string[] = [];
  filters.push(`isco08=${iscoCode}`);
  filters.push("geo=EU27_2020"); // EU27 aggregate
  filters.push("sex=T"); // Total (both sexes)
  filters.push("age=Y15-64"); // Working age population

  if (year) {
    filters.push(`time=${year}`);
  }

  const url = `${BASE_URL}/${dataset}?${filters.join("&")}`;

  try {
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`Eurostat API warning (${response.status}) for dataset ${dataset}`);
      return null;
    }

    const data: EurostatDataset = await response.json();
    return data;
  } catch (error) {
    console.error("Eurostat API error:", error);
    return null;
  }
}

/**
 * Get wage data (if available)
 *
 * Note: Eurostat doesn't have comprehensive wage data by occupation.
 * Use national statistical agencies for more detailed data.
 */
export async function getEurostatWageData(
  iscoCode: string
): Promise<EurostatDataset | null> {
  // Eurostat wage data is limited and often country-specific
  // This is a placeholder for future enhancement
  console.warn("Eurostat wage data by occupation is limited. Use national sources.");
  return null;
}

/**
 * Parse Eurostat dataset value
 *
 * The value object has keys like "0:0:0:0" that correspond to dimension indices
 */
export function parseEurostatValue(
  dataset: EurostatDataset,
  dimensionValues: Record<string, string>
): number | null {
  if (!dataset.value || Object.keys(dataset.value).length === 0) {
    return null;
  }

  // Build key from dimension indices
  // This is a simplified parser - full implementation would need dimension mapping
  const firstKey = Object.keys(dataset.value)[0];
  const value = dataset.value[firstKey];

  return value !== null && value !== undefined ? value : null;
}

/**
 * Get latest employment value from dataset
 */
export function getLatestEmploymentValue(dataset: EurostatDataset | null): number | null {
  if (!dataset || !dataset.value) {
    return null;
  }

  // Get all values and find maximum (latest/total)
  const values = Object.values(dataset.value).filter((v) => v !== null);

  if (values.length === 0) {
    return null;
  }

  // For employment data, typically we want the sum or latest
  return Math.max(...values);
}

/**
 * Map ISCO-08 code levels
 *
 * ISCO-08 has 4 levels:
 * - Level 1: Major groups (1 digit) - e.g., "4" = Clerical support workers
 * - Level 2: Sub-major groups (2 digits) - e.g., "41" = General and keyboard clerks
 * - Level 3: Minor groups (3 digits) - e.g., "411" = General office clerks
 * - Level 4: Unit groups (4 digits) - e.g., "4110" = General office clerks
 */
export function getISCOMajorGroup(iscoCode: string): string {
  return iscoCode.substring(0, 1);
}

export function getISCOSubMajorGroup(iscoCode: string): string {
  return iscoCode.substring(0, 2);
}

export function getISCOMinorGroup(iscoCode: string): string {
  return iscoCode.substring(0, 3);
}
