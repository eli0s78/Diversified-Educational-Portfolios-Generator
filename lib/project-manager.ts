import type { CourseOutline, SourceData, AnalysisResult, PipelineStatus, SupervisorMatch } from "@/lib/engine/portfolio-types";
import { nativeSaveFile } from "@/lib/native-save";

// ============================================================
// Types
// ============================================================

export interface AppSettings {
  name: string;
  apiKey: string;
  verifiedModel?: string;
  verifiedTier?: "free" | "paid" | null;

  // Research & Data Collection API Keys
  semantic_scholar_api_key?: string;
  exa_api_key?: string;
  onet_api_key?: string;
  bls_api_key?: string;
  tavily_api_key?: string;
  firecrawl_api_key?: string;
  bertopic_service_url?: string;
}

export interface ProjectIndexEntry {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
}

export interface ProjectConfig {
  programInstructions: string;
  educationLevel: "high_school" | "bachelor" | "master" | "phd";
}

export interface SavedPortfolio {
  id: string;
  label: string;
  savedAt: string;
  riskTolerance: number;
  weights: number[];
  expectedReturn: number;
  risk: number;
  sharpeRatio: number;
  diversificationScore: number;
  isOptimized?: boolean;
}

export interface ProjectPortfolioResult {
  frontier: Array<{
    risk: number;
    return_: number;
    weights: number[];
    sharpeRatio: number;
  }>;
  selectedPortfolio: {
    weights: number[];
    expectedReturn: number;
    risk: number;
    sharpeRatio: number;
    diversificationScore: number;
  };
  riskTolerance: number;
}

export interface ProjectData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  config: ProjectConfig;
  sourceData: SourceData | null;
  analysis: AnalysisResult | null;
  portfolioResult: ProjectPortfolioResult | null;
  courses: CourseOutline[];
  courseSupervisors: Record<string, SupervisorMatch[]> | null; // key = trainingDirectionKey
  savedPortfolios: SavedPortfolio[];
  activePortfolioId: string | null;
  generatedWithPortfolioId: string | null;
  pipelineStatus: PipelineStatus;
  pipelineError: string | null;
  pipelineStep: number;
}

// ============================================================
// localStorage Keys
// ============================================================

const KEYS = {
  SETTINGS: "dep-settings",
  CURRENT_PROJECT: "dep-current-project",
  PROJECTS_INDEX: "dep-projects-index",
  projectData: (id: string) => `dep-project-${id}`,
  // Legacy keys for migration
  LEGACY_PROFILE: "dep-profile",
  LEGACY_WEIGHTS: "dep-weights",
  LEGACY_COURSES: "dep-courses",
} as const;

// ============================================================
// Helpers
// ============================================================

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ============================================================
// App Settings (global, not per-project)
// ============================================================

const DEFAULT_SETTINGS: AppSettings = {
  name: "",
  apiKey: "",
};

export function getSettings(): AppSettings {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = readJSON<any>(KEYS.SETTINGS, DEFAULT_SETTINGS);

  // Migrate from old multi-provider format
  if ("providers" in raw && typeof raw.providers === "object") {
    const geminiKey = raw.providers?.gemini?.apiKey ||
      raw.providers?.[raw.activeProvider]?.apiKey || "";
    const geminiModel = raw.providers?.gemini?.verifiedModel ||
      raw.providers?.[raw.activeProvider]?.verifiedModel;
    const geminiTier = raw.providers?.gemini?.verifiedTier ||
      raw.providers?.[raw.activeProvider]?.verifiedTier;
    const migrated: AppSettings = {
      name: raw.name || "",
      apiKey: geminiKey,
      verifiedModel: geminiModel,
      verifiedTier: geminiTier,
    };
    saveSettings(migrated);
    return migrated;
  }

  // Migrate from even older single-key format
  if ("aiProvider" in raw && !("providers" in raw)) {
    const migrated: AppSettings = {
      name: raw.name || "",
      apiKey: raw.apiKey || "",
      verifiedModel: raw.verifiedModel,
      verifiedTier: raw.verifiedTier,
    };
    saveSettings(migrated);
    return migrated;
  }

  return {
    name: raw.name || "",
    apiKey: raw.apiKey || "",
    verifiedModel: raw.verifiedModel,
    verifiedTier: raw.verifiedTier,
  };
}

export function saveSettings(settings: AppSettings): void {
  writeJSON(KEYS.SETTINGS, settings);
}

/** Get the Gemini API key and verified model info */
export function getActiveProviderSettings(): {
  apiKey: string;
  verifiedModel?: string;
} {
  const s = getSettings();
  return {
    apiKey: s.apiKey,
    verifiedModel: s.verifiedModel,
  };
}

// ============================================================
// Project Index
// ============================================================

export function listProjects(): ProjectIndexEntry[] {
  return readJSON<ProjectIndexEntry[]>(KEYS.PROJECTS_INDEX, []);
}

function saveIndex(index: ProjectIndexEntry[]): void {
  writeJSON(KEYS.PROJECTS_INDEX, index);
}

// ============================================================
// Project CRUD
// ============================================================

export function loadProject(id: string): ProjectData | null {
  return readJSON<ProjectData | null>(KEYS.projectData(id), null);
}

export function saveProject(project: ProjectData): void {
  project.updatedAt = new Date().toISOString();
  writeJSON(KEYS.projectData(project.id), project);

  // Update index entry
  const index = listProjects();
  const existing = index.findIndex((e) => e.id === project.id);
  const entry: ProjectIndexEntry = {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    createdAt: project.createdAt,
  };
  if (existing >= 0) {
    index[existing] = entry;
  } else {
    index.push(entry);
  }
  saveIndex(index);
}

