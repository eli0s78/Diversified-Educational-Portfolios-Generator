import type { SupervisorMatch } from "@/lib/engine/portfolio-types";
import { TRAINING_DIRECTIONS } from "@/lib/engine/portfolio-types";
import supervisorsData from "@/lib/data/supervisors.json";

interface SupervisorRecord {
  id: number;
  name: string;
  nameEn: string | null;
  domain: string;
  field: string;
  role: string;
  specialties: string[];
  directionAffinities: Record<string, number>;
}

const allSupervisors: SupervisorRecord[] = supervisorsData as SupervisorRecord[];

// ─────────────────────────────────────────────────
// Semantic expansion: maps course-content terms to
// supervisor field/specialty terms that are related
// but wouldn't match literally.
// ─────────────────────────────────────────────────

const SEMANTIC_MAP: Record<string, string[]> = {
  // Construction & built environment
  construction: ["architecture", "built environment", "engineering", "materials science", "civil", "surveying"],
  building: ["architecture", "built environment", "engineering", "civil"],
  infrastructure: ["engineering", "architecture", "built environment", "surveying", "civil"],
  concrete: ["materials science", "engineering", "chemical", "chemistry"],
  // Sustainability & green
  sustainable: ["environmental", "agriculture", "climatology", "ecology", "biology"],
  sustainability: ["environmental", "agriculture", "climatology", "ecology"],
  green: ["environmental", "agriculture", "ecology", "biology"],
  circular: ["environmental", "economics", "management", "chemistry"],
  recycling: ["environmental", "chemistry", "materials science"],
  biochar: ["chemistry", "environmental", "agriculture", "biology"],
  // Entrepreneurship & business
  entrepreneurship: ["business", "management", "economics", "innovation", "finance", "marketing", "commercial"],
  entrepreneur: ["business", "management", "economics", "innovation", "finance"],
  business: ["management", "economics", "marketing", "finance", "commercial", "business administration"],
  venture: ["business", "management", "economics", "finance", "innovation"],
  startup: ["business", "management", "economics", "innovation", "marketing"],
  feasibility: ["economics", "finance", "management", "engineering"],
  economic: ["economics", "finance", "business administration", "management"],
  market: ["marketing", "economics", "business", "management", "commercial"],
  commercial: ["marketing", "business", "management", "economics", "commercial management"],
  strategic: ["management", "economics", "business", "innovation", "planning"],
  innovation: ["innovation management", "management", "business", "informatics", "engineering"],
  // Digital & tech
  digital: ["informatics", "computer science", "information systems", "digital", "multimedia", "digital arts"],
  software: ["informatics", "computer science", "information systems", "software"],
  automation: ["automation", "robotics", "engineering", "informatics"],
  ai: ["informatics", "computer science", "artificial intelligence", "machine learning"],
  iot: ["informatics", "electronics", "telecommunications", "engineering"],
  data: ["informatics", "computer science", "mathematics", "statistics"],
  // Education & learning
  learning: ["education", "pedagogy", "adult education", "educational psychology"],
  training: ["education", "pedagogy", "adult education", "sports science"],
  curriculum: ["education", "pedagogy", "educational administration"],
  teaching: ["education", "pedagogy", "science education"],
  // Health & medicine
  health: ["medicine", "nursing", "pharmacy", "psychology", "health", "physiotherapy"],
  medical: ["medicine", "pharmacy", "nursing", "biochemistry"],
  clinical: ["medicine", "psychology", "nursing", "pharmacy"],
  therapy: ["physiotherapy", "occupational therapy", "psychology", "medicine"],
  nutrition: ["nutrition", "food science", "dietetics", "food technology"],
  // Law & regulation
  legal: ["law", "public law", "civil law", "private law"],
  regulation: ["law", "public law", "political science", "economics"],
  compliance: ["law", "auditing", "management", "public law"],
  // Leadership & management
  leadership: ["management", "business administration", "psychology", "human resource"],
  negotiation: ["management", "law", "political science", "human resource"],
  hr: ["human resource management", "management", "psychology", "sociology"],
  management: ["management", "business administration", "economics", "human resource"],
  // Science & engineering fields
  engineering: ["engineering", "mechanical engineering", "electrical engineering", "chemical engineering", "aerospace engineering"],
  physics: ["physics", "environmental physics", "nuclear physics", "biophysics"],
  chemistry: ["chemistry", "environmental chemistry", "pharmaceutical chemistry", "food chemistry"],
  biology: ["biology", "molecular biology", "genetics", "microbiology"],
  materials: ["materials science", "chemistry", "engineering", "physics"],
  energy: ["physics", "engineering", "environmental", "chemistry"],
  // Communication
  communication: ["media studies", "journalism", "communication", "marketing"],
  media: ["media studies", "journalism", "multimedia", "communication"],
  // Agriculture
  agriculture: ["agriculture", "precision agriculture", "agricultural development", "food science"],
  farming: ["agriculture", "precision agriculture", "agricultural development"],
  food: ["food science", "food technology", "food chemistry", "nutrition", "enology"],
  // Tourism & culture
  tourism: ["tourism management", "tourism economics", "management", "marketing"],
  culture: ["sociology", "anthropology", "history", "archaeology"],
  heritage: ["archaeology", "history", "conservation", "art conservation"],
};

/**
 * Match supervisors to a specific course based on its actual content.
 * Scores each supervisor by how well their field/specialties relate
 * to the course title, overview, and module topics.
 */
