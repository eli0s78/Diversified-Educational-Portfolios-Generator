import { db } from "./index";
import {
  supervisors,
  supervisorSpecialties,
  supervisorDirectionAffinity,
} from "./schema";
import { eq, desc, inArray } from "drizzle-orm";
import type { SupervisorMatch } from "@/lib/engine/portfolio-types";
import { TRAINING_DIRECTIONS } from "@/lib/engine/portfolio-types";

/**
 * Get top supervisors for a specific training direction, ranked by affinity.
 */
export function getSupervisorsForDirection(
  directionId: number,
  limit: number = 5
): SupervisorMatch[] {
  const rows = db
    .select({
      id: supervisors.id,
      name: supervisors.name,
      role: supervisors.role,
      domain: supervisors.domain,
      field: supervisors.field,
      affinityScore: supervisorDirectionAffinity.affinityScore,
    })
    .from(supervisorDirectionAffinity)
    .innerJoin(
      supervisors,
      eq(supervisors.id, supervisorDirectionAffinity.supervisorId)
    )
    .where(eq(supervisorDirectionAffinity.directionId, directionId))
    .orderBy(desc(supervisorDirectionAffinity.affinityScore))
    .limit(limit)
    .all();

  if (rows.length === 0) return [];

  // Fetch specialties for matched supervisors
  const ids = rows.map((r) => r.id);
  const specs = db
    .select({
      supervisorId: supervisorSpecialties.supervisorId,
      specialty: supervisorSpecialties.specialty,
    })
    .from(supervisorSpecialties)
    .where(inArray(supervisorSpecialties.supervisorId, ids))
    .all();

  const specMap = new Map<number, string[]>();
  for (const s of specs) {
    const arr = specMap.get(s.supervisorId) || [];
    arr.push(s.specialty);
    specMap.set(s.supervisorId, arr);
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    domain: r.domain,
    field: r.field,
    specialties: specMap.get(r.id) || [],
    affinityScore: r.affinityScore,
  }));
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