export function createNewProject(): ProjectData {
  const now = new Date().toISOString();
  const project: ProjectData = {
    id: generateId(),
    name: "Untitled Project",
    createdAt: now,
    updatedAt: now,
    config: {
      programInstructions: "",
      educationLevel: "bachelor",
    },
    sourceData: null,
    analysis: null,
    portfolioResult: null,
    courses: [],
    courseSupervisors: null,
    savedPortfolios: [],
    activePortfolioId: null,
    generatedWithPortfolioId: null,
    pipelineStatus: "idle",
    pipelineError: null,
    pipelineStep: 0,
  };
  saveProject(project);
  setCurrentProjectId(project.id);
  return project;
}

export function renameProject(id: string, newName: string): void {
  const project = loadProject(id);
  if (!project) return;
  project.name = newName;
  saveProject(project);
}

export function deleteProject(id: string): void {
  if (typeof window === "undefined") return;
  // Remove from index
  const index = listProjects().filter((e) => e.id !== id);
  saveIndex(index);
  // Remove data
  localStorage.removeItem(KEYS.projectData(id));
  // Clear current if this was active
  if (getCurrentProjectId() === id) {
    localStorage.removeItem(KEYS.CURRENT_PROJECT);
  }
}

// ============================================================
// Current Project
// ============================================================

export function getCurrentProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEYS.CURRENT_PROJECT);
}

export function setCurrentProjectId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.CURRENT_PROJECT, id);
}

export function getCurrentProject(): ProjectData | null {
  const id = getCurrentProjectId();
  if (!id) return null;
  return loadProject(id);
}

// ============================================================
// File Export / Import
// ============================================================

export async function exportProjectToFile(project: ProjectData): Promise<void> {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  let safeName = (project.name || "project").replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim().replace(/\s+/g, "_");
  if (!safeName) safeName = "project";
  await nativeSaveFile(blob, `${safeName}.dep.json`, ['.dep.json', '.json'], 'DEP Project File');
}

export function importProjectFromFile(file: File): Promise<ProjectData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        // Validate minimum required shape
        if (!raw.config || typeof raw.config !== "object") {
          throw new Error("Invalid project file: missing config");
        }
        // Detect old format (has sectorId) vs new format (has sourceData/analysis)
        const isLegacyFormat = "sectorId" in raw.config;
        const now = new Date().toISOString();
        const project: ProjectData = {
          id: generateId(),
          name: raw.name || (isLegacyFormat ? raw.config.programTitle : null) || "Imported Project",
          createdAt: raw.createdAt || now,
          updatedAt: now,
          config: {
            programInstructions: raw.config.programInstructions || "",
            educationLevel: raw.config.educationLevel || "bachelor",
          },
          sourceData: raw.sourceData || null,
          analysis: raw.analysis || null,
          portfolioResult: raw.portfolioResult || null,
          courses: Array.isArray(raw.courses) ? raw.courses : [],
          courseSupervisors: raw.courseSupervisors || null,
          savedPortfolios: Array.isArray(raw.savedPortfolios) ? raw.savedPortfolios : [],
          activePortfolioId: raw.activePortfolioId || null,
          generatedWithPortfolioId: raw.generatedWithPortfolioId || null,
          pipelineStatus: raw.pipelineStatus || (raw.courses?.length > 0 ? "complete" : "idle"),
          pipelineError: raw.pipelineError || null,
          pipelineStep: raw.pipelineStep ?? 0,
        };
        saveProject(project);
        setCurrentProjectId(project.id);
        resolve(project);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Failed to parse project file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

// ============================================================
// Legacy Migration
// ============================================================

export function migrateLegacyData(): boolean {
  if (typeof window === "undefined") return false;

  const legacyProfile = localStorage.getItem(KEYS.LEGACY_PROFILE);
  if (!legacyProfile) return false;

  // Don't migrate if projects already exist
  const existingIndex = localStorage.getItem(KEYS.PROJECTS_INDEX);
  if (existingIndex) return false;

  try {
    const profile = JSON.parse(legacyProfile);

    // Extract app settings
    const migratedSettings: AppSettings = {
      name: profile.name || "",
      apiKey: profile.apiKey || "",
    };
    saveSettings(migratedSettings);

    // Create project from remaining fields
    const project = createNewProject();
    project.config = {
      programInstructions: profile.programInstructions || "",
      educationLevel: profile.educationLevel || "bachelor",
    };
    project.name = profile.programTitle || "Migrated Project";

    // Migrate weights
    const legacyWeights = localStorage.getItem(KEYS.LEGACY_WEIGHTS);
    if (legacyWeights) {
      const weights = JSON.parse(legacyWeights);
      if (Array.isArray(weights)) {
        project.portfolioResult = {
          frontier: [],
          selectedPortfolio: {
            weights,
            expectedReturn: 0,
            risk: 0,
            sharpeRatio: 0,
            diversificationScore: 0,
          },
          riskTolerance: 0.5,
        };
      }
    }

    // Migrate courses
    const legacyCourses = localStorage.getItem(KEYS.LEGACY_COURSES);
    if (legacyCourses) {
      const courses = JSON.parse(legacyCourses);
      if (Array.isArray(courses)) {
        project.courses = courses;
      }
    }

    saveProject(project);
    setCurrentProjectId(project.id);

    // Clean up legacy keys
    localStorage.removeItem(KEYS.LEGACY_PROFILE);
    localStorage.removeItem(KEYS.LEGACY_WEIGHTS);
    localStorage.removeItem(KEYS.LEGACY_COURSES);

    return true;
  } catch (e) {
    console.error("Legacy migration failed:", e);
    return false;
  }
}
