import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

interface ValidateRequest {
  service: "onet" | "semantic_scholar" | "tavily" | "firecrawl" | "bertopic" | "bls" | "fred" | "exa" | "core" | "google_books";
  apiKey?: string;
  serviceUrl?: string; // For BERTopic
}

/**
 * Validate API keys for various research services
 * Returns { valid: boolean, message: string, details?: any }
 */
export async function POST(request: NextRequest) {
  try {
    const body: ValidateRequest = await request.json();
    const { service, apiKey, serviceUrl } = body;

    switch (service) {
      // ============================================================
      // O*NET Validation (v2.0)
      // ============================================================
      case "onet": {
        if (!apiKey) {
          return NextResponse.json({
            valid: false,
            message: "API key is required",
          });
        }

        try {
          // Test with a simple occupation search (v2.0 API)
          const response = await fetch(
            `https://api-v2.onetcenter.org/online/search?keyword=software&start=1&end=1`,
            {
              headers: {
                "X-API-Key": apiKey,
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            return NextResponse.json({
              valid: true,
              message: "O*NET API key is valid (v2.0)",
              details: {
                resultsFound: data.occupation?.length || 0,
              },
            });
          } else if (response.status === 401 || response.status === 403) {
            return NextResponse.json({
              valid: false,
              message: "Invalid O*NET API key (authentication failed)",
            });
          } else {
            return NextResponse.json({
              valid: false,
              message: `O*NET API error: ${response.statusText}`,
            });
          }
        } catch (error) {
          return NextResponse.json({
            valid: false,
            message: `O*NET connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }

      // ============================================================
      // Semantic Scholar Validation (no auth required, just test connection)
      // ============================================================
      case "semantic_scholar": {
        try {
          const headers: Record<string, string> = {};
          if (apiKey) {
            headers["x-api-key"] = apiKey;
          }

          const response = await fetch(
            `https://api.semanticscholar.org/graph/v1/paper/search?query=machine+learning&limit=1`,
            { headers }
          );

          if (response.ok) {
            const data = await response.json();
            return NextResponse.json({
              valid: true,
              message: apiKey
                ? "Semantic Scholar API key is valid (authenticated)"
                : "Semantic Scholar API is accessible (no key required, but key can increase rate limits)",
              details: {
                resultsFound: data.data?.length || 0,
              },
            });
          } else if (response.status === 429) {
            return NextResponse.json({
              valid: false,
              message: "Semantic Scholar rate limit exceeded. API key recommended.",
            });
          } else {
            return NextResponse.json({
              valid: false,
              message: `Semantic Scholar API error: ${response.statusText}`,
            });
          }
        } catch (error) {
          return NextResponse.json({
            valid: false,
            message: `Semantic Scholar connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }

      // ============================================================
      // Tavily Validation
      // ============================================================
      case "tavily": {
        if (!apiKey) {
          return NextResponse.json({
            valid: false,
            message: "API key is required",
          });
        }

        try {
          const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: apiKey,
              query: "test",
              max_results: 1,
            }),
          });

          if (response.ok) {
            return NextResponse.json({
              valid: true,
              message: "Tavily API key is valid",
            });
          } else if (response.status === 401 || response.status === 403) {
            return NextResponse.json({
              valid: false,
              message: "Invalid Tavily API key (authentication failed)",
            });
          } else {
            const errorData = await response.json().catch(() => ({}));
            return NextResponse.json({
              valid: false,
              message: `Tavily API error: ${errorData.error || response.statusText}`,
            });
          }
        } catch (error) {
          return NextResponse.json({
            valid: false,
            message: `Tavily connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }

      // ============================================================
      // Firecrawl Validation
      // ============================================================
      case "firecrawl": {
        if (!apiKey) {
          return NextResponse.json({
            valid: false,
            message: "API key is required",
          });
        }

        try {
          // Test with credit-usage endpoint (doesn't consume scrape credits)
          const response = await fetch("https://api.firecrawl.dev/v1/team/credit-usage", {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            return NextResponse.json({
              valid: true,
              message: "Firecrawl API key is valid",
              details: {
                remainingCredits: data.data?.remaining_credits,
              }
            });
          } else if (response.status === 401 || response.status === 403) {
            return NextResponse.json({
              valid: false,
              message: "Invalid Firecrawl API key (authentication failed)",
            });
          } else {
            return NextResponse.json({
              valid: false,
              message: `Firecrawl API error: ${response.statusText}`,
            });
          }
        } catch (error) {
          return NextResponse.json({
            valid: false,
            message: `Firecrawl connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }

      // ============================================================
      // BERTopic Service Validation
      // ============================================================
      case "bertopic": {
        if (!serviceUrl) {
          return NextResponse.json({
            valid: false,
            message: "Service URL is required",
          });
        }

        try {
          const response = await fetch(`${serviceUrl}/health`, {
            method: "GET",
          });

          if (response.ok) {
            const data = await response.json();
            return NextResponse.json({
              valid: true,
              message: "BERTopic service is running",
              details: data,
            });
          } else {
            return NextResponse.json({
              valid: false,
              message: `BERTopic service unreachable: ${response.statusText}`,
            });
          }
        } catch (error) {
          return NextResponse.json({
            valid: false,
            message: `BERTopic connection failed: ${error instanceof Error ? error.message : "Unknown error"}. Make sure the service is running.`,
          });
        }
      }

      // ============================================================
      // BLS (Bureau of Labor Statistics) Validation
      // ============================================================
      case "bls": {
        if (!apiKey) {
          return NextResponse.json({
            valid: false,
            message: "API key is required",
          });
        }

        try {
          // Test with a simple series request
          const response = await fetch(
            `https://api.bls.gov/publicAPI/v2/timeseries/data/LAUCN040010000000005?registrationkey=${apiKey}&startyear=2023&endyear=2023`,
            {
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.status === "REQUEST_SUCCEEDED") {
              return NextResponse.json({
                valid: true,
                message: "BLS API key is valid",
              });
            } else {
              return NextResponse.json({
                valid: false,
                message: `BLS API error: ${data.message || "Invalid response"}`,
              });
            }
          } else {
            return NextResponse.json({
              valid: false,
              message: `BLS API error: ${response.statusText}`,
            });
          }
        } catch (error) {
          return NextResponse.json({
            valid: false,
            message: `BLS connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }

      // ============================================================
      // FRED (Federal Reserve Economic Data) Validation
      // ============================================================
      case "fred": {
        if (!apiKey) {
          return NextResponse.json({
            valid: false,
            message: "API key is required",
          });
        }

        try {
          // Simple test request to the a fast endpoint (categories)
          const response = await fetch(
            `https://api.stlouisfed.org/fred/category?category_id=125&api_key=${apiKey}&file_type=json`,
            {
              method: "GET",
            }
          );

          if (response.ok) {
            return NextResponse.json({
              valid: true,
              message: "FRED API key is valid",
            });
          } else if (response.status === 400 && (await response.clone().text()).includes("api_key")) {
            return NextResponse.json({
              valid: false,
              message: "Invalid FRED API key",
            });
          } else {
            return NextResponse.json({
              valid: false,
              message: `FRED API error: ${response.statusText}`,
            });
          }
        } catch (error) {
          return NextResponse.json({
            valid: false,
            message: `FRED connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }

      // ============================================================
      // CORE API Validation
      // ============================================================
      case "core": {
        if (!apiKey) {
          return NextResponse.json({
            valid: false,
            message: "API key is required",
          });
        }

        try {
          const response = await fetch(
            `https://api.core.ac.uk/v3/search/works?q=test&limit=1`,
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            return NextResponse.json({
              valid: true,
              message: "CORE API key is valid",
              details: {
                resultsFound: data.totalHits || 0,
              },
            });
          } else if (response.status === 401 || response.status === 403) {
            return NextResponse.json({
              valid: false,
              message: "Invalid CORE API key (authentication failed)",
            });
          } else {
            return NextResponse.json({
              valid: false,
              message: `CORE API error: ${response.statusText}`,
            });
          }
        } catch (error) {
          return NextResponse.json({
            valid: false,
            message: `CORE connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }

      // ============================================================
      // Google Books Validation
      // ============================================================
      case "google_books": {
        if (!apiKey) {
          return NextResponse.json({
            valid: false,
            message: "API key is required",
          });
        }

        try {
          // Perform a fast test request using maxResults=1
          const response = await fetch(
            `https://www.googleapis.com/books/v1/volumes?q=science&maxResults=1&key=${apiKey}`
          );

          if (response.ok) {
            return NextResponse.json({
              valid: true,
              message: "Google Books API key is valid",
            });
          } else if (response.status === 400 || response.status === 403) {
            const data = await response.json().catch(() => ({}));
            return NextResponse.json({
              valid: false,
              message: `Invalid Google Books API key: ${data?.error?.message || "authentication failed"}`,
            });
          } else {
            return NextResponse.json({
              valid: false,
              message: `Google Books API error: ${response.statusText}`,
            });
          }
        } catch (error) {
          return NextResponse.json({
            valid: false,
            message: `Google Books connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }

      // ============================================================
      // EXA API Validation
      // ============================================================
      case "exa": {
        if (!apiKey) {
          return NextResponse.json({
            valid: false,
            message: "API key is required",
          });
        }

        try {
          // Make a minimal search request to validate Auth
          const response = await fetch("https://api.exa.ai/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
            },
            body: JSON.stringify({
              query: "test",
              numResults: 1,
            }),
          });

          if (response.ok) {
            return NextResponse.json({
              valid: true,
              message: "Exa API key is valid",
            });
          } else if (response.status === 401 || response.status === 403) {
            return NextResponse.json({
              valid: false,
              message: "Invalid Exa API key (authentication failed)",
            });
          } else {
            return NextResponse.json({
              valid: false,
              message: `Exa API error: ${response.statusText}`,
            });
          }
        } catch (error) {
          return NextResponse.json({
            valid: false,
            message: `Exa connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }

      default:
        return NextResponse.json(
          { valid: false, message: `Unknown service: ${service}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[validate-api-key] Error:", error);
    return NextResponse.json(
      {
        valid: false,
        message: "Validation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
