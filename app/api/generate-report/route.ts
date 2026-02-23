import { NextRequest, NextResponse } from "next/server";
import { createAIProvider } from "@/lib/ai/providers";
import { getSettings } from "@/lib/project-manager";
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

interface GenerateReportRequest {
  occupation: OccupationTaxonomy;
  topics: TopicInfo[];
  papers: AcademicPaper[];
  labor_market_data: LaborMarketData;
  sector_trends: SectorTrendsData;
  language: "en" | "el";
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: GenerateReportRequest = await request.json();
    const { occupation, topics, papers, labor_market_data, sector_trends, language = "en" } = body;

    if (!occupation || !topics || !papers || !labor_market_data || !sector_trends) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get API key from settings
    const settings = getSettings();
    if (!settings.apiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured in settings" },
        { status: 400 }
      );
    }

    // Create AI provider (will use Gemini 3.1 Pro or best available, temp 1.0)
    const ai = createAIProvider(settings.apiKey);

    console.log(`[generate-report] Generating ${language.toUpperCase()} report for: ${occupation.input}`);

    // ============================================================
    // SECTION 1: Sector Definition
    // ============================================================
    console.log("[generate-report] Generating sector definition...");
    const sectorDefPrompt = getSectorDefinitionPrompt(occupation, language);

    const sectorDefResponse = await ai.generate({
      systemPrompt: "You are a professional labor market analyst generating structured sector reports.",
      userPrompt: sectorDefPrompt,
      maxTokens: 2048,
    });

    const sectorDef = JSON.parse(sectorDefResponse);

    // ============================================================
    // SECTION 2: Exogenous Forces
    // ============================================================
    console.log("[generate-report] Generating exogenous forces...");
    const forcesPrompt = getExogenousForcesPrompt(occupation, sector_trends, language);

    const forcesResponse = await ai.generate({
      systemPrompt: "You are a professional labor market analyst analyzing external forces affecting occupations.",
      userPrompt: forcesPrompt,
      maxTokens: 2048,
    });

    const exogenousForces: ExogenousForces = JSON.parse(forcesResponse);

    // ============================================================
    // SECTION 3: Technology Catalog
    // ============================================================
    console.log("[generate-report] Generating technology catalog...");
    const techPrompt = getTechnologyCatalogPrompt(occupation, sector_trends, language);

    const techResponse = await ai.generate({
      systemPrompt: "You are a technology analyst cataloging tools and systems for professional occupations.",
      userPrompt: techPrompt,
      maxTokens: 3072,
    });

    const technologies: Technology[] = JSON.parse(techResponse);

    // ============================================================
    // SECTION 4: Labor Market Structure
    // ============================================================
    console.log("[generate-report] Generating labor market analysis...");
    const laborPrompt = getLaborMarketPrompt(occupation, labor_market_data, language);

    const laborResponse = await ai.generate({
      systemPrompt: "You are an employment analyst summarizing labor market conditions and workforce dynamics.",
      userPrompt: laborPrompt,
      maxTokens: 2048,
    });

    const laborSummary = JSON.parse(laborResponse);

    // ============================================================
    // SECTION 5: Future Scenarios
    // ============================================================
    console.log("[generate-report] Generating future scenarios...");
    const scenariosPrompt = getFutureScenariosPrompt(occupation, topics, sector_trends, language);

    const scenariosResponse = await ai.generate({
      systemPrompt: "You are a futurist creating plausible scenarios for occupational evolution.",
      userPrompt: scenariosPrompt,
      maxTokens: 4096,
    });

    const scenarios: FutureScenario[] = JSON.parse(scenariosResponse);

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
        model_used: "gemini" + (settings.verifiedModel ? ` (${settings.verifiedModel})` : ""),
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
