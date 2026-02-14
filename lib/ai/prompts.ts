import { TRAINING_DIRECTIONS, SKILL_CATEGORIES } from "@/lib/engine/portfolio-types";
import type { TopicInfo, Paper } from "@/lib/engine/portfolio-types";

export function buildSystemPrompt(
  sectorName: string,
  programTitle: string,
  programInstructions: string,
  targetAudience: string,
  educationLevel: string,
  language: "en" | "el"
): string {
  const lang = language === "el"
    ? "Generate all content in Greek (Ελληνικά). Use proper Greek academic terminology."
    : "Generate all content in English.";

  const programTitleLine = programTitle
    ? `- Program Title: ${programTitle}`
    : "";
  const instructionsLine = programInstructions
    ? `- Program Instructions: ${programInstructions}`
    : "";
  const audienceLine = targetAudience
    ? `- Target Audience: ${targetAudience}`
    : "";

  return `You are an expert educational curriculum designer specializing in Diversified Educational Portfolios based on Modern Portfolio Theory (MPT) applied to skill development.

Your framework is based on the research paper "A Foresight Framework for the Labor Market" (Kanzola & Petrakis, 2024), published in Forecasting journal. The core concept: just as financial MPT diversifies investments to optimize risk-return, Diversified Skill Portfolios diversify training across multiple skill categories to build resilient, future-ready professionals.

CONTEXT:
- Economic Sector: ${sectorName}
- Education Level: ${educationLevel}
${programTitleLine}
${instructionsLine}
${audienceLine}

SKILL PORTFOLIO CATEGORIES (from the academic framework):
${SKILL_CATEGORIES.map((c) => `- ${c.name}: ${c.description}`).join("\n")}

THE 6 TRAINING DIRECTIONS:
${TRAINING_DIRECTIONS.map((d) => `${d.id}. ${d.name}: ${d.description}`).join("\n")}

IMPORTANT GUIDELINES:
- Design content appropriate for the specified education level and target audience
- Reference actual academic papers when provided
- Balance theoretical foundations with practical applications
- Explain how each module contributes to a diversified, risk-optimized professional development strategy
- Consider the MPT analogy: "diversification reduces risk" in the context of skills
- Follow any specific program instructions provided above
${lang}

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema provided in each prompt. No markdown code blocks, no explanations outside the JSON.`;
}

export function buildCourseOverviewPrompt(
  directionIndex: number,
  weight: number,
  topics: TopicInfo[],
  papers: Paper[],
  sectorKnowledge: string
): string {
  const direction = TRAINING_DIRECTIONS[directionIndex];
  const relevantTopics = topics
    .filter((t) => t.topicNumber !== -1)
    .map((t) => `- Topic "${t.name}": keywords [${t.keywords.slice(0, 5).join(", ")}] (${t.count} papers, ${t.rarityLabel})`)
    .join("\n");

  const paperList = papers
    .slice(0, 10)
    .map((p) => `- "${p.title}" (${p.authors}, ${p.year}, ${p.venue})`)
    .join("\n");

  return `Generate a comprehensive e-learning course outline for Training Direction ${direction.id}: "${direction.name}"

DIRECTION DESCRIPTION: ${direction.description}

PORTFOLIO CONTEXT:
- This direction received a weight of ${(weight * 100).toFixed(1)}% in the optimized portfolio
- This reflects its relative importance for the user's professional development

SECTOR TOPICS (from BERTopic analysis of recent scientific literature):
${relevantTopics}

KEY PAPERS:
${paperList}

SECTOR KNOWLEDGE:
${sectorKnowledge}

Generate a JSON object with this exact structure:
{
  "title": "Course title (concise, professional)",
  "overview": "Course overview (200-300 words explaining objectives and relevance to the sector)",
  "trainingDirection": "${direction.key}",
  "totalHours": number (25-40),
  "modules": [
    {
      "moduleNumber": 1,
      "title": "Theory & Literature",
      "description": "Module description (100-150 words)",
      "learningObjectives": ["objective 1", "objective 2", "objective 3"],
      "units": [
        {
          "unitNumber": 1,
          "title": "Unit title",
          "content": "Detailed content outline (500-800 words covering key concepts, theoretical frameworks, practical applications, real-world examples)",
          "learningObjectives": ["specific objective 1", "specific objective 2"],
          "skillTags": ["skill1", "skill2", "skill3"],
          "paperReferences": ["Paper title 1", "Paper title 2"],
          "estimatedMinutes": number (60-120)
        },
        { "unitNumber": 2, ... },
        { "unitNumber": 3, ... }
      ]
    },
    {
      "moduleNumber": 2,
      "title": "Sector Applications",
      "description": "...",
      "learningObjectives": [...],
      "units": [...]
    },
    {
      "moduleNumber": 3,
      "title": "Applied Skills & Practice",
      "description": "...",
      "learningObjectives": [...],
      "units": [...]
    },
    {
      "moduleNumber": 4,
      "title": "Integration & Assessment",
      "description": "...",
      "learningObjectives": [...],
      "units": [...]
    }
  ]
}

IMPORTANT: Return ONLY the JSON object, no additional text.`;
}

