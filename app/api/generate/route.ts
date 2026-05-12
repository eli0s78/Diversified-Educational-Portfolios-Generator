import { NextResponse } from "next/server";
import { createAIProvider } from "@/lib/ai/providers";
import { buildSystemPrompt, buildCourseOverviewPrompt } from "@/lib/ai/prompts";
import { COURSE_OUTLINE_SCHEMA } from "@/lib/ai/gemini-schemas";
import { getRelevantPapers } from "@/lib/engine/skill-mapper";
import { TRAINING_DIRECTIONS, CourseOutlineSchema } from "@/lib/engine/portfolio-types";
import type { TopicInfo, Paper } from "@/lib/engine/portfolio-types";
import { matchSupervisorsToCoursesContentBased } from "@/lib/db/queries";
import { getServerGeminiApiKey } from "@/lib/server-config";
import { resolveGeminiModel } from "@/lib/ai/model-resolver";
import { searchOpenStax } from "@/lib/apis/openstax";
import { searchMerlot } from "@/lib/apis/merlot";
import { searchOasis } from "@/lib/apis/oasis";

// Allow execution for up to 60 seconds (maximum for Vercel Hobby Free Tier)
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      weights,
      topics,
      papers,
      affinityMatrix,
      sectorName = "",
      sectorDescription = "",
      programTitle = "",
      programInstructions = "",
      targetAudience = "",
      educationLevel = "bachelor",
      language = "en",
      directionIndex,
    } = body as {
      weights: number[];
      topics: TopicInfo[];
      papers: Paper[];
      affinityMatrix: Record<number, number[]>;
      sectorName: string;
      sectorDescription: string;
      programTitle: string;
      programInstructions: string;
      targetAudience: string;
      educationLevel: string;
      language: "en" | "el";
      directionIndex?: number;
    };

    // Use server-side API key (secure - never exposed to client)
    const apiKey = getServerGeminiApiKey();
    if (!apiKey) {
      throw new Error("Server API key not configured");
    }

    // Strictly resolve the active 3.1+ model
    // This will throw if a 3.1+ model is not found, blocking the generation
    const modelId = await resolveGeminiModel(apiKey, { strict: true });

    const provider = createAIProvider(apiKey, modelId);

    if (!topics || !papers || !affinityMatrix) {
      return NextResponse.json(
        { error: "Topics, papers, and affinity matrix are required" },
        { status: 400 }
      );
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(
      sectorName,
      programTitle,
      programInstructions,
      targetAudience,
      educationLevel,
      language
    );

    // Generate course for the specified direction (or all)
    const directionsToGenerate =
      directionIndex !== undefined
        ? [directionIndex]
        : TRAINING_DIRECTIONS.map((_, i) => i);

    const courses = [];

    // OER Parallel Fetch (Scrape learning materials based on program title/sector)
    console.log(`[generate] Fetching educational materials for "${programTitle || sectorName}"...`);
    const oerQuery = encodeURIComponent(programTitle || sectorName);

    // Fire OER scrapers in parallel but don't strictly block if they fail
    const [openstaxRes, merlotRes, oasisRes] = await Promise.allSettled([
      searchOpenStax({ subject: oerQuery }).catch(() => null),
      searchMerlot({ query: oerQuery }).catch(() => []),
      searchOasis({ query: oerQuery }).catch(() => [])
    ]);

    const oerContext = `
OPENSTAX TEXTBOOKS: ${openstaxRes.status === "fulfilled" && openstaxRes.value ? JSON.stringify(openstaxRes.value) : "Unavailable"}
MERLOT RESOURCES: ${merlotRes.status === "fulfilled" && merlotRes.value ? JSON.stringify(merlotRes.value) : "Unavailable"}
OASIS RESOURCES: ${oasisRes.status === "fulfilled" && oasisRes.value ? JSON.stringify(oasisRes.value) : "Unavailable"}
`;

    for (const dIdx of directionsToGenerate) {
      const direction = TRAINING_DIRECTIONS[dIdx];
      const weight = weights?.[dIdx] ?? 1 / TRAINING_DIRECTIONS.length;

      // Skip directions with very low weight
      if (weight < 0.03) continue;

      // Get relevant papers for this direction
      const relevantPapers = getRelevantPapers(
        papers,
        dIdx,
        affinityMatrix,
        10
      );

      // Build course overview prompt
      const userPrompt = buildCourseOverviewPrompt(
        dIdx,
        weight,
        topics,
        relevantPapers,
        sectorDescription,
        oerContext
      );

      const rawResponse = await provider.generate({
        systemPrompt,
        userPrompt,
        maxTokens: 65536,
        responseSchema: COURSE_OUTLINE_SCHEMA,
      });

      // Parse and validate JSON response
      try {
        // Extract JSON from response (handle markdown code blocks)
        let jsonStr = rawResponse.trim();
        if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }

        const sanitizedStr = jsonStr.replace(/[\n\r\t]/g, " ");
        const courseData = JSON.parse(sanitizedStr);
        const validated = CourseOutlineSchema.parse(courseData);
        courses.push(validated);
      } catch (parseError) {
        console.error(
          `Failed to parse course for direction ${direction.name}:`,
          parseError
        );
        require('fs').writeFileSync('debug_generation_error.log', JSON.stringify({
          error: parseError instanceof Error ? parseError.message : String(parseError),
          rawResponse: rawResponse
        }, null, 2));

        // Add a placeholder course
        courses.push({
          title: `${direction.name} - Course`,
          overview: `E-learning course for ${direction.name}. Content generation encountered a parsing issue. Please try regenerating.`,
          trainingDirection: direction.key,
          totalHours: 30,
          modules: Array.from({ length: 4 }, (_, m) => ({
            moduleNumber: m + 1,
            title: `Module ${m + 1}`,
            description: "Content pending regeneration",
            learningObjectives: [],
            units: Array.from({ length: 3 }, (_, u) => ({
              unitNumber: u + 1,
              title: `Unit ${u + 1}`,
              content: "Content pending regeneration. Please click 'Regenerate' to try again.",
              learningObjectives: [],
              skillTags: [],
              paperReferences: [],
              estimatedMinutes: 90,
            })),
          })),
        });
      }
    }

    // Content-based supervisor matching: scores against actual course content
    let supervisors: Record<string, unknown[]> = {};
    try {
      supervisors = matchSupervisorsToCoursesContentBased(courses, 3);
    } catch (err) {
      console.warn("Supervisor matching skipped:", err);
    }

    return NextResponse.json({ courses, supervisors });
  } catch (error) {
    console.error("Generation error:", error);
    const message = error instanceof Error ? error.message : "Course generation failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
