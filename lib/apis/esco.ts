/**
 * ESCO (European Skills, Competences, Qualifications and Occupations) API Client
 *
 * Free, no API key required
 * Docs: https://esco.ec.europa.eu/en/use-esco/technical-documentation
 */

import type { ESCOOccupation } from "@/lib/types/research";

const BASE_URL = "https://ec.europa.eu/esco/api";

export interface ESCOSkill {
  uri: string;
  preferredLabel: {
    en: string;
    [lang: string]: string;
  };
  description?: {
    en: string;
    [lang: string]: string;
  };
  skillType?: string; // "skill/competence" or "knowledge"
  reuseLevel?: string; // "transversal", "sector-specific", "occupation-specific"
}

export interface ESCOOccupationFull extends ESCOOccupation {
  essentialSkills?: ESCOSkill[];
  optionalSkills?: ESCOSkill[];
  iscoGroup?: string;
}

/**
 * Search ESCO occupations by text
 */
export async function searchESCOOccupations(
  text: string,
  language: string = "en",
  limit: number = 10
): Promise<ESCOOccupation[]> {
  const url = new URL(`${BASE_URL}/search`);
  url.searchParams.set("text", text);
  url.searchParams.set("language", language);
  url.searchParams.set("type", "occupation");
  url.searchParams.set("limit", limit.toString());

  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ESCO API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data._embedded?.results || [];
}

/**
 * Get occupation details by URI
 */
export async function getESCOOccupationDetails(
  uri: string,
  language: string = "en"
): Promise<ESCOOccupationFull> {
  const url = new URL(`${BASE_URL}/resource/occupation`);
  url.searchParams.set("uri", uri);
  url.searchParams.set("language", language);

  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ESCO API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Get essential skills for an occupation
 */
export async function getESCOEssentialSkills(
  occupationUri: string,
  language: string = "en"
): Promise<ESCOSkill[]> {
  const url = new URL(`${BASE_URL}/resource/occupation`);
  url.searchParams.set("uri", occupationUri);
  url.searchParams.set("language", language);

  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ESCO API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.hasEssentialSkill || [];
}

/**
 * Get optional skills for an occupation
 */
export async function getESCOOptionalSkills(
  occupationUri: string,
  language: string = "en"
): Promise<ESCOSkill[]> {
  const url = new URL(`${BASE_URL}/resource/occupation`);
  url.searchParams.set("uri", occupationUri);
  url.searchParams.set("language", language);

  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ESCO API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.hasOptionalSkill || [];
}

/**
 * Map ESCO occupation to ISCO-08 code
 */
export function getISCOCode(occupation: ESCOOccupationFull): string | undefined {
  return occupation.iscoGroup;
}

/**
 * Categorize ESCO skills by type
 */
export function categorizeSkills(skills: ESCOSkill[]): {
  technical: ESCOSkill[];
  soft: ESCOSkill[];
  digital: ESCOSkill[];
} {
  const technical: ESCOSkill[] = [];
  const soft: ESCOSkill[] = [];
  const digital: ESCOSkill[] = [];

  for (const skill of skills) {
    const label = skill.preferredLabel.en?.toLowerCase() || "";
    const desc = skill.description?.en?.toLowerCase() || "";

    // Simple heuristic categorization
    if (
      label.includes("software") ||
      label.includes("digital") ||
      label.includes("computer") ||
      label.includes("programming") ||
      desc.includes("digital")
    ) {
      digital.push(skill);
    } else if (
      label.includes("communication") ||
      label.includes("teamwork") ||
      label.includes("leadership") ||
      label.includes("problem solving") ||
      skill.reuseLevel === "transversal"
    ) {
      soft.push(skill);
    } else {
      technical.push(skill);
    }
  }

  return { technical, soft, digital };
}
