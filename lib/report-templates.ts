/**
 * Report Generation Templates
 *
 * Prompt templates for AI-powered sector report generation.
 * Supports bilingual output (English and Greek).
 */

import type {
  OccupationTaxonomy,
  TopicInfo,
  AcademicPaper,
  LaborMarketData,
  SectorTrendsData,
} from "@/lib/types/research";

// ============================================================================
// SECTION 1: SECTOR DEFINITION
// ============================================================================

export function getSectorDefinitionPrompt(
  occupation: OccupationTaxonomy,
  language: "en" | "el"
): string {
  const languageName = language === "en" ? "English" : "Greek";

  return `You are a labor market analyst creating a comprehensive sector report for the occupation: "${occupation.input}".

Write the "Sector Definition" section of the report in ${languageName}.

## Input Data

**Occupation**: ${occupation.input}
${occupation.onet ? `**O*NET Code**: ${occupation.onet.code} - ${occupation.onet.title}` : ""}
${occupation.esco ? `**ESCO**: ${occupation.esco.preferredLabel.en}` : ""}
${occupation.isco ? `**ISCO-08**: ${occupation.isco.code} - ${occupation.isco.title}` : ""}

## Requirements

Write a 300-500 word sector definition that includes:

1. **Sector Name**: Clear, professional name for this occupational sector
2. **Description**: What this sector encompasses, key activities, and scope
3. **Industry Codes**: Mention relevant NACE/NAICS codes if applicable
4. **Subsectors**: Break down into 3-5 key subsectors or specializations

## Output Format

Return ONLY a JSON object with this structure:

{
  "sector_name": "Sector Name",
  "description": "Full description paragraph (300-500 words)",
  "industry_codes": ["NACE Code 1", "NACE Code 2", "NAICS Code 1"],
  "subsectors": ["Subsector 1", "Subsector 2", "Subsector 3"]
}

Use professional, evidence-based language. Be specific and accurate.`;
}

// ============================================================================
// SECTION 2: EXOGENOUS FORCES
// ============================================================================

export function getExogenousForcesPrompt(
  occupation: OccupationTaxonomy,
  trends: SectorTrendsData,
  language: "en" | "el"
): string {
  const languageName = language === "en" ? "English" : "Greek";
  const technologiesSummary = trends.technologies.slice(0, 10).map((t) => t.name).join(", ");

  return `You are a labor market analyst analyzing exogenous forces affecting the occupation: "${occupation.input}".

Write the "Exogenous Forces" analysis in ${languageName}.

## Input Data

**Occupation**: ${occupation.input}
**Key Technologies**: ${technologiesSummary}
**Trends Summary**: ${trends.trends_summary}

## Requirements

Identify and analyze exogenous forces in THREE categories:

1. **Social Forces**: Demographic shifts, cultural trends, policy changes, workforce dynamics
2. **Technological Forces**: Industry 4.0/5.0 technologies, automation, AI/ML, digital transformation
3. **Environmental Forces**: Climate adaptation, circular economy, sustainability requirements, green technology

For each force, provide:
- **Force name** (concise, 2-5 words)
- **Description** (1-2 sentences explaining the force and its implications)
- **Impact level**: "high", "medium", or "low"

## Output Format

Return ONLY a JSON object with this structure:

{
  "social": [
    {
      "force": "Aging Workforce",
      "description": "Description here...",
      "impact": "high"
    }
  ],
  "technological": [
    {
      "force": "AI Adoption",
      "description": "Description here...",
      "impact": "high"
    }
  ],
  "environmental": [
    {
      "force": "Sustainability Requirements",
      "description": "Description here...",
      "impact": "medium"
    }
  ]
}

Provide 3-5 forces per category. Be specific and evidence-based.`;
}

// ============================================================================
// SECTION 3: TECHNOLOGY CATALOG
// ============================================================================

export function getTechnologyCatalogPrompt(
  occupation: OccupationTaxonomy,
  trends: SectorTrendsData,
  language: "en" | "el"
): string {
  const languageName = language === "en" ? "English" : "Greek";
  const technologiesDetail = trends.technologies
    .slice(0, 15)
    .map((t) => `- ${t.name} (${t.category}, ${t.adoption_level})`)
    .join("\n");

  return `You are a labor market analyst cataloging technologies for the occupation: "${occupation.input}".

Write the "Technology Catalog" section in ${languageName}.

## Input Data

**Occupation**: ${occupation.input}

**Identified Technologies**:
${technologiesDetail}

## Requirements

For the top 10-15 most important technologies, provide:

1. **Technology Name**: Official/common name
2. **Category**: Software, Hardware, Platform, Framework, Tool, Material, etc.
3. **Description**: What it is (1 sentence)
4. **How Used**: How it's used in this occupation (1-2 sentences)
5. **Contribution**: How it contributes to productivity, quality, safety, or innovation (1 sentence)
6. **Adoption Level**: "emerging", "growing", "mature", or "declining"

## Output Format

Return ONLY a JSON array:

[
  {
    "name": "Building Information Modeling (BIM)",
    "category": "Software",
    "description": "Digital representation of physical and functional characteristics of buildings.",
    "how_used": "Used for 3D modeling, clash detection, and project coordination in construction projects.",
    "contribution": "Reduces errors, improves collaboration, and enables data-driven decision making.",
    "adoption_level": "growing"
  }
]

Focus on technologies that are most relevant and impactful for this occupation.`;
}

