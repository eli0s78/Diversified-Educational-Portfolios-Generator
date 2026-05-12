import { NextRequest, NextResponse } from "next/server";
import { getONETTechnology, searchONETOccupations } from "@/lib/apis/onet";
import { searchTavily, buildTrendsQuery, extractTechnologies } from "@/lib/apis/tavily";
import { scrapeWithFirecrawl, extractInsights } from "@/lib/apis/firecrawl";
import { searchEdgar10K } from "@/lib/apis/edgar";
import { getFredSeries, getRelevantFredSeries } from "@/lib/apis/fred";
import type { SectorTrendsData, Technology, ExogenousForces } from "@/lib/types/research";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

interface SectorTrendsRequest {
  occupation: string;
  keywords?: string[];
  timeframe?: string;
  onet_api_key?: string;
  tavily_api_key?: string;
  firecrawl_api_key?: string;
  fred_api_key?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: SectorTrendsRequest = await request.json();
    const {
      occupation,
      keywords = [],
      timeframe = "2024-2026",
      onet_api_key,
      tavily_api_key,
      firecrawl_api_key,
      fred_api_key,
    } = body;

    if (!occupation) {
      return NextResponse.json(
        { error: "Missing required field: occupation" },
        { status: 400 }
      );
    }

    // Use API keys from request body (passed from client-side localStorage)
    const onetApiKey = onet_api_key;
    const tavilyApiKey = tavily_api_key;
    const firecrawlApiKey = firecrawl_api_key;
    const fredApiKey = fred_api_key;

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
              name: tech.title,
              category: "Software", // Simplified
              description: `Technology used in ${occupation}`,
              how_used: `Applied in ${occupation} workflows`,
              contribution: "Enhances productivity and quality",
              adoption_level: tech.hot_technology ? "growing" : "mature",
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
    // SEC EDGAR API (10-K extraction)
    // ============================================================
    try {
      // Look for the occupation specifically in deep company filings
      const edgarResults = await searchEdgar10K(occupation);
      if (edgarResults && edgarResults.length > 0) {
        dataSources.push("SEC EDGAR");
        let edgarMentions = 0;
        for (const res of edgarResults) {
          if (res.hits.fragments.length > 0) {
            edgarMentions++;
            // Could push to a specific field; we'll add it as an exogenous force
            if (edgarMentions <= 2) {
              exogenousForces.social.push({
                force: "Corporate Strategy (10-K)",
                description: `${res.entityName} discussed this area in recent filings.`,
                impact: "medium",
                sources: ["SEC EDGAR"],
              });
            }
          }
        }
      }
    } catch (edgarError) {
      console.warn("EDGAR API error:", edgarError);
    }

    // ============================================================
    // FRED Macroeconomic Indicators
    // ============================================================
    if (fredApiKey) {
      try {
        const relevantSeriesIds = getRelevantFredSeries(occupation, keywords);
        const seriesPromises = relevantSeriesIds.map(id => getFredSeries(id, fredApiKey, 2));
        const fredResults = await Promise.all(seriesPromises);

        let fredFound = false;
        for (const result of fredResults) {
          if (result && result.observations.length > 0) {
            fredFound = true;
            exogenousForces.environmental.push({
              force: `Macro Indicator: ${result.seriesId}`,
              description: `${result.title} (latest: ${result.observations[result.observations.length - 1].value})`,
              impact: "medium",
              sources: ["FRED"],
            });
          }
        }

        if (fredFound) dataSources.push("FRED");
      } catch (fredError) {
        console.warn("FRED API error:", fredError);
      }
    }

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
