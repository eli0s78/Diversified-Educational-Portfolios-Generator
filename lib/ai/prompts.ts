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

IMPORTANT GUIDELINES FOR CONTENT DEPTH AND QUALITY:
1. THEORETICAL RIGOR:
   - Reference specific, named theoretical frameworks (e.g., Cynefin Framework, SRK Model, Dual Process Theory, MAUT)
   - Cite academic authors when discussing concepts (e.g., "Rasmussen's SRK model", "Kahneman & Tversky's Dual Process Theory")
   - Ground each concept in established academic literature
   - Explain WHY frameworks matter before explaining WHAT they are

2. METHODOLOGICAL SPECIFICITY:
   - Name specific techniques and tools (e.g., ESBJSA, FTA, Scenario Analysis, LCA, SWOT)
   - Provide context for when and why each method is applied
   - Explain trade-offs and limitations, not just benefits

3. MULTI-LAYERED EXPLANATIONS:
   - Each unit should have 3-5 substantial paragraphs
   - Start with rationale and context (why this matters)
   - Progress to theoretical foundations (concepts, models, frameworks)
   - Include practical applications with concrete examples
   - Address challenges, nuances, and real-world complexity

4. SUBSECTOR SPECIFICITY:
   - Break down applications by industry subsectors when relevant (e.g., construction vs. manufacturing vs. textiles vs. mining)
   - Provide sector-specific examples, not generic ones
   - Reference industry-specific standards, regulations, or practices

5. INTEGRATION & CROSS-REFERENCES:
   - Explain how each unit connects to MPT/diversification strategy
   - Cross-reference other modules or units when concepts relate
   - Show how skills compound across the portfolio

6. PRACTICAL EXERCISES:
   - Include mini case studies or scenario-based applications
   - Provide concrete tasks learners should be able to perform
   - Reference real-world challenges from the sector

7. ACADEMIC CITATIONS:
   - Reference papers provided in the topic data
   - Use author-year format when discussing research (e.g., "According to Smith et al., 2023...")
   - Ground claims in empirical evidence

