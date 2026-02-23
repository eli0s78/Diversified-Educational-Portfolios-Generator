/**
 * OpenAlex API Client
 *
 * Free, no API key required
 * Polite pool: 100,000 requests/day (requires email in User-Agent)
 * Docs: https://docs.openalex.org/
 */

import type { AcademicPaper } from "@/lib/types/research";

const BASE_URL = "https://api.openalex.org";
const USER_AGENT = "mailto:eli0s@yahoo.com"; // Required for polite pool

export interface OpenAlexSearchParams {
  query: string;
  limit?: number; // max 200 per page
  page?: number;
  fromYear?: number;
  toYear?: number;
  minCitationCount?: number;
  openAccessOnly?: boolean;
}

export interface OpenAlexWork {
  id: string;
  doi?: string;
  title?: string;
  display_name?: string;
  publication_year?: number;
  abstract_inverted_index?: Record<string, number[]>;
  host_venue?: {
    display_name?: string;
  };
  authorships?: Array<{
    author?: {
      display_name?: string;
    };
  }>;
  cited_by_count?: number;
  referenced_works_count?: number;
  concepts?: Array<{
    display_name?: string;
    level?: number;
  }>;
}

/**
 * Search works via OpenAlex API
 */
export async function searchOpenAlex(
  params: OpenAlexSearchParams
): Promise<AcademicPaper[]> {
  const {
    query,
    limit = 100,
    page = 1,
    fromYear,
    toYear,
    minCitationCount,
    openAccessOnly = false,
  } = params;

  // Build filter string
  const filters: string[] = [];

  // Search in title and abstract
  filters.push(`default.search:${encodeURIComponent(query)}`);

  if (fromYear && toYear) {
    filters.push(`publication_year:${fromYear}-${toYear}`);
  } else if (fromYear) {
    filters.push(`publication_year:>=${fromYear}`);
  } else if (toYear) {
    filters.push(`publication_year:<=${toYear}`);
  }

  if (minCitationCount !== undefined) {
    filters.push(`cited_by_count:>=${minCitationCount}`);
  }

  if (openAccessOnly) {
    filters.push(`is_oa:true`);
  }

  const url = new URL(`${BASE_URL}/works`);
  url.searchParams.set("filter", filters.join(","));
  url.searchParams.set("per-page", Math.min(limit, 200).toString());
  url.searchParams.set("page", page.toString());

  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json",
  };

  const response = await fetch(url.toString(), { headers });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAlex API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const works: OpenAlexWork[] = data.results || [];

  return works.map(convertToAcademicPaper);
}

/**
 * Convert OpenAlex work to AcademicPaper format
 */
function convertToAcademicPaper(work: OpenAlexWork): AcademicPaper {
  const openalexId = work.id.split("/").pop() || "";

  // Reconstruct abstract from inverted index
  let abstract: string | undefined;
  if (work.abstract_inverted_index) {
    abstract = reconstructAbstract(work.abstract_inverted_index);
  }

  // Extract DOI
  let doi: string | undefined;
  if (work.doi) {
    doi = work.doi.replace("https://doi.org/", "");
  }

  return {
    id: `OPENALEX:${openalexId}`,
    doi,
    title: work.display_name || work.title || "Untitled",
    abstract,
    year: work.publication_year || 0,
    venue: work.host_venue?.display_name,
    authors: work.authorships?.map((a) => a.author?.display_name || "Unknown") || [],
    url: work.id,
    source: "OpenAlex",
    fields: work.concepts
      ?.filter((c) => c.level === 0 || c.level === 1)
      .map((c) => c.display_name || "")
      .filter(Boolean),
    citationCount: work.cited_by_count,
    referenceCount: work.referenced_works_count,
  };
}

/**
 * Reconstruct abstract from inverted index
 * OpenAlex stores abstracts as inverted index: { "word": [positions] }
 */
function reconstructAbstract(invertedIndex: Record<string, number[]>): string {
  const words: Array<{ word: string; position: number }> = [];

  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words.push({ word, position: pos });
    }
  }

  // Sort by position and join
  words.sort((a, b) => a.position - b.position);
  return words.map((w) => w.word).join(" ");
}
