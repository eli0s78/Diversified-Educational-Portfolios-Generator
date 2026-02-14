import { z } from "zod/v4";

// ============================================================
// Training Directions (the 6 "asset classes" in our MPT analogy)
// ============================================================

export const TRAINING_DIRECTIONS = [
  {
    id: 1,
    key: "new_technologies",
    name: "New Technologies & Communication Media",
    name_el: "Νέες Τεχνολογίες & Μέσα Επικοινωνίας",
    description: "Digital transformation, AI, automation, Industry 4.0, BIM, IoT, digital twins",
  },
  {
    id: 2,
    key: "trend_analysis",
    name: "Trend Analysis & Strategic Planning",
    name_el: "Ανάλυση Τάσεων & Στρατηγικός Σχεδιασμός",
    description: "Foresight, scenario planning, market analysis, strategic decision-making",
  },
  {
    id: 3,
    key: "sales_techniques",
    name: "Contemporary Sales Techniques",
    name_el: "Σύγχρονες Τεχνικές Πωλήσεων",
    description: "Customer acquisition, marketing, business development, value proposition",
  },
  {
    id: 4,
    key: "negotiation_hr",
    name: "Negotiation & HR Management",
    name_el: "Διαπραγμάτευση & Διοίκηση Ανθρώπινου Δυναμικού",
    description: "Leadership, team management, conflict resolution, organizational behavior",
  },
  {
    id: 5,
    key: "personal_growth_theory",
    name: "Personal Growth & Entrepreneurship (Theoretical)",
    name_el: "Προσωπική Ανάπτυξη & Επιχειρηματικότητα (Θεωρία)",
    description: "Time management, creativity, public speaking, entrepreneurial theory, culture",
  },
  {
    id: 6,
    key: "personal_growth_practical",
    name: "Personal Growth & Entrepreneurship (Practical)",
    name_el: "Προσωπική Ανάπτυξη & Επιχειρηματικότητα (Πρακτική)",
    description: "Hands-on projects, case studies, simulations, practical entrepreneurship",
  },
] as const;

export type TrainingDirectionKey = (typeof TRAINING_DIRECTIONS)[number]["key"];

export const DIRECTION_COLORS = [
  "var(--direction-1)",
  "var(--direction-2)",
  "var(--direction-3)",
  "var(--direction-4)",
  "var(--direction-5)",
  "var(--direction-6)",
] as const;

// ============================================================
// Skill Portfolio Categories (from the academic framework)
// ============================================================

export const SKILL_CATEGORIES = [
  { id: "foundational", name: "Foundational Skills", name_el: "Θεμελιώδεις Δεξιότητες", description: "Critical thinking, communication, problem-solving" },
  { id: "complex", name: "Complex/Specialized Skills", name_el: "Σύνθετες/Εξειδικευμένες Δεξιότητες", description: "Sector-specific technical knowledge" },
  { id: "digital", name: "Digital Skills", name_el: "Ψηφιακές Δεξιότητες", description: "AI, automation, data analytics, Industry 4.0" },
  { id: "green", name: "Green Skills", name_el: "Πράσινες Δεξιότητες", description: "Sustainability, circular economy, environmental assessment" },
  { id: "case_fit", name: "Case-Fit Skills", name_el: "Δεξιότητες Προσαρμογής", description: "Occupation and sector-specific applications" },
] as const;

// ============================================================
// Dynamic Sector Analysis Types
// ============================================================

export type PipelineStatus = "idle" | "analyzing" | "optimizing" | "generating" | "complete" | "error";

export interface AnalysisResult {
  sectorName: string;
  sectorDescription: string;
  affinityMatrix: Record<number, number[]>;
  programTitle: string;
  programDescription: string;
  targetAudience: string;
  educationLevel: string;
}

export interface SourceData {
  reports: Array<{ name: string; textContent: string }>;
  topics: TopicInfo[];
  papers: Paper[];
}

// ============================================================
// Zod Schemas
// ============================================================

export const TopicInfoSchema = z.object({
  topicNumber: z.number(),
  count: z.number(),
  name: z.string(),
  keywords: z.array(z.string()),
  representativeDocs: z.array(z.string()),
  rarityLabel: z.enum(["COMMON", "RARE", "NO_TOPIC"]),
});
export type TopicInfo = z.infer<typeof TopicInfoSchema>;

export const PaperSchema = z.object({
  id: z.string(),
  doi: z.string(),
  title: z.string(),
  abstract: z.string().optional(),
  year: z.number(),
  venue: z.string(),
  authors: z.string(),
  url: z.string(),
  source: z.string(),
  fields: z.string().optional(),
  topicNumber: z.number(),
  rarityLabel: z.enum(["COMMON", "RARE", "NO_TOPIC"]),
});
export type Paper = z.infer<typeof PaperSchema>;


export const SkillWeightsSchema = z.object({
  new_technologies: z.number().min(0).max(1),
  trend_analysis: z.number().min(0).max(1),
  sales_techniques: z.number().min(0).max(1),
  negotiation_hr: z.number().min(0).max(1),
  personal_growth_theory: z.number().min(0).max(1),
  personal_growth_practical: z.number().min(0).max(1),
});
export type SkillWeights = z.infer<typeof SkillWeightsSchema>;

export const PortfolioSchema = z.object({
  skillWeights: SkillWeightsSchema,
  expectedReturn: z.number(),
  riskScore: z.number(),
  diversificationScore: z.number(),
  sharpeRatio: z.number(),
  riskTolerance: z.number().min(0).max(1),
});
export type Portfolio = z.infer<typeof PortfolioSchema>;

export const FrontierPointSchema = z.object({
  risk: z.number(),
  return_: z.number(),
  weights: z.array(z.number()),
  sharpeRatio: z.number(),
});
export type FrontierPoint = z.infer<typeof FrontierPointSchema>;

export const UnitSchema = z.object({
  unitNumber: z.number().min(1).max(3),
  title: z.string(),
  content: z.string(),
  learningObjectives: z.array(z.string()),
  skillTags: z.array(z.string()),
  paperReferences: z.array(z.string()),
  estimatedMinutes: z.number(),
});
export type Unit = z.infer<typeof UnitSchema>;

export const ModuleSchema = z.object({
  moduleNumber: z.number().min(1).max(4),
  title: z.string(),
  description: z.string(),
  learningObjectives: z.array(z.string()),
  units: z.array(UnitSchema),
});
export type Module = z.infer<typeof ModuleSchema>;

export const CourseOutlineSchema = z.object({
  title: z.string(),
  overview: z.string(),
  trainingDirection: z.string(),
  totalHours: z.number(),
  modules: z.array(ModuleSchema),
});
export type CourseOutline = z.infer<typeof CourseOutlineSchema>;

// ============================================================
// Academic Supervisor Matching
// ============================================================

export interface SupervisorMatch {
  id: number;
  name: string;
  role: string;
  domain: string;
  field: string;
  specialties: string[];
  affinityScore: number;
}

// ============================================================
// Optimization constraints
// ============================================================

export interface DirectionConstraints {
  min: number;
  max: number;
}

export const DEFAULT_CONSTRAINTS: DirectionConstraints = {
  min: 0.05,
  max: 0.50,
};