export function matchSupervisorsToCourse(
  courseTitle: string,
  courseOverview: string,
  moduleTopics: string[],
  limit: number = 3
): SupervisorMatch[] {
  // Build course text corpus (lowercased)
  const courseText = [courseTitle, courseOverview, ...moduleTopics]
    .join(" ")
    .toLowerCase();

  // Extract unique meaningful words from course text (3+ chars, skip stop words)
  const STOP_WORDS = new Set([
    "the", "and", "for", "are", "this", "that", "with", "from", "will", "have",
    "has", "been", "was", "were", "not", "but", "can", "its", "all", "their",
    "our", "your", "into", "also", "such", "than", "more", "most", "each",
    "which", "when", "what", "how", "who", "may", "both", "these", "those",
    "through", "between", "toward", "towards", "based", "using", "while",
    "about", "over", "under", "after", "before", "during", "within",
    "across", "along", "upon", "course", "module", "unit", "students",
    "program", "designed", "provides", "requires", "including", "specific",
    "approach", "ensuring", "capable", "covers", "serves",
    // Greek stop words
    "και", "για", "στο", "στη", "στα", "στις", "στον", "στην", "του", "της",
    "των", "από", "με", "που", "ένα", "μια", "τον", "την", "τα", "οι",
  ]);

  const courseWords = new Set(
    courseText
      .replace(/[^a-zα-ωά-ώ0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
  );

  // Expand course words using semantic map
  const expandedTerms = new Set<string>();
  for (const word of courseWords) {
    expandedTerms.add(word);
    const expansions = SEMANTIC_MAP[word];
    if (expansions) {
      for (const e of expansions) {
        expandedTerms.add(e.toLowerCase());
      }
    }
  }

  // Score each supervisor
  const scored = allSupervisors.map((s) => {
    // Build supervisor searchable tokens
    const supTokens = [s.domain, s.field, ...s.specialties]
      .map((t) => t.toLowerCase());
    const supText = supTokens.join(" | ");

    let score = 0;

    // 1. Check if supervisor field/specialty words appear in course text (direct)
    for (const token of supTokens) {
      const tokenWords = token.split(/\s+/);
      for (const tw of tokenWords) {
        if (tw.length >= 3 && courseWords.has(tw)) {
          score += 2;
        }
      }
      // Full phrase match in course text (e.g. "materials science")
      if (token.length > 3 && courseText.includes(token)) {
        score += 5;
      }
    }

    // 2. Check if expanded course terms match supervisor metadata
    for (const term of expandedTerms) {
      if (supText.includes(term)) {
        score += 3;
      }
    }

    // 3. Bonus for multi-word specialty matches against course text
    for (const spec of s.specialties) {
      const specLower = spec.toLowerCase();
      if (courseText.includes(specLower)) {
        score += 10; // Strong bonus for exact specialty match
      }
      // Check individual words of specialty
      const specWords = specLower.split(/\s+/).filter((w) => w.length >= 4);
      const matchCount = specWords.filter((w) => courseText.includes(w)).length;
      if (matchCount > 0) {
        score += matchCount * 2;
      }
    }

    // 4. Field relevance bonus
    const fieldLower = s.field.toLowerCase();
    if (courseText.includes(fieldLower)) {
      score += 8;
    }
    // Check individual words of field
    const fieldWords = fieldLower.split(/\s+/).filter((w) => w.length >= 4);
    for (const fw of fieldWords) {
      if (courseText.includes(fw)) {
        score += 3;
      }
    }

    return { supervisor: s, score };
  });

  // Filter out zero scores, sort descending, take top N
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({
      id: s.supervisor.id,
      name: s.supervisor.name,
      role: s.supervisor.role,
      domain: s.supervisor.domain,
      field: s.supervisor.field,
      specialties: s.supervisor.specialties,
      affinityScore: Math.min(1.0, s.score / 30), // Normalize to 0-1 range
    }));
}

/**
 * Get top supervisors for a specific training direction, ranked by affinity.
 * (Legacy: kept for backward compatibility but content-based matching is preferred.)
 */
export function getSupervisorsForDirection(
  directionId: number,
  limit: number = 5
): SupervisorMatch[] {
  return allSupervisors
    .filter((s) => s.directionAffinities[String(directionId)] != null)
    .map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      domain: s.domain,
      field: s.field,
      specialties: s.specialties,
      affinityScore: s.directionAffinities[String(directionId)],
    }))
    .sort((a, b) => b.affinityScore - a.affinityScore)
    .slice(0, limit);
}

/**
 * Get matching supervisors for multiple training direction keys.
 * (Legacy: direction-based matching.)
 */
export function getSupervisorsForDirections(
  directionKeys: string[],
  limit: number = 3
): Record<string, SupervisorMatch[]> {
  const result: Record<string, SupervisorMatch[]> = {};

  for (const key of directionKeys) {
    const direction = TRAINING_DIRECTIONS.find((d) => d.key === key);
    if (!direction) continue;
    result[key] = getSupervisorsForDirection(direction.id, limit);
  }

  return result;
}

/**
 * Content-based supervisor matching for generated courses.
 * Matches supervisors based on actual course content (title, overview, modules)
 * rather than just the training direction.
 */
export function matchSupervisorsToCoursesContentBased(
  courses: Array<{
    trainingDirection: string;
    title: string;
    overview: string;
    modules: Array<{ title: string; description: string }>;
  }>,
  limit: number = 3
): Record<string, SupervisorMatch[]> {
  const result: Record<string, SupervisorMatch[]> = {};

  for (const course of courses) {
    const moduleTopics = course.modules.map((m) => `${m.title} ${m.description}`);
    result[course.trainingDirection] = matchSupervisorsToCourse(
      course.title,
      course.overview,
      moduleTopics,
      limit
    );
  }

  return result;
}
