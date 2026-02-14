import { NextResponse } from "next/server";
import {
  computeExpectedReturns,
  computeCovarianceMatrix,
} from "@/lib/engine/skill-mapper";
import {
  TRAINING_DIRECTIONS,
  DEFAULT_CONSTRAINTS,
} from "@/lib/engine/portfolio-types";
import type { TopicInfo } from "@/lib/engine/portfolio-types";

/**
 * TypeScript implementation of portfolio optimization.
 * This is used when the Python serverless function is not available (local dev).
 * For production on Vercel, the Python /api/optimize endpoint is preferred.
 */
function optimizePortfolioTS(
  expectedReturns: number[],
  covMatrix: number[][],
  targetReturn: number,
  bounds: [number, number][]
): number[] {
  const n = expectedReturns.length;

  // Simple gradient descent with projection
  let weights = new Array(n).fill(1 / n);
  const lr = 0.01;
  const iterations = 2000;

  for (let iter = 0; iter < iterations; iter++) {
    // Gradient of portfolio variance: 2 * Sigma * w
    const grad = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        grad[i] += 2 * covMatrix[i][j] * weights[j];
      }
    }

    // Update weights
    for (let i = 0; i < n; i++) {
      weights[i] -= lr * grad[i];
    }

    // Project onto constraints
    for (let i = 0; i < n; i++) {
      weights[i] = Math.max(bounds[i][0], Math.min(bounds[i][1], weights[i]));
    }

    // Normalize to sum to 1
    const sum = weights.reduce((a, b) => a + b, 0);
    weights = weights.map((w) => w / sum);

    // Check return constraint
    const portReturn = weights.reduce(
      (sum, w, i) => sum + w * expectedReturns[i],
      0
    );
    if (portReturn < targetReturn) {
      // Shift weights toward higher-return directions
      const maxRetIdx = expectedReturns.indexOf(Math.max(...expectedReturns));
      weights[maxRetIdx] += 0.01;
      const newSum = weights.reduce((a, b) => a + b, 0);
      weights = weights.map((w) => w / newSum);
    }
  }

  return weights;
}

function computeEfficientFrontierTS(
  expectedReturns: number[],
  covMatrix: number[][],
  bounds: [number, number][],
  numPoints = 50
): Array<{
  risk: number;
  return: number;
  weights: number[];
  sharpe_ratio: number;
}> {
  const minReturn = Math.min(...expectedReturns) * 0.7;
  const maxReturn = Math.max(...expectedReturns) * 0.95;
  const frontier: Array<{
    risk: number;
    return: number;
    weights: number[];
    sharpe_ratio: number;
  }> = [];

  for (let i = 0; i < numPoints; i++) {
    const targetReturn =
      minReturn + (i / (numPoints - 1)) * (maxReturn - minReturn);

    const weights = optimizePortfolioTS(
      expectedReturns,
      covMatrix,
      targetReturn,
      bounds
    );

    const portReturn = weights.reduce(
      (sum, w, idx) => sum + w * expectedReturns[idx],
      0
    );

    let portVariance = 0;
    for (let a = 0; a < weights.length; a++) {
      for (let b = 0; b < weights.length; b++) {
        portVariance += weights[a] * weights[b] * covMatrix[a][b];
      }
    }
    const portRisk = Math.sqrt(Math.max(portVariance, 0));
    const sharpe = portRisk > 1e-8 ? portReturn / portRisk : 0;

    frontier.push({
      risk: Math.round(portRisk * 1e6) / 1e6,
      return: Math.round(portReturn * 1e6) / 1e6,
      weights: weights.map((w) => Math.round(w * 1e4) / 1e4),
      sharpe_ratio: Math.round(sharpe * 1e4) / 1e4,
    });
  }

  return frontier;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      topics,
      affinityMatrix,
      riskTolerance = 0.5,
    } = body as {
      topics: TopicInfo[];
      affinityMatrix: Record<number, number[]>;
      riskTolerance: number;
    };

    if (!topics || !affinityMatrix) {
      return NextResponse.json(
        { error: "Topics and affinity matrix are required" },
        { status: 400 }
      );
    }

    const expectedReturns = computeExpectedReturns(topics, affinityMatrix);
    const covMatrix = computeCovarianceMatrix(topics, affinityMatrix);

    // Build bounds using default constraints for all directions
    const bounds: [number, number][] = TRAINING_DIRECTIONS.map(() => [
      DEFAULT_CONSTRAINTS.min,
      DEFAULT_CONSTRAINTS.max,
    ]);

    // Compute efficient frontier
    const frontier = computeEfficientFrontierTS(
      expectedReturns,
      covMatrix,
      bounds,
      50
    );

    // Find optimal portfolio (best Sharpe ratio)
    const optimal = frontier.reduce((best, p) =>
      p.sharpe_ratio > best.sharpe_ratio ? p : best
    );

    // Select portfolio based on risk tolerance
    let selected = frontier[0];
    if (frontier.length > 1) {
      const minRisk = frontier[0].risk;
      const maxRisk = frontier[frontier.length - 1].risk;
      const targetRisk = minRisk + riskTolerance * (maxRisk - minRisk);
      selected = frontier.reduce((closest, p) =>
        Math.abs(p.risk - targetRisk) < Math.abs(closest.risk - targetRisk)
          ? p
          : closest
      );
    }

    // Map weights to direction keys
    const weightMap: Record<string, number> = {};
    TRAINING_DIRECTIONS.forEach((dir, i) => {
      weightMap[dir.key] = selected.weights[i];
    });

    return NextResponse.json({
      frontier,
      optimal_portfolio: optimal,
      selected_portfolio: {
        ...selected,
        weight_map: weightMap,
      },
      expected_returns: expectedReturns,
      risk_tolerance: riskTolerance,
      direction_names: TRAINING_DIRECTIONS.map((d) => d.name),
    });
  } catch (error) {
    console.error("Optimization error:", error);
    return NextResponse.json(
      { error: "Portfolio optimization failed" },
      { status: 500 }
    );
  }
}
