import type { TopicInfo, Paper } from "./portfolio-types";
import { TRAINING_DIRECTIONS } from "./portfolio-types";

/**
 * Compute expected returns for each training direction
 * based on how well it covers the sector's topic landscape.
 *
 * Return = weighted combination of:
 *   - coverage: fraction of papers addressable by this direction
 *   - rarity_premium: bonus for covering RARE topics
 *   - breadth: how many distinct topics are covered
 */
export function computeExpectedReturns(
  topics: TopicInfo[],
  affinityMatrix: Record<number, number[]>
): number[] {
  const activeTopics = topics.filter((t) => t.topicNumber !== -1);
  const totalPapers = activeTopics.reduce((sum, t) => sum + t.count, 0);
  const numDirections = TRAINING_DIRECTIONS.length;
  const returns = new Array(numDirections).fill(0);

  const COVERAGE_WEIGHT = 0.5;
  const RARITY_WEIGHT = 0.3;
  const BREADTH_WEIGHT = 0.2;
  const RARITY_PREMIUM = 2.0;
  const AFFINITY_THRESHOLD = 0.3;

  for (let d = 0; d < numDirections; d++) {
    // Coverage: weighted fraction of papers this direction addresses
    let coverage = 0;
    let rarityBonus = 0;
    let breadth = 0;

    for (const topic of activeTopics) {
      const affinity = affinityMatrix[topic.topicNumber]?.[d] ?? 0;

      coverage += topic.count * affinity;

      if (topic.rarityLabel === "RARE") {
        rarityBonus += topic.count * affinity * RARITY_PREMIUM;
      }

      if (affinity > AFFINITY_THRESHOLD) {
        breadth += 1;
      }
    }

    coverage /= Math.max(totalPapers, 1);
    rarityBonus /= Math.max(totalPapers, 1);
    breadth /= Math.max(activeTopics.length, 1);

    returns[d] =
      COVERAGE_WEIGHT * coverage +
      RARITY_WEIGHT * rarityBonus +
      BREADTH_WEIGHT * breadth;
  }

  return returns;
}

/**
 * Compute covariance matrix between training directions.
 *
 * Two directions have HIGH covariance if they map to the same topics
 * (investing in both doesn't truly diversify).
 */
export function computeCovarianceMatrix(
  topics: TopicInfo[],
  affinityMatrix: Record<number, number[]>
): number[][] {
  const activeTopics = topics.filter((t) => t.topicNumber !== -1);
  const n = TRAINING_DIRECTIONS.length;

  // Build affinity vectors per direction
  const vectors: number[][] = Array.from({ length: n }, () => []);
  for (const topic of activeTopics) {
    const affinities = affinityMatrix[topic.topicNumber] ?? new Array(n).fill(0);
    for (let d = 0; d < n; d++) {
      vectors[d].push(affinities[d]);
    }
  }

  // Compute means
  const means = vectors.map((v) => v.reduce((a, b) => a + b, 0) / v.length);

  // Compute covariance
  const cov: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const m = activeTopics.length;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < m; k++) {
        sum += (vectors[i][k] - means[i]) * (vectors[j][k] - means[j]);
      }
      cov[i][j] = sum / Math.max(m - 1, 1);
    }
  }

  // Add small diagonal for numerical stability
  for (let i = 0; i < n; i++) {
    cov[i][i] += 0.001;
  }

  return cov;
}

/**
 * Get relevant papers for a specific training direction,
 * sorted by topic affinity to that direction.
 */
export function getRelevantPapers(
  papers: Paper[],
  directionIndex: number,
  affinityMatrix: Record<number, number[]>,
  maxPapers = 15
): Paper[] {
  return papers
    .filter((p) => p.topicNumber !== -1)
    .map((p) => ({
      ...p,
      _affinity: affinityMatrix[p.topicNumber]?.[directionIndex] ?? 0,
    }))
    .sort((a, b) => b._affinity - a._affinity)
    .slice(0, maxPapers)
    .map(({ _affinity, ...paper }) => paper);
}
