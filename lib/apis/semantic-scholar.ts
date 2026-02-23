/**
 * Semantic Scholar API Client
 *
 * Free tier: 1 request/second, 100 requests/5 minutes
 * Docs: https://api.semanticscholar.org/api-docs/
 */

import type { AcademicPaper } from "@/lib/types/research";

const BASE_URL = "https://api.semanticscholar.org/graph/v1";

export interface SemanticScholarSearchParams {
  query: string;
  limit?: number; // max 100 per request
  offset?: number;
  fields?: string[];
  year?: string; // e.g., "2020-2024"
  minCitationCount?: number;
  publicationTypes?: string[]; // e.g., ["JournalArticle", "Conference"]
}

export interface SemanticScholarPaper {
  paperId: string;
  externalIds?: {
    DOI?: string;
    ArXiv?: string;
    PubMed?: string;
  };
  title: string;
  abstract?: string;
  year?: number;
  venue?: string;
  authors?: Array<{
    authorId: string;
    name: string;
  }>;
  url?: string;
  citationCount?: number;
  referenceCount?: number;
  influentialCitationCount?: number;
  fieldsOfStudy?: string[];
}

/**
 * Search papers via Semantic Scholar API
 */
export async function searchSemanticScholar(
  params: SemanticScholarSearchParams,
  apiKey?: string
): Promise<AcademicPaper[]> {
  const {
    query,
    limit = 100,
    offset = 0,
    fields = [
      "paperId",
      "externalIds",
      "title",
      "abstract",
      "year",
      "venue",
      "authors",
      "url",
      "citationCount",
      "referenceCount",
      "influentialCitationCount",
      "fieldsOfStudy",
    ],
    year,
    minCitationCount,
    publicationTypes,
  } = params;

  const url = new URL(`${BASE_URL}/paper/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("offset", offset.toString());
  url.searchParams.set("fields", fields.join(","));

  if (year) {
    url.searchParams.set("year", year);
  }
  if (minCitationCount !== undefined) {
    url.searchParams.set("minCitationCount", minCitationCount.toString());
  }
  if (publicationTypes && publicationTypes.length > 0) {
    url.searchParams.set("publicationTypes", publicationTypes.join(","));
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const response = await fetch(url.toString(), { headers });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Semantic Scholar API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const papers: SemanticScholarPaper[] = data.data || [];

  return papers.map(convertToAcademicPaper);
}

/**
 * Convert Semantic Scholar paper to AcademicPaper format
 */
function convertToAcademicPaper(paper: SemanticScholarPaper): AcademicPaper {
  return {
    id: `SEMANTIC_SCHOLAR:${paper.paperId}`,
    doi: paper.externalIds?.DOI,
    title: paper.title,
    abstract: paper.abstract,
    year: paper.year || 0,
    venue: paper.venue,
    authors: paper.authors?.map((a) => a.name) || [],
    url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
    source: "Semantic Scholar",
    fields: paper.fieldsOfStudy,
    citationCount: paper.citationCount,
    referenceCount: paper.referenceCount,
    influentialCitationCount: paper.influentialCitationCount,
  };
}

/**
 * Rate limiting helper: delay to respect 1 req/sec limit
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