export function buildModulePrompt(
  courseTitle: string,
  moduleNumber: number,
  moduleTitle: string,
  directionName: string,
  topics: TopicInfo[],
  papers: Paper[]
): string {
  const topicKeywords = topics
    .filter((t) => t.topicNumber !== -1)
    .flatMap((t) => t.keywords.slice(0, 3))
    .slice(0, 20)
    .join(", ");

  const paperRefs = papers
    .slice(0, 5)
    .map((p) => `"${p.title}" (${p.authors}, ${p.year})`)
    .join("; ");

  return `Generate detailed content for Module ${moduleNumber}: "${moduleTitle}" of the course "${courseTitle}" (Training Direction: ${directionName}).

TOPIC KEYWORDS TO INCORPORATE: ${topicKeywords}
PAPER REFERENCES TO CITE: ${paperRefs}

Generate a JSON object with 3 units, each containing:
{
  "moduleNumber": ${moduleNumber},
  "title": "${moduleTitle}",
  "description": "Module description (100-150 words)",
  "learningObjectives": ["objective 1", "objective 2", "objective 3"],
  "units": [
    {
      "unitNumber": 1,
      "title": "Unit title",
      "content": "Detailed content (500-800 words) covering key concepts, frameworks, applications, and connection to the diversified portfolio approach",
      "learningObjectives": ["specific objective"],
      "skillTags": ["skill1", "skill2"],
      "paperReferences": ["Paper title"],
      "estimatedMinutes": 90
    },
    { "unitNumber": 2, ... },
    { "unitNumber": 3, ... }
  ]
}

Return ONLY the JSON object.`;
}

/**
 * Build the prompt for AI-driven sector analysis.
 * The AI reads all topics + full report texts and produces:
 *   - Affinity matrix (each topic scored against 6 training directions)
 *   - Sector metadata (name, description, program title, etc.)
 */
export function buildAnalysisPrompt(
  topics: TopicInfo[],
  reportTexts: string[],
  language: "en" | "el"
): { systemPrompt: string; userPrompt: string } {
  const lang = language === "el"
    ? "All text fields (sectorName, sectorDescription, programTitle, programDescription, targetAudience) MUST be in Greek (Ελληνικά). Use proper Greek academic terminology."
    : "All text fields must be in English.";

  const directionsDescription = TRAINING_DIRECTIONS.map(
    (d) => `  ${d.id}. ${d.key} — "${d.name}": ${d.description}`
  ).join("\n");

  const systemPrompt = `You are an expert in educational program design, labor market analysis, and the "Diversified Skill Portfolios" framework (Kanzola & Petrakis, 2024).

Your task: Given a set of BERTopic-extracted topics from scientific literature about a specific economic sector, plus sector report texts, you must:

1. ANALYZE the sector to understand its landscape, challenges, and skill needs.
2. SCORE each topic against 6 universal training directions (0.0 to 1.0 affinity).
3. INFER optimal program metadata for an educational program in this sector.

THE 6 TRAINING DIRECTIONS (universal across all sectors):
${directionsDescription}

SCORING GUIDELINES:
- 0.0 = topic has no relevance to this training direction
- 0.3 = weak relevance
- 0.5 = moderate relevance
- 0.7 = strong relevance
- 1.0 = topic is core to this training direction
- Consider both direct and indirect connections
- A topic can score high on multiple directions
- Use the full range — avoid clustering all scores around 0.5

${lang}

OUTPUT: Respond with ONLY a valid JSON object (no markdown, no explanations) matching the exact schema provided in the user message.`;

  const topicsList = topics
    .filter((t) => t.topicNumber !== -1)
    .map((t) => {
      const keywords = t.keywords.join(", ");
      const docs = t.representativeDocs
        .map((d) => `    "${d}"`)
        .join("\n");
      return `Topic ${t.topicNumber} — "${t.name}" (${t.count} papers, ${t.rarityLabel})
  Keywords: [${keywords}]
  Representative documents:
${docs}`;
    })
    .join("\n\n");

  const reportsSection = reportTexts.length > 0
    ? `\n\nSECTOR REPORTS (full text — read carefully for context):\n${reportTexts
        .map((text, i) => `--- Report ${i + 1} ---\n${text}`)
        .join("\n\n")}`
    : "";

  const topicNumbers = topics
    .filter((t) => t.topicNumber !== -1)
    .map((t) => t.topicNumber);

  const userPrompt = `Analyze the following sector data and produce the affinity matrix + program metadata.

TOPICS FROM BERTOPIC ANALYSIS:
${topicsList}
${reportsSection}

Return a JSON object with this EXACT structure:
{
  "sectorName": "Name of the economic sector (inferred from topics and reports)",
  "sectorDescription": "Comprehensive description of this sector's landscape, key challenges, skill gaps, and future outlook (300-500 words)",
  "affinityMatrix": {
${topicNumbers.map((n) => `    "${n}": [new_tech, trends, sales, negotiation_hr, growth_theory, growth_practical]`).join(",\n")}
  },
  "programTitle": "Proposed title for the educational program",
  "programDescription": "Brief program description (100-200 words)",
  "targetAudience": "Recommended target audience for this program",
  "educationLevel": "bachelor"
}

NOTES:
- affinityMatrix values must be numbers between 0.0 and 1.0
- Each array in affinityMatrix must have exactly 6 values, one per training direction in order: [new_tech, trends, sales, negotiation_hr, growth_theory, growth_practical]
- educationLevel must be one of: "high_school", "bachelor", "master", "phd"
- Return ONLY the JSON object, no additional text.`;

  return { systemPrompt, userPrompt };
}
