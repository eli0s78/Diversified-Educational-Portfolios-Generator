/**
 * Firecrawl API Client
 *
 * Free tier: 500 credits/month
 * Docs: https://docs.firecrawl.dev/
 */

const BASE_URL = "https://api.firecrawl.dev/v0";

export interface FirecrawlScrapeParams {
  url: string;
  formats?: Array<"markdown" | "html" | "rawHtml" | "screenshot">;
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  waitFor?: number;
}

export interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    rawHtml?: string;
    screenshot?: string;
    metadata?: {
      title?: string;
      description?: string;
      language?: string;
      sourceURL?: string;
    };
  };
  error?: string;
}

export interface FirecrawlCrawlParams {
  url: string;
  limit?: number;
  scrapeOptions?: Omit<FirecrawlScrapeParams, "url">;
}

export interface FirecrawlCrawlResponse {
  success: boolean;
  jobId?: string;
  error?: string;
}

/**
 * Scrape a single URL using Firecrawl
 */
export async function scrapeWithFirecrawl(
  params: FirecrawlScrapeParams,
  apiKey: string
): Promise<FirecrawlScrapeResponse> {
  const {
    url,
    formats = ["markdown"],
    onlyMainContent = true,
    includeTags,
    excludeTags,
    waitFor,
  } = params;

  const requestBody = {
    url,
    formats,
    onlyMainContent,
    includeTags,
    excludeTags,
    waitFor,
  };

  const response = await fetch(`${BASE_URL}/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Crawl multiple pages starting from a URL
 */
export async function crawlWithFirecrawl(
  params: FirecrawlCrawlParams,
  apiKey: string
): Promise<FirecrawlCrawlResponse> {
  const { url, limit = 10, scrapeOptions } = params;

  const requestBody = {
    url,
    limit,
    scrapeOptions,
  };

  const response = await fetch(`${BASE_URL}/crawl`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Extract key insights from scraped content
 */
export function extractInsights(markdown: string): {
  technologies: string[];
  trends: string[];
  skills: string[];
} {
  const technologies = new Set<string>();
  const trends = new Set<string>();
  const skills = new Set<string>();

  // Technology patterns
  const techPatterns = [
    /\b(AI|artificial intelligence|machine learning|ML|deep learning)\b/gi,
    /\b(automation|robotics|IoT|blockchain|cloud)\b/gi,
    /\b(BIM|CAD|ERP|CRM|software|platform)\b/gi,
    /\b(sensor|drone|3D printing|digital twin)\b/gi,
  ];

  // Trend patterns
  const trendPatterns = [
    /\b(digital transformation|Industry 4\.0|sustainability)\b/gi,
    /\b(circular economy|green technology|renewable)\b/gi,
    /\b(remote work|hybrid|distributed)\b/gi,
  ];

  // Skill patterns
  const skillPatterns = [
    /\b(programming|coding|data analysis|analytics)\b/gi,
    /\b(communication|collaboration|leadership)\b/gi,
    /\b(problem solving|critical thinking|creativity)\b/gi,
  ];

  // Extract technologies
  for (const pattern of techPatterns) {
    const matches = markdown.matchAll(pattern);
    for (const match of matches) {
      technologies.add(match[0]);
    }
  }

  // Extract trends
  for (const pattern of trendPatterns) {
    const matches = markdown.matchAll(pattern);
    for (const match of matches) {
      trends.add(match[0]);
    }
  }

  // Extract skills
  for (const pattern of skillPatterns) {
    const matches = markdown.matchAll(pattern);
    for (const match of matches) {
      skills.add(match[0]);
    }
  }

  return {
    technologies: Array.from(technologies),
    trends: Array.from(trends),
    skills: Array.from(skills),
  };
}

/**
 * Get industry report URLs to scrape
 */
export function getIndustryReportURLs(occupation: string): string[] {
  // Placeholder - would be populated with known industry report sources
  return [
    `https://www.mckinsey.com/search?q=${encodeURIComponent(occupation)}`,
    `https://www2.deloitte.com/global/en/pages/about-deloitte/articles/search.html?q=${encodeURIComponent(occupation)}`,
  ];
}
