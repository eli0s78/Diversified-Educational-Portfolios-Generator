import { NextRequest, NextResponse } from "next/server";
import { getONETTechnology, searchONETOccupations } from "@/lib/apis/onet";
import { searchTavily, buildTrendsQuery, extractTechnologies } from "@/lib/apis/tavily";
import { scrapeWithFirecrawl, extractInsights } from "@/lib/apis/firecrawl";
import type { SectorTrendsData, Technology, ExogenousForces } from "@/lib/types/research";
import { getSettings } from "@/lib/project-manager";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

interface SectorTrendsRequest {
  occupation: string;
  keywords?: string[];
  timeframe?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: SectorTrendsRequest = await request.json();
    const { occupation, keywords = [], timeframe = "2024-2026" } = body;

    if (!occupation) {
      return NextResponse.json(
        { error: "Missing required field: occupation" },
        { status: 400 }
      );
    }

    // Get API keys from settings
    const settings = getSettings();
    const onetApiKey = settings.onet_api_key;
    const tavilyApiKey = settings.tavily_api_key;
    const firecrawlApiKey = settings.firecrawl_api_key;

    const technologies: Technology[] = [];
    const dataSources: string[] = [];
    const newsHighlights: Array<{
      title: string;
      url: string;
      date: string;
      summary: string;
    }> = [];

    // ============================================================
    // O*NET Technology Skills
    // ============================================================
    if (onetApiKey) {
      try {
        const onetResults = await searchONETOccupations(occupation, onetApiKey);

        if (onetResults.length > 0) {
          const onetCode = onetResults[0].code;
          const onetTech = await getONETTechnology(onetCode, onetApiKey);

          for (const tech of onetTech) {
            technologies.push({
              name: tech.example_name,
              category: "Software", // Simplified
              description: `Technology used in ${occupation}`,
              how_used: `Applied in ${occupation} workflows`,
              contribution: "Enhances productivity and quality",
              adoption_level: tech.hot_technology === "Y" ? "growing" : "mature",
              sources: ["O*NET"],
            });
          }

          dataSources.push("O*NET");
        }
      } catch (error) {
        console.error("O*NET technology error:", error);
        // Continue without O*NET data
      }
    }

    // ============================================================
    // Tavily Web Search
    // ============================================================
    if (tavilyApiKey) {
      try {
        // Search for technology trends
        const techQuery = buildTrendsQuery(occupation, "technology");
        const techResults = await searchTavily(
          {
            query: techQuery,
            search_depth: "advanced",
            max_results: 5,
            include_answer: true,
          },
          tavilyApiKey
        );

        // Extract technologies from search results
        const extractedTech = extractTechnologies(techResults.results);

        for (const techName of extractedTech) {
          if (!technologies.find((t) => t.name.toLowerCase() === techName.toLowerCase())) {
            technologies.push({
              name: techName,
              category: "Software",
              description: `Emerging technology in ${occupation}`,
              how_used: "Applied to improve efficiency and outcomes",
              contribution: "Drives innovation and competitiveness",
              adoption_level: "emerging",
              sources: ["Tavily"],
            });
          }
        }

        // Add news highlights
        for (const result of techResults.results) {
          newsHighlights.push({
            title: result.title,
            url: result.url,
            date: result.published_date || new Date().toISOString(),
            summary: result.content,
          });
        }

        dataSources.push("Tavily");
      } catch (error) {
        console.error("Tavily search error:", error);
        // Continue without Tavily data
      }
    }

    // ============================================================
    // Firecrawl Web Scraping (optional, expensive)
    // ============================================================
    if (firecrawlApiKey) {
      try {
        // Example: Scrape a known industry report URL
        const targetURL = `https://www.mckinsey.com/search?q=${encodeURIComponent(occupation)}`;

        const scrapeResult = await scrapeWithFirecrawl(
          {
            url: targetURL,
            formats: ["markdown"],
            onlyMainContent: true,
          },
          firecrawlApiKey
        );

        if (scrapeResult.success && scrapeResult.data?.markdown) {
          const insights = extractInsights(scrapeResult.data.markdown);

          // Add extracted technologies
          for (const techName of insights.technologies) {
            if (!technologies.find((t) => t.name.toLowerCase() === techName.toLowerCase())) {
              technologies.push({
                name: techName,
                category: "Software",
                description: `Technology mentioned in industry reports`,
                how_used: "Industry-specific application",
                contribution: "Addresses sector challenges",
                adoption_level: "growing",
                sources: ["Firecrawl"],
              });
            }
          }

          dataSources.push("Firecrawl");
        }
      } catch (error) {
        console.error("Firecrawl scraping error:", error);
        // Continue without Firecrawl data
      }
    }

    // ============================================================
    // Exogenous Forces (placeholder - would use AI analysis)
    // ============================================================
    const exogenousForces: ExogenousForces = {
      social: [
        {
          force: "Demographic shifts",
          description: "Aging workforce and skills gap",
          impact: "high",
          sources: ["Industry analysis"],
        },
      ],
      technological: [
        {
          force: "Digital transformation",
          description: "Automation and AI adoption",
          impact: "high",
          sources: ["Technology trends"],
        },
      ],
      environmental: [
        {
          force: "Sustainability requirements",
          description: "Green technology adoption",
          impact: "medium",
          sources: ["Policy analysis"],
        },
      ],
    };

    // ============================================================
    // Assemble response
    // ============================================================
    const response: SectorTrendsData = {
      occupation,
      technologies,
      exogenous_forces: exogenousForces,
      trends_summary: `Analyzed ${technologies.length} technologies and trends for ${occupation} in ${timeframe}.`,
      news_highlights: newsHighlights,
      metadata: {
        data_sources: dataSources,
        collection_date: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Sector trends collection error:", error);
    return NextResponse.json(
      {
        error: "Failed to collect sector trends",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
