"""
Portfolio Optimization Engine - Vercel Python Serverless Function

Implements Modern Portfolio Theory (MPT) adapted for educational skill portfolios.
Uses scipy's SLSQP optimizer for mean-variance optimization.
"""

from http.server import BaseHTTPRequestHandler
import json
import numpy as np
from scipy.optimize import minimize


def portfolio_variance(weights, cov_matrix):
    """Compute portfolio variance: w^T * Sigma * w"""
    w = np.array(weights)
    return float(w @ np.array(cov_matrix) @ w)


def portfolio_return(weights, expected_returns):
    """Compute portfolio expected return: w^T * mu"""
    return float(np.array(weights) @ np.array(expected_returns))


def optimize_portfolio(expected_returns, cov_matrix, target_return, bounds):
    """
    Mean-variance optimization: minimize risk for a given target return.

    Args:
        expected_returns: array of expected returns per direction (length 6)
        cov_matrix: 6x6 covariance matrix
        target_return: minimum acceptable return
        bounds: list of (min, max) tuples per direction

    Returns:
        Optimized weights array (length 6)
    """
    n = len(expected_returns)
    mu = np.array(expected_returns)
    sigma = np.array(cov_matrix)

    def objective(w):
        return w @ sigma @ w

    constraints = [
        {"type": "eq", "fun": lambda w: np.sum(w) - 1.0},
        {"type": "ineq", "fun": lambda w: w @ mu - target_return},
    ]

    result = minimize(
        objective,
        x0=np.ones(n) / n,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"maxiter": 1000, "ftol": 1e-10},
    )

    if result.success:
        # Normalize to ensure sum = 1.0 exactly
        weights = result.x / result.x.sum()
        return weights.tolist()
    else:
        # Fallback to equal weights
        return [1.0 / n] * n


def compute_efficient_frontier(expected_returns, cov_matrix, bounds, num_points=50):
    """
    Generate the efficient frontier by sweeping target returns.

    Returns a list of dicts: {risk, return, weights, sharpe_ratio}
    """
    mu = np.array(expected_returns)
    sigma = np.array(cov_matrix)

    min_ret = float(mu.min()) * 0.7
    max_ret = float(mu.max()) * 0.95
    targets = np.linspace(min_ret, max_ret, num_points)

    frontier = []
    for target in targets:
        try:
            weights = optimize_portfolio(expected_returns, cov_matrix, target, bounds)
            w = np.array(weights)
            port_return = float(w @ mu)
            port_risk = float(np.sqrt(w @ sigma @ w))
            sharpe = port_return / port_risk if port_risk > 1e-8 else 0.0

            frontier.append({
                "risk": round(port_risk, 6),
                "return": round(port_return, 6),
                "weights": [round(x, 4) for x in weights],
                "sharpe_ratio": round(sharpe, 4),
            })
        except Exception:
            continue

    # Remove duplicates and sort by risk
    seen = set()
    unique_frontier = []
    for point in frontier:
        key = (round(point["risk"], 4), round(point["return"], 4))
        if key not in seen:
            seen.add(key)
            unique_frontier.append(point)

    unique_frontier.sort(key=lambda p: p["risk"])
    return unique_frontier


def find_optimal_portfolio(frontier):
    """Find the tangent portfolio (best Sharpe ratio) on the frontier."""
    if not frontier:
        return None
    return max(frontier, key=lambda p: p["sharpe_ratio"])


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        data = json.loads(body)

        expected_returns = data["expected_returns"]
        cov_matrix = data["cov_matrix"]
        bounds = [tuple(b) for b in data.get("bounds", [(0.05, 0.50)] * 6)]
        risk_tolerance = data.get("risk_tolerance", 0.5)
        num_points = data.get("num_points", 50)

        # Compute efficient frontier
        frontier = compute_efficient_frontier(
            expected_returns, cov_matrix, bounds, num_points
        )

        # Find optimal (tangent) portfolio
        optimal = find_optimal_portfolio(frontier)

        # Find portfolio matching user's risk tolerance
        if frontier:
            min_risk = frontier[0]["risk"]
            max_risk = frontier[-1]["risk"]
            target_risk = min_risk + risk_tolerance * (max_risk - min_risk)

            # Find closest point on frontier to target risk
            selected = min(frontier, key=lambda p: abs(p["risk"] - target_risk))
        else:
            selected = {
                "risk": 0,
                "return": 0,
                "weights": [1.0 / 6] * 6,
                "sharpe_ratio": 0,
            }

        response = {
            "frontier": frontier,
            "optimal_portfolio": optimal,
            "selected_portfolio": selected,
            "risk_tolerance": risk_tolerance,
        }

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok", "engine": "portfolio-optimizer"}).encode())