- Design content appropriate for the specified education level and target audience
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
  "title": "Course title (concise, professional, sector-specific)",
  "overview": "COMPREHENSIVE COURSE OVERVIEW (400-600 words):

  Paragraph 1: Course purpose and strategic importance for the sector, connection to broader professional development and portfolio diversification strategy.

  Paragraph 2: Core competencies addressed, theoretical foundations (name key frameworks/models), practical applications across subsectors.

  Paragraph 3: Learning approach (theoretical grounding, practical applications, case studies), expected outcomes upon completion.

  Paragraph 4: Integration with other training directions, contribution to building a resilient, diversified professional skill set.",
  "trainingDirection": "${direction.key}",
  "totalHours": number (25-40),
  "modules": [
    {
      "moduleNumber": 1,
      "title": "Theory & Literature",
      "description": "Module description (150-250 words) — explain the theoretical foundations this module establishes, why they matter for practice, and how they contribute to portfolio diversification",
      "learningObjectives": ["specific measurable objective 1", "specific measurable objective 2", "specific measurable objective 3"],
      "units": [
        {
          "unitNumber": 1,
          "title": "Unit title (specific, descriptive)",
          "content": "MULTI-PARAGRAPH DETAILED CONTENT (800-1200 words minimum):

          Paragraph 1: RATIONALE & CONTEXT — Why this unit matters for the sector, what challenges it addresses, how it fits into professional development strategy.

          Paragraph 2-3: THEORETICAL FOUNDATIONS — Specific named frameworks/models (e.g., 'Cynefin Framework', 'Rasmussen's SRK Model'), academic references (author-year), core concepts with nuanced explanations.

          Paragraph 4-5: PRACTICAL APPLICATIONS — Subsector-specific examples (e.g., construction vs. manufacturing), concrete techniques/methodologies, real-world implementation challenges.

          Paragraph 6 (if applicable): INTEGRATION — How this connects to other units/modules, contribution to diversified skill portfolio, cross-cutting competencies.

          Final paragraph: PRACTICAL EXERCISE/SCENARIO — A mini case study or concrete application task learners should practice.",
          "learningObjectives": ["specific, measurable objective 1", "specific, measurable objective 2", "specific, measurable objective 3"],
          "skillTags": ["specific skill1", "specific skill2", "specific skill3"],
          "paperReferences": ["Specific paper title or 'Author et al., YEAR'", "Another paper reference"],
          "estimatedMinutes": number (90-120)
        },
        { "unitNumber": 2, ... (follow same depth pattern) },
        { "unitNumber": 3, ... (follow same depth pattern) }
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

Generate a JSON object with 3 units, each containing DEEP, ANALYTICAL content:
{
  "moduleNumber": ${moduleNumber},
  "title": "${moduleTitle}",
  "description": "Module description (150-250 words explaining the module's role in building a diversified skill portfolio)",
  "learningObjectives": ["objective 1 (specific, measurable)", "objective 2", "objective 3"],
  "units": [
    {
      "unitNumber": 1,
      "title": "Unit title (specific and descriptive)",
      "content": "MULTI-PARAGRAPH ANALYTICAL CONTENT (800-1200 words):

      Start with RATIONALE (why this matters for the sector), then THEORETICAL FOUNDATIONS (name specific frameworks/models with academic citations), then PRACTICAL APPLICATIONS (subsector-specific examples), then INTEGRATION (how this contributes to portfolio diversification), ending with a PRACTICAL EXERCISE or scenario.

      Use named frameworks (e.g., 'Cynefin', 'MAUT', 'LCA'), cite authors (e.g., 'Rasmussen', 'Kahneman & Tversky'), provide subsector breakdowns (construction/manufacturing/etc.), explain trade-offs and limitations, not just benefits.",
      "learningObjectives": ["specific measurable objective 1", "specific measurable objective 2"],
      "skillTags": ["specific skill1", "specific skill2", "specific skill3"],
      "paperReferences": ["Specific paper or 'Author, YEAR'", "Another reference"],
      "estimatedMinutes": 90-120
    },
    { "unitNumber": 2, ... (same depth pattern) },
    { "unitNumber": 3, ... (same depth pattern) }
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
  "sectorDescription": "COMPREHENSIVE SECTOR ANALYSIS (500-800 words):

  Paragraph 1: Current state of the sector, major industries/subsectors, economic significance.

  Paragraph 2: Key technological trends, recent innovations, digital transformation drivers (reference specific topics/papers).

  Paragraph 3: Critical skill gaps, workforce challenges, emerging competency requirements.

  Paragraph 4: Future outlook, strategic priorities, role of diversified skill development in addressing sector needs.

  Use specific evidence from the topics and papers. Reference concrete trends, technologies, and challenges visible in the data.",
  "affinityMatrix": {
${topicNumbers.map((n) => `    "${n}": [new_tech, trends, sales, negotiation_hr, growth_theory, growth_practical]`).join(",\n")}
  },
  "programTitle": "Proposed title for the educational program (specific to the sector, professional)",
  "programDescription": "PROGRAM DESCRIPTION (250-400 words):

  Explain the program's purpose using the diversified portfolio framework — how it builds a balanced, complementary skill set rather than narrow specialization. Address the sector's challenges and how this diversified approach creates resilient, adaptable professionals. Reference the concept of portfolio theory applied to skills (reducing career risk through diversification).",
  "targetAudience": "Recommended target audience — be specific about roles, experience levels, and career stages (e.g., 'mid-career professionals in manufacturing seeking to broaden competencies' or 'recent graduates entering construction management')",
  "educationLevel": "bachelor"
}

NOTES:
- affinityMatrix values must be numbers between 0.0 and 1.0
- Each array in affinityMatrix must have exactly 6 values, one per training direction in order: [new_tech, trends, sales, negotiation_hr, growth_theory, growth_practical]
- educationLevel must be one of: "high_school", "bachelor", "master", "phd"
- Return ONLY the JSON object, no additional text.`;

  return { systemPrompt, userPrompt };
}
