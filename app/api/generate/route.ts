import { NextResponse } from "next/server";
import { createAIProvider } from "@/lib/ai/providers";
import { buildSystemPrompt, buildCourseOverviewPrompt } from "@/lib/ai/prompts";
import { COURSE_OUTLINE_SCHEMA } from "@/lib/ai/gemini-schemas";
import { getRelevantPapers } from "@/lib/engine/skill-mapper";
import { TRAINING_DIRECTIONS, CourseOutlineSchema } from "@/lib/engine/portfolio-types";
import type { TopicInfo, Paper } from "@/lib/engine/portfolio-types";
import { matchSupervisorsToCoursesContentBased } from "@/lib/db/queries";

// Allow execution for up to 5 minutes (300 seconds) on Vercel
export const maxDuration = 300;

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
      apiKey,
      modelId,
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
      apiKey?: string;
      modelId?: string;
      directionIndex?: number;
    };

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required. Please provide your Gemini API key in Settings." },
        { status: 400 }
      );
    }

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
        sectorDescription
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

        const courseData = JSON.parse(jsonStr);
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
