import { NextResponse } from "next/server";
import { createAIProvider } from "@/lib/ai/providers";
import { buildAnalysisPrompt } from "@/lib/ai/prompts";
import { buildAnalysisSchema } from "@/lib/ai/gemini-schemas";
import type { TopicInfo, AnalysisResult } from "@/lib/engine/portfolio-types";
import { TRAINING_DIRECTIONS } from "@/lib/engine/portfolio-types";

// Allow execution for up to 60 seconds (maximum for Vercel Hobby Free Tier)
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      topics,
      reportTexts = [],
      language = "en",
      apiKey,
      modelId,
    } = body as {
      topics: TopicInfo[];
      reportTexts: string[];
      language: "en" | "el";
      apiKey?: string;
      modelId?: string;
    };

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json(
        { error: "Topics data is required" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required. Please provide your Gemini API key in Settings." },
        { status: 400 }
      );
    }

    const provider = createAIProvider(apiKey, modelId);

    // Build analysis prompt
    const { systemPrompt, userPrompt } = buildAnalysisPrompt(
      topics,
      reportTexts,
      language
    );

    // Build structured output schema (used by Gemini, ignored by others)
    const activeTopicNumbers = topics
      .filter((t) => t.topicNumber !== -1)
      .map((t) => t.topicNumber);
    const responseSchema = buildAnalysisSchema(activeTopicNumbers);

    const rawResponse = await provider.generate({
      systemPrompt,
      userPrompt,
      maxTokens: 8192,
      responseSchema,
    });

    // Parse JSON response
    let jsonStr = rawResponse.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const analysisData = JSON.parse(jsonStr) as AnalysisResult;

    // Validate and clamp affinity matrix
    const numDirections = TRAINING_DIRECTIONS.length;
    const activeTopics = topics.filter((t) => t.topicNumber !== -1);
    const validatedMatrix: Record<number, number[]> = {};

    for (const topic of activeTopics) {
      const row = analysisData.affinityMatrix[topic.topicNumber];
      if (Array.isArray(row) && row.length === numDirections) {
        validatedMatrix[topic.topicNumber] = row.map((v) =>
          Math.max(0, Math.min(1, Number(v) || 0))
        );
      } else {
        // Fallback: uniform 0.5
        validatedMatrix[topic.topicNumber] = new Array(numDirections).fill(0.5);
      }
    }

    const result: AnalysisResult = {
      sectorName: analysisData.sectorName || "Unknown Sector",
      sectorDescription: analysisData.sectorDescription || "",
      affinityMatrix: validatedMatrix,
      programTitle: analysisData.programTitle || "",
      programDescription: analysisData.programDescription || "",
      targetAudience: analysisData.targetAudience || "",
      educationLevel: analysisData.educationLevel || "bachelor",
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analysis error:", error);
    const message = error instanceof Error ? error.message : "Sector analysis failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
