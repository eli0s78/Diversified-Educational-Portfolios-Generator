/**
 * OpenStax Discovery Client
 *
 * Scrapes OpenStax subjects using Jina Reader to discover high-quality open textbooks.
 */

import { AcademicPaper } from "../types/research";
import { scrapeWithJinaReader } from "./web-scraper";

const BASE_URL = "https://openstax.org/subjects";

export interface OpenStaxOptions {
    subject?: string; // e.g., "math", "science", "business"
}

export async function searchOpenStax(options: OpenStaxOptions = {}): Promise<AcademicPaper[]> {
    const { subject = "" } = options;

    try {
        const url = subject ? `${BASE_URL}/${encodeURIComponent(subject.toLowerCase())}` : BASE_URL;

        console.log(`[OpenStax] Scraping catalog: ${url}`);

        const scrapeResult = await scrapeWithJinaReader({ url });

        if (!scrapeResult.success || !scrapeResult.markdown) {
            throw new Error(`OpenStax scrape failed: ${scrapeResult.error}`);
        }

        // We use a cheap, fast Gemini call or just regex to parse out the books from the markdown
        // For now, we perform a basic keyword heuristic if we don't use an LLM
        // A robust solution passes this markdown to Gemini, but here's a lightweight regex extraction

        const books: AcademicPaper[] = [];
        const lines = scrapeResult.markdown.split("\n");
        let currentTitle = "";

        // This is a naive parser for the markdown returned by Jina for OpenStax.
        // It looks for links that look like textbook detail pages.
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(/\[(.*?)\]\(\/details\/books\/(.*?)\)/);

            if (match && match[1] && match[2]) {
                const title = match[1].trim();
                const slug = match[2].trim();

                // Avoid redundant parsing
                if (title === currentTitle || title.includes("Details") || title === "") continue;
                currentTitle = title;

                books.push({
                    id: `openstax-${slug}`,
                    title: title,
                    abstract: "Free, peer-reviewed, openly licensed textbook from OpenStax.",
                    authors: ["OpenStax"],
                    year: new Date().getFullYear(),
                    doi: "",
                    url: `https://openstax.org/details/books/${slug}`,
                    citationCount: 0,
                    source: "openstax",
                });
            }
        }

        console.log(`[OpenStax] Discovered ${books.length} textbooks`);
        return books.slice(0, 10); // Return top 10 relevant books to keep payload sane

    } catch (error) {
        console.error("[OpenStax] Discovery failed:", error);
        return [];
    }
}
