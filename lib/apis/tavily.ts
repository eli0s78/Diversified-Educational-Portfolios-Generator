/**
 * Tavily API Client
 *
 * Free tier: 1,000 requests/month
 * Docs: https://docs.tavily.com/
 */

const BASE_URL = "https://api.tavily.com";

export interface TavilySearchParams {
  query: string;
  search_depth?: "basic" | "advanced";
  max_results?: number;
  include_domains?: string[];
  exclude_domains?: string[];
  include_answer?: boolean;
  include_raw_content?: boolean;
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  raw_content?: string;
  score: number;
  published_date?: string;
}

export interface TavilySearchResponse {
  query: string;
  answer?: string;
  results: TavilyResult[];
  response_time: number;
}

/**
 * Search the web using Tavily API
 */
export async function searchTavily(
  params: TavilySearchParams,
  apiKey: string
): Promise<TavilySearchResponse> {
  const {
    query,
    search_depth = "advanced",
    max_results = 5,
    include_domains,
    exclude_domains,
    include_answer = false,
    include_raw_content = true,
  } = params;

  const requestBody = {
    api_key: apiKey,
    query,
    search_depth,
    max_results,
    include_domains,
    exclude_domains,
    include_answer,
    include_raw_content,
  };

  const response = await fetch(`${BASE_URL}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Extract key technologies and trends from Tavily results
 */
export function extractTechnologies(results: TavilyResult[]): string[] {
  const technologies = new Set<string>();

  // Common technology keywords to look for
  const techKeywords = [
    "AI", "artificial intelligence", "machine learning", "ML",
    "automation", "robotics", "IoT", "Internet of Things",
    "cloud", "blockchain", "big data", "analytics",
    "digital transformation", "Industry 4.0", "smart",
    "sensor", "drone", "3D printing", "BIM", "CAD",
    "ERP", "CRM", "software", "platform", "system",
  ];

  for (const result of results) {
    const text = `${result.title} ${result.content}`.toLowerCase();

    for (const keyword of techKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        technologies.add(keyword);
      }
    }
  }

  return Array.from(technologies);
}

/**
 * Build search query for occupation trends
 */
export function buildTrendsQuery(occupation: string, aspect: "technology" | "trends" | "skills"): string {
  const year = new Date().getFullYear();

  switch (aspect) {
    case "technology":
      return `${occupation} technology trends ${year}`;
    case "trends":
      return `${occupation} industry trends ${year}`;
    case "skills":
      return `${occupation} emerging skills ${year}`;
    default:
      return `${occupation} ${aspect}`;
  }
}
