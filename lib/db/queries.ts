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

/**
 * Get top supervisors for a specific training direction, ranked by affinity.
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
 * Returns a map of directionKey → SupervisorMatch[].
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
