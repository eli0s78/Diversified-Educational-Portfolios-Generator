import { NextRequest, NextResponse } from "next/server";
import { searchSemanticScholar, delay } from "@/lib/apis/semantic-scholar";
import { searchOpenAlex } from "@/lib/apis/openalex";
import { searchArxiv } from "@/lib/apis/arxiv";
import { searchPubMed } from "@/lib/apis/pubmed";
import { searchCrossref } from "@/lib/apis/crossref";
import { searchEuropePMC } from "@/lib/apis/europe-pmc";
import { fetchBiorxivDates } from "@/lib/apis/biorxiv";
import { searchCoreWithFallback } from "@/lib/apis/core";
import { searchGoogleBooks } from "@/lib/apis/google-books";
import { searchOpenLibrary } from "@/lib/apis/open-library";
import { searchDOAB } from "@/lib/apis/doab";
import { getPMCFullText } from "@/lib/apis/pmc-fulltext";
import { getOpenAccessInfo } from "@/lib/apis/open-access";
import { scrapeWithJinaReader } from "@/lib/apis/web-scraper";
import type {
  LiteratureCollectionRequest,
  LiteratureCollectionResponse,
  AcademicPaper,
} from "@/lib/types/research";

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
      fetch_full_text = false,
      full_text_limit = 10,
      semantic_scholar_api_key,
      google_books_api_key,
      exa_api_key,
      filters = {},
      core_api_key,
    } = body as LiteratureCollectionRequest & { core_api_key?: string, exa_api_key?: string };

    if (!occupation) {
      return NextResponse.json(
        { error: "Missing required field: occupation" },
        { status: 400 }
      );
    }

    // Use API key from request body (passed from client-side localStorage)
    const semanticScholarKey = semantic_scholar_api_key;

    // Construct search query with deduplication
    const queryTerms = new Set([occupation, ...keywords]);
    const query = Array.from(queryTerms).filter(Boolean).join(" ");

    console.log(`[Literature Collection] Query: "${query}", Sources: ${sources.join(", ")}, Years: ${year_from}-${year_to}`);

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

              console.log(`OpenAlex batch ${i} returned ${batch.length} papers`);
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

    // arXiv
    if (sources.includes("arxiv")) {
      sourcesUsed.push("arXiv");
      const perSource = Math.ceil(max_papers / sources.length);

      searchPromises.push(
        (async () => {
          try {
            const batch = await searchArxiv({
              query,
              limit: perSource,
              start: 0,
            });
            console.log(`arXiv returned ${batch.length} papers`);
            return batch;
          } catch (error) {
            console.error(`arXiv error:`, error);
            return [];
          }
        })()
      );
    }

    // PubMed
    if (sources.includes("pubmed")) {
      sourcesUsed.push("PubMed");
      const perSource = Math.ceil(max_papers / sources.length);

      searchPromises.push(
        (async () => {
          try {
            const batch = await searchPubMed({
              query,
              limit: perSource,
              retstart: 0,
            });
            console.log(`PubMed returned ${batch.length} papers`);
            return batch;
          } catch (error) {
            console.error(`PubMed error:`, error);
            return [];
          }
        })()
      );
    }

    // Crossref
    if (sources.includes("crossref")) {
      sourcesUsed.push("Crossref");
      const perSource = Math.ceil(max_papers / sources.length);
      searchPromises.push(
        (async () => {
          try {
            const batch = await searchCrossref({ query, limit: perSource });
            console.log(`Crossref returned ${batch.length} works`);
            return batch;
          } catch (error) {
            console.error(`Crossref error:`, error);
            return [];
          }
        })()
      );
    }

    // Europe PMC
    if (sources.includes("europe-pmc")) {
      sourcesUsed.push("Europe PMC");
      const perSource = Math.ceil(max_papers / sources.length);
      searchPromises.push(
        (async () => {
          try {
            const batch = await searchEuropePMC({ query, limit: perSource });
            console.log(`Europe PMC returned ${batch.length} papers`);
            return batch;
          } catch (error) {
            console.error(`Europe PMC error:`, error);
            return [];
          }
        })()
      );
    }

    // bioRxiv / medRxiv
    if (sources.includes("biorxiv") || sources.includes("medrxiv")) {
      const server = sources.includes("medrxiv") ? "medrxiv" : "biorxiv";
      sourcesUsed.push(server === "medrxiv" ? "medRxiv" : "bioRxiv");

      const perSource = Math.ceil(max_papers / sources.length);
      // Construct date string (rough estimation for past N years)
      const startDate = `${year_from}-01-01`;
      const endDate = `${year_to}-12-31`;

      searchPromises.push(
        (async () => {
          try {
            const batch = await fetchBiorxivDates({
              server,
              fromYear: year_from,
              toYear: year_to,
            });
            // Manual filtering by query and limiting
            const filtered = batch.filter(p =>
              p.title.toLowerCase().includes(query.toLowerCase()) ||
              (p.abstract && p.abstract.toLowerCase().includes(query.toLowerCase()))
            ).slice(0, perSource);

            console.log(`${server} returned ${filtered.length} papers out of batch of ${batch.length}`);
            return filtered;
          } catch (error) {
            console.error(`${server} error:`, error);
            return [];
          }
        })()
      );
    }

    // CORE
    const coreWarnings: string[] = [];
    if (sources.includes("core")) {
      sourcesUsed.push("CORE");
      const perSource = Math.ceil(max_papers / sources.length);
      searchPromises.push(
        (async () => {
          try {
            const result = await searchCoreWithFallback({
              query: query,
              limit: perSource
            }, core_api_key);
            if (result.warning) {
              coreWarnings.push(result.warning);
            }
            console.log(`CORE returned ${result.papers.length} papers${result.warning ? ' (free-tier fallback)' : ''}`);
            return result.papers;
          } catch (error) {
            console.error(`CORE error:`, error);
            return [];
          }
        })()
      );
    }

    // Google Books
    if (sources.includes("google-books")) {
      sourcesUsed.push("Google Books");
      const perSource = Math.ceil(max_papers / sources.length);
      searchPromises.push(
        (async () => {
          try {
            const batch = await searchGoogleBooks({
              query: query,
              limit: Math.min(perSource, 40) // Hard limit to 40 per Google specifications
            }, google_books_api_key);
            console.log(`Google Books returned ${batch.length} books`);
            return batch;
          } catch (error) {
            console.error(`Google Books error:`, error);
            return [];
          }
        })()
      );
    }

    // Open Library
    if (sources.includes("open-library")) {
      sourcesUsed.push("Open Library");
      const perSource = Math.ceil(max_papers / sources.length);
      searchPromises.push(
        (async () => {
          try {
            const batch = await searchOpenLibrary({
              query: query,
              limit: perSource
            });
            console.log(`Open Library returned ${batch.length} books`);
            return batch;
          } catch (error) {
            console.error(`Open Library error:`, error);
            return [];
          }
        })()
      );
    }

    // DOAB
    if (sources.includes("doab")) {
      sourcesUsed.push("DOAB");
      const perSource = Math.ceil(max_papers / sources.length);
      searchPromises.push(
        (async () => {
          try {
            const batch = await searchDOAB({
              query,
              limit: perSource
            });
            console.log(`DOAB returned ${batch.length} books`);
            return batch;
          } catch (error) {
            console.error(`DOAB error:`, error);
            return [];
          }
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

    // Full text retrieval
    if (fetch_full_text && full_text_limit > 0) {
      const topPapers = papers.slice(0, full_text_limit);
      console.log(`[Literature Collection] Fetching full text for top ${topPapers.length} papers`);

      // Process sequentially to be gentle on external APIs
      for (const paper of topPapers) {
        try {
          let targetUrl = "";

          // 1. If CORE already gave us the full text, use it!
          if (paper.fullText) {
            console.log(`[Literature Collection] Using hosted full text from CORE for ${paper.id}`);
            // Let the text pass through (it's already on paper.fullText)
            targetUrl = "core-hosted";
          }

          // 2. If it has a PMCID, try PMC BioC structured full text
          if (!targetUrl && paper.pmcid) {
            try {
              const pmcText = await getPMCFullText(paper.pmcid);
              if (pmcText) {
                console.log(`[Literature Collection] Succeeded fetching structured PMC full text for ${paper.id}`);
                paper.fullText = pmcText;
                targetUrl = "pmc-hosted";
              }
            } catch (err) {
              console.log(`[Literature Collection] Failed PMC fetch for ${paper.id}`);
            }
          }

          // 3. Check Unpaywall if DOI is available
          if (!targetUrl && paper.doi) {
            const oaInfo = await getOpenAccessInfo({ doi: paper.doi });
            if (oaInfo?.best_oa_location) {
              targetUrl = oaInfo.best_oa_location.url_for_pdf ||
                oaInfo.best_oa_location.url_for_landing_page || "";
            }
          }

          // 4. Fallback to arXiv/PubMed/SemanticScholar landing page URLs
          if (!targetUrl && paper.url) {
            // Jina Reader is very good at extracting text from arXiv landing pages and arXiv pdfs
            targetUrl = paper.url;
          }

          // 5. Scrape with Jina Reader
          if (targetUrl && targetUrl !== "core-hosted" && targetUrl !== "pmc-hosted") {
            console.log(`[Literature Collection] Scraping full text for ${paper.id} from ${targetUrl}`);
            const scrapeResult = await scrapeWithJinaReader({ url: targetUrl });
            if (scrapeResult.success && scrapeResult.markdown) {
              paper.fullText = scrapeResult.markdown;
              console.log(`[Literature Collection] Successfully retrieved full text for ${paper.id} (${scrapeResult.markdown.length} chars)`);
            } else {
              console.log(`[Literature Collection] Failed to retrieve full text for ${paper.id}: ${scrapeResult.error}`);
            }
          }
        } catch (err) {
          console.error(`[Literature Collection] Error fetching full text for ${paper.id}:`, err);
        }
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
        warnings: coreWarnings.length > 0 ? coreWarnings : undefined,
      },
    };

    console.log(`[Literature Collection] Total found: ${combinedPapers.length}, After deduplication: ${papers.length}, Duplicates removed: ${duplicatesRemoved}`);

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