// ============================================================================
// SECTION 4: LABOR MARKET STRUCTURE
// ============================================================================

export function getLaborMarketPrompt(
  occupation: OccupationTaxonomy,
  laborData: LaborMarketData,
  language: "en" | "el"
): string {
  const languageName = language === "en" ? "English" : "Greek";

  const employmentInfo = laborData.employment
    ? `Employment: ${laborData.employment.total_employment.toLocaleString()}`
    : "Employment data unavailable";

  const wageInfo = laborData.wages
    ? `Median wage: ${laborData.wages.currency} ${laborData.wages.median_wage.toLocaleString()}`
    : "Wage data unavailable";

  const skillsCount = laborData.skills?.core_skills?.length || 0;

  return `You are a labor market analyst summarizing employment and skills for the occupation: "${occupation.input}".

Write the "Labor Market Structure" analysis in ${languageName}.

## Input Data

**Occupation**: ${occupation.input}
**Region**: ${laborData.occupation.region}
**${employmentInfo}**
**${wageInfo}**
**Core Skills**: ${skillsCount} identified

## Requirements

Provide a comprehensive labor market analysis covering:

1. **Employment Statistics**: Current employment levels, trends, geographic distribution
2. **Wage Data**: Median wage, wage ranges, comparison to national averages
3. **Demographics**: Age distribution, education requirements, gender distribution (if available)
4. **Skills Profile**: Top 10 most important skills categorized as technical, soft, or digital
5. **Automation Risk**: Assessment of automation probability and vulnerable vs. resilient tasks

## Output Format

Return ONLY a JSON object:

{
  "employment_summary": "2-3 sentence summary of employment situation",
  "wage_summary": "1-2 sentence summary of wage levels",
  "demographics_summary": "1-2 sentence summary of workforce demographics",
  "top_skills": [
    {
      "skill": "Skill Name",
      "category": "technical" | "soft" | "digital",
      "importance": "high" | "medium" | "low"
    }
  ],
  "automation_risk": {
    "level": "low" | "medium" | "high",
    "summary": "1-2 sentence explanation of automation risk"
  }
}

Use data-driven language. Cite specific numbers where available.`;
}

// ============================================================================
// SECTION 5: FUTURE SCENARIOS
// ============================================================================

export function getFutureScenariosPrompt(
  occupation: OccupationTaxonomy,
  topics: TopicInfo[],
  trends: SectorTrendsData,
  language: "en" | "el"
): string {
  const languageName = language === "en" ? "English" : "Greek";
  const topicsSummary = topics
    .filter((t) => t.topicNumber >= 0)
    .slice(0, 5)
    .map((t) => `${t.topicNumber}: ${t.representation.slice(0, 4).join(", ")}`)
    .join(" | ");

  return `You are a labor market futurist creating future scenarios for the occupation: "${occupation.input}".

Write THREE distinct future scenarios in ${languageName}.

## Input Data

**Occupation**: ${occupation.input}
**Research Topics**: ${topicsSummary}
**Key Technologies**: ${trends.technologies.slice(0, 5).map((t) => t.name).join(", ")}

## Requirements

Create THREE plausible future scenarios (5-10 year horizon):

1. **Technology-Driven Transformation**: How emerging technologies reshape this occupation
2. **Sustainability-Driven Restructuring**: How environmental forces change practices
3. **Demographic/Regional Adaptation**: How demographic shifts and regional needs evolve the role

For each scenario, provide:

1. **Scenario Name**: Concise, compelling title
2. **Description**: 150-200 word narrative describing this future (written in present tense as if it's happening)
3. **Key Technologies**: 3-5 enabling technologies
4. **Emerging Roles**: 2-4 new job roles or specializations that emerge
5. **Required Skills**: 5-8 critical skills needed in this scenario
6. **Key Competencies**: 3-5 essential competencies for success

## Output Format

Return ONLY a JSON array:

[
  {
    "name": "Scenario Name",
    "description": "Narrative description in present tense...",
    "key_technologies": ["Tech 1", "Tech 2"],
    "emerging_roles": [
      {
        "role": "Role Name",
        "description": "What this role does"
      }
    ],
    "required_skills": ["Skill 1", "Skill 2"],
    "key_competencies": ["Competency 1", "Competency 2"]
  }
]

Make scenarios realistic, specific, and actionable. Base them on current trends.`;
}

// ============================================================================
// HELPER: Full Report Prompt (Alternative: All-in-One)
// ============================================================================

export function getFullReportPrompt(
  occupation: OccupationTaxonomy,
  topics: TopicInfo[],
  papers: AcademicPaper[],
  laborData: LaborMarketData,
  trends: SectorTrendsData,
  language: "en" | "el"
): string {
  const languageName = language === "en" ? "English" : "Greek";

  return `You are a senior labor market analyst creating a comprehensive sector report for: "${occupation.input}".

Generate a complete sector analysis report in ${languageName} covering ALL sections:

1. Sector Definition
2. Exogenous Forces (Social, Technological, Environmental)
3. Technology Catalog
4. Labor Market Structure
5. Future Scenarios

Use ALL the provided data to create an evidence-based, professional report.

## Data Available

- **${topics.length} research topics** from ${papers.length} academic papers
- **${trends.technologies.length} technologies** identified
- **Labor market data** from ${laborData.metadata.data_sources.join(", ")}
- **Region**: ${laborData.occupation.region}

Return a complete JSON object with all sections as defined in the individual section prompts.

Be thorough, specific, and professional. This report will guide educational program design.`;
}
