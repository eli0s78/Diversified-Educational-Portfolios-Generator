import { NextRequest, NextResponse } from "next/server";
import { createAIProvider } from "@/lib/ai/providers";
import { getServerGeminiApiKey, getServerGeminiModelId } from "@/lib/server-config";
import {
  getSectorDefinitionPrompt,
  getExogenousForcesPrompt,
  getTechnologyCatalogPrompt,
  getLaborMarketPrompt,
  getFutureScenariosPrompt,
} from "@/lib/report-templates";
import type {
  SectorReport,
  OccupationTaxonomy,
  TopicInfo,
  AcademicPaper,
  LaborMarketData,
  SectorTrendsData,
  Technology,
  ExogenousForces,
  FutureScenario,
} from "@/lib/types/research";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

/**
 * Robustly parses AI-generated JSON, sanitizing common LLM hallucinations
 * like unescaped newlines/tabs that break the standard JSON parser.
 */
function parseRawJsonResponse<T>(rawText: string, sectionName: string): T {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  // Sanitize unescaped literals
  cleaned = cleaned.replace(/[\n\r\t]/g, " ");

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    console.error(`[generate-report] JSON Parse Error in ${sectionName}. Raw text snippet:`, rawText.substring(0, 500));
    throw new Error(`Failed to parse AI response for ${sectionName}. Model returned invalid JSON.`);
  }
}

interface GenerateReportRequest {
  occupation: OccupationTaxonomy;
  topics: TopicInfo[];
  papers: AcademicPaper[];
  labor_market_data: LaborMarketData;
  sector_trends?: SectorTrendsData | null; // Optional - may fail if API keys not configured
  language: "en" | "el";
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: GenerateReportRequest = await request.json();
    const { occupation, topics, papers, labor_market_data, sector_trends, language = "en" } = body;

    if (!occupation || !topics || !papers || !labor_market_data) {
      return NextResponse.json(
        { error: "Missing required fields: occupation, topics, papers, labor_market_data" },
        { status: 400 }
      );
    }

    // Use empty sector_trends if not provided (API may have failed)
    const safeSectorTrends = sector_trends || {
      occupation: occupation.input,
      technologies: [],
      exogenous_forces: {
        social: [],
        technological: [],
        environmental: [],
      },
      trends_summary: "No external trend data available.",
      news_highlights: [],
      metadata: {
        data_sources: [],
        collection_date: new Date().toISOString(),
      },
    };

    // Use server-side API key (secure - never exposed to client)
    const apiKey = getServerGeminiApiKey();
    const modelId = getServerGeminiModelId();

    // Create AI provider (will use Gemini 3.1 Pro or best available, temp 1.0)
    const ai = createAIProvider(apiKey, modelId);

    console.log(`[generate-report] Generating ${language.toUpperCase()} report for: ${occupation.input}`);

    // ============================================================
    // SECTION 1: Sector Definition
    // ============================================================
    console.log("[generate-report] Generating sector definition...");
    const sectorDefPrompt = getSectorDefinitionPrompt(occupation, language);

    const sectorDefResponse = await ai.generate({
      systemPrompt: "You are a professional labor market analyst generating structured sector reports.",
      userPrompt: sectorDefPrompt,
    });

    const sectorDef = parseRawJsonResponse<any>(sectorDefResponse, "Sector Definition");

    // ============================================================
    // SECTION 2: Exogenous Forces
    // ============================================================
    console.log("[generate-report] Generating exogenous forces...");
    const forcesPrompt = getExogenousForcesPrompt(occupation, safeSectorTrends, language);

    const forcesResponse = await ai.generate({
      systemPrompt: "You are a professional labor market analyst analyzing external forces affecting occupations.",
      userPrompt: forcesPrompt,
    });

    const exogenousForces = parseRawJsonResponse<ExogenousForces>(forcesResponse, "Exogenous Forces");

    // ============================================================
    // SECTION 3: Technology Catalog
    // ============================================================
    console.log("[generate-report] Generating technology catalog...");
    const techPrompt = getTechnologyCatalogPrompt(occupation, safeSectorTrends, language);

    const techResponse = await ai.generate({
      systemPrompt: "You are a technology analyst cataloging tools and systems for professional occupations.",
      userPrompt: techPrompt,
    });

    const technologies = parseRawJsonResponse<Technology[]>(techResponse, "Technology Catalog");

    // ============================================================
    // SECTION 4: Labor Market Structure
    // ============================================================
    console.log("[generate-report] Generating labor market analysis...");
    const laborPrompt = getLaborMarketPrompt(occupation, labor_market_data, language);

    const laborResponse = await ai.generate({
      systemPrompt: "You are an employment analyst summarizing labor market conditions and workforce dynamics.",
      userPrompt: laborPrompt,
    });

    const laborSummary = parseRawJsonResponse<any>(laborResponse, "Labor Market Summary");

    // ============================================================
    // SECTION 5: Future Scenarios
    // ============================================================
    console.log("[generate-report] Generating future scenarios...");
    const scenariosPrompt = getFutureScenariosPrompt(occupation, topics, safeSectorTrends, language);

    const scenariosResponse = await ai.generate({
      systemPrompt: "You are a futurist creating plausible scenarios for occupational evolution.",
      userPrompt: scenariosPrompt,
    });

    const scenarios = parseRawJsonResponse<FutureScenario[]>(scenariosResponse, "Future Scenarios");

    // ============================================================
    // Assemble Final Report
    // ============================================================

    const report: SectorReport = {
      // Metadata
      occupation,
      generated_at: new Date().toISOString(),
      language,

      // Sector definition
      sector_definition: {
        name: sectorDef.sector_name,
        description: sectorDef.description,
        nace_codes: sectorDef.industry_codes.filter((c: string) => c.startsWith("NACE")),
        naics_codes: sectorDef.industry_codes.filter((c: string) => c.startsWith("NAICS")),
        subsectors: sectorDef.subsectors,
      },

      // Exogenous forces
      exogenous_forces: exogenousForces,

      // Technology catalog
      technologies,

      // Labor market structure
      labor_market: {
        ...labor_market_data,
        // Add AI-generated summaries
        demographics: {
          ...labor_market_data.demographics,
        },
      },

      // Future scenarios
      scenarios,

      // Topics from BERTopic
      topics,

      // References (academic papers)
      references: papers,
    };

    const duration_ms = Date.now() - startTime;
    console.log(`[generate-report] Report generated in ${duration_ms}ms`);

    return NextResponse.json({
      report,
      metadata: {
        generation_time_ms: duration_ms,
        language,
        sections_generated: 5,
        model_used: `gemini (${modelId})`,
      },
    });
  } catch (error) {
    console.error("[generate-report] Generation error:", error);

    // Parse error message
    let errorMessage = "Failed to generate report";
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;

      // Check for specific error types
      if (errorMessage.includes("429") || errorMessage.includes("quota")) {
        errorMessage = "API quota exceeded. Please try again later.";
        statusCode = 429;
      } else if (errorMessage.includes("401") || errorMessage.includes("API key")) {
        errorMessage = "Invalid API key. Please check your settings.";
        statusCode = 401;
      } else if (errorMessage.includes("JSON")) {
        errorMessage = "AI response parsing failed. The model may have returned invalid JSON.";
        statusCode = 500;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: statusCode }
    );
  }
}
