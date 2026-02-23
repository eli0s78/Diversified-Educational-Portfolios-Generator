import { NextRequest, NextResponse } from "next/server";
import { searchSemanticScholar, delay } from "@/lib/apis/semantic-scholar";
import { searchOpenAlex } from "@/lib/apis/openalex";
import type {
  LiteratureCollectionRequest,
  LiteratureCollectionResponse,
  AcademicPaper,
} from "@/lib/types/research";
import { getSettings } from "@/lib/project-manager";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: LiteratureCollectionRequest = await request.json();

    const {
      occupation,
      keywords = [],
      year_from = 2020,
      year_to = new Date().getFullYear(),
      max_papers = 200,
      sources = ["semantic-scholar", "openalex"],
      filters = {},
    } = body;

    if (!occupation || !keywords.length) {
      return NextResponse.json(
        { error: "Missing required fields: occupation, keywords" },
        { status: 400 }
      );
    }

    // Get API keys from settings
    const settings = getSettings();
    const semanticScholarKey = settings.semantic_scholar_api_key;

    // Construct search query
    const query = [occupation, ...keywords].join(" ");

    const papers: AcademicPaper[] = [];
    const sourcesUsed: string[] = [];
    let duplicatesRemoved = 0;

    // Parallel search across enabled sources
    const searchPromises: Promise<AcademicPaper[]>[] = [];

    // Semantic Scholar
    if (sources.includes("semantic-scholar")) {
      sourcesUsed.push("Semantic Scholar");
      const perSource = Math.ceil(max_papers / sources.length);

      searchPromises.push(
        (async () => {
          const results: AcademicPaper[] = [];
          const batchSize = 100; // Semantic Scholar max per request
          const batches = Math.ceil(perSource / batchSize);

          for (let i = 0; i < batches; i++) {
            const offset = i * batchSize;
            const limit = Math.min(batchSize, perSource - offset);

            if (limit <= 0) break;

            try {
              const batch = await searchSemanticScholar(
                {
                  query,
                  limit,
                  offset,
                  year: `${year_from}-${year_to}`,
                  minCitationCount: filters.min_citations,
                  publicationTypes: filters.peer_reviewed
                    ? ["JournalArticle", "Conference"]
                    : undefined,
                },
                semanticScholarKey
              );

              results.push(...batch);

              // Rate limiting: 1 req/sec
              if (i < batches - 1) {
                await delay(1000);
              }
            } catch (error) {
              console.error(`Semantic Scholar batch ${i} error:`, error);
              // Continue with next batch
            }
          }

          return results;
        })()
      );
    }

    // OpenAlex
    if (sources.includes("openalex")) {
      sourcesUsed.push("OpenAlex");
      const perSource = Math.ceil(max_papers / sources.length);

      searchPromises.push(
        (async () => {
          const results: AcademicPaper[] = [];
          const batchSize = 200; // OpenAlex max per page
          const batches = Math.ceil(perSource / batchSize);

          for (let i = 0; i < batches; i++) {
            const page = i + 1;
            const limit = Math.min(batchSize, perSource - i * batchSize);

            if (limit <= 0) break;

            try {
              const batch = await searchOpenAlex({
                query,
                limit,
                page,
                fromYear: year_from,
                toYear: year_to,
                minCitationCount: filters.min_citations,
                openAccessOnly: false,
              });

              results.push(...batch);
            } catch (error) {
              console.error(`OpenAlex batch ${i} error:`, error);
              // Continue with next batch
            }
          }

          return results;
        })()
      );
    }

    // Wait for all searches to complete
    const allResults = await Promise.all(searchPromises);
    const combinedPapers = allResults.flat();

    // Deduplication by DOI
    const seenDOIs = new Set<string>();
    const seenTitles = new Set<string>();

    for (const paper of combinedPapers) {
      // Deduplicate by DOI (if available)
      if (paper.doi) {
        const normalizedDOI = paper.doi.toLowerCase().trim();
        if (seenDOIs.has(normalizedDOI)) {
          duplicatesRemoved++;
          continue;
        }
        seenDOIs.add(normalizedDOI);
      } else {
        // Fallback: deduplicate by title (fuzzy)
        const normalizedTitle = paper.title.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (seenTitles.has(normalizedTitle)) {
          duplicatesRemoved++;
          continue;
        }
        seenTitles.add(normalizedTitle);
      }

      // Apply language filter
      if (filters.language && filters.language.length > 0) {
        // Heuristic: check if abstract/title is in English
        // (More sophisticated language detection could be added)
        if (!filters.language.includes("en")) {
          continue;
        }
      }

      papers.push(paper);

      // Stop if we've reached the limit
      if (papers.length >= max_papers) {
        break;
      }
    }

    const response: LiteratureCollectionResponse = {
      papers,
      metadata: {
        total_found: combinedPapers.length,
        total_returned: papers.length,
        sources_used: sourcesUsed,
        duplicates_removed: duplicatesRemoved,
        query_time_ms: Date.now() - startTime,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Literature collection error:", error);
    return NextResponse.json(
      {
        error: "Failed to collect literature",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
