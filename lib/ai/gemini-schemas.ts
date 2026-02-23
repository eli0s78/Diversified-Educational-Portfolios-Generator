import { SchemaType } from "@google/generative-ai";

/**
 * Build the Gemini structured output schema for sector analysis.
 * Dynamic: affinityMatrix properties are generated from actual topic numbers.
 */
export function buildAnalysisSchema(topicNumbers: number[]) {
  const affinityProperties: Record<string, unknown> = {};
  for (const tn of topicNumbers) {
    affinityProperties[String(tn)] = {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.NUMBER },
      description: `Affinity scores (6 floats 0.0-1.0) for topic ${tn} across the 6 training directions`,
    };
  }

  return {
    type: SchemaType.OBJECT,
    properties: {
      sectorName: {
        type: SchemaType.STRING,
        description: "Name of the economic sector",
      },
      sectorDescription: {
        type: SchemaType.STRING,
        description: "300-500 word description of the sector",
      },
      affinityMatrix: {
        type: SchemaType.OBJECT,
        properties: affinityProperties,
        required: topicNumbers.map(String),
      },
      programTitle: {
        type: SchemaType.STRING,
        description: "Title for the educational program",
      },
      programDescription: {
        type: SchemaType.STRING,
        description: "100-200 word description of the program",
      },
      targetAudience: {
        type: SchemaType.STRING,
        description: "Target audience for the program",
      },
      educationLevel: {
        type: SchemaType.STRING,
        description: "Education level: high_school, bachelor, master, or phd",
      },
    },
    required: [
      "sectorName",
      "sectorDescription",
      "affinityMatrix",
      "programTitle",
      "programDescription",
      "targetAudience",
      "educationLevel",
    ],
  };
}

/**
 * Gemini structured output schema for a single course outline.
 * Matches CourseOutlineSchema from portfolio-types.ts.
 */
export const COURSE_OUTLINE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    overview: { type: SchemaType.STRING },
    trainingDirection: { type: SchemaType.STRING },
    totalHours: { type: SchemaType.NUMBER },
    modules: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          moduleNumber: { type: SchemaType.INTEGER },
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          learningObjectives: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          units: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                unitNumber: { type: SchemaType.INTEGER },
                title: { type: SchemaType.STRING },
                content: {
                  type: SchemaType.STRING,
                  description: "500-800 words of educational content",
                },
                learningObjectives: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                },
                skillTags: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                },
                paperReferences: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                },
                estimatedMinutes: { type: SchemaType.INTEGER },
              },
              required: [
                "unitNumber",
                "title",
                "content",
                "learningObjectives",
                "skillTags",
                "paperReferences",
                "estimatedMinutes",
              ],
            },
          },
        },
        required: [
          "moduleNumber",
          "title",
          "description",
          "learningObjectives",
          "units",
        ],
      },
    },
  },
  required: ["title", "overview", "trainingDirection", "totalHours", "modules"],
};
