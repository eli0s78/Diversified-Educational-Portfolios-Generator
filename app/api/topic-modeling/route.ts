import { NextRequest, NextResponse } from "next/server";
import { createAIProvider } from "@/lib/ai/providers";
import { getTopicModelingPrompt } from "@/lib/ai/prompts";
import { TOPIC_MODELING_SCHEMA } from "@/lib/ai/gemini-schemas";
import { getServerGeminiApiKey, getServerGeminiModelId } from "@/lib/server-config";
import type { Paper } from "@/lib/engine/portfolio-types";

// Allow execution for up to 300 seconds for massive paper lists
export const maxDuration = 300;
export const runtime = "nodejs";

interface TopicModelingRequest {
  papers: Pick<Paper, "id" | "title" | "abstract">[];
  min_topic_size?: number;
  n_topics?: number | null;
  embedding_model?: string; // Ignored now, kept for backward compatibility with frontend
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: TopicModelingRequest = await request.json();
    const { papers, n_topics = null } = body;

    if (!papers || !Array.isArray(papers) || papers.length === 0) {
      return NextResponse.json(
        { error: "No papers provided" },
        { status: 400 }
      );
    }

    // Limit to reasonable amount to avoid context blowouts (though Gemini handles 1-2m tokens)
    const processedPapers = papers.slice(0, 300);

    console.log(`[topic-modeling-llm] Processing ${processedPapers.length} papers via Gemini...`);

    const apiKey = getServerGeminiApiKey();
    const modelId = getServerGeminiModelId();
    const provider = createAIProvider(apiKey, modelId);

    // Build the prompt for Zero-Shot Topic Extraction
    const { systemPrompt, userPrompt } = getTopicModelingPrompt(processedPapers, n_topics);

    const rawResponse = await provider.generate({
      systemPrompt,
      userPrompt,
      maxTokens: 65536,
      responseSchema: TOPIC_MODELING_SCHEMA,
    });

    // Parse JSON
    let jsonStr = rawResponse.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    // Fix unescaped literal newlines/tabs inside strings, a common LLM JSON hallucination
    // that causes "Unterminated string in JSON" errors at early positions.
    const sanitizedStr = jsonStr.replace(/[\n\r\t]/g, " ");

    let result;
    try {
      result = JSON.parse(sanitizedStr);
    } catch (parseError) {
      console.error("[topic-modeling-llm] JSON Parse Error. Raw string snippet:", jsonStr.substring(0, 1500));
      throw new Error(`JSON parsing failed format. Raw response snippet: ${jsonStr.substring(0, 200)}...`);
    }

    // Filter out malformed topics
    const validTopics = Array.isArray(result.topics)
      ? result.topics.filter((t: any) => typeof t.topicNumber === "number" && t.name)
      : [];

    const validMapping = Array.isArray(result.papers_with_topics)
      ? result.papers_with_topics.filter((p: any) => p.id && typeof p.topicNumber === "number")
      : [];

    const outliersCount = validTopics.find((t: any) => t.topicNumber === -1)?.count || 0;

    const finalResponse = {
      topics: validTopics,
      papers_with_topics: validMapping,
      metadata: {
        n_topics: validTopics.filter((t: any) => t.topicNumber !== -1).length,
        n_outliers: outliersCount,
        processing_time_ms: Date.now() - startTime,
        method: "gemini-zero-shot-structured"
      }
    };

    console.log(`[topic-modeling-llm] Completed in ${finalResponse.metadata.processing_time_ms}ms.`);
    console.log(`[topic-modeling-llm] Found ${finalResponse.metadata.n_topics} core topics + ${outliersCount} outliers.`);

    return NextResponse.json(finalResponse);

  } catch (error) {
    console.error("[topic-modeling-llm] Error:", error);

    return NextResponse.json(
      {
        error: "Topic modeling failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
