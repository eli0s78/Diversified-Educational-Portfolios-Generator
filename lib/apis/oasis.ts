/**
 * OASIS Discovery Client
 *
 * Scrapes OASIS (Openly Available Sources Integrated Search) 
 * using Jina Reader to federated-search across 100+ OER sources simultaneously.
 */

import { AcademicPaper } from "../types/research";
import { scrapeWithJinaReader } from "./web-scraper";

const BASE_URL = "https://oasis.geneseo.edu/basic_search.php";

export interface OasisOptions {
    query: string;
}

export async function searchOasis(options: OasisOptions): Promise<AcademicPaper[]> {
    const { query } = options;

    try {
        const url = `${BASE_URL}?search=${encodeURIComponent(query)}`;

        console.log(`[OASIS] Scraping search: ${url}`);

        const scrapeResult = await scrapeWithJinaReader({ url });

        if (!scrapeResult.success || !scrapeResult.markdown) {
            throw new Error(`OASIS scrape failed: ${scrapeResult.error}`);
        }

        const items: AcademicPaper[] = [];
        const lines = scrapeResult.markdown.split("\n");
        let currentTitle = "";

        // Naive markdown parser for OASIS search results
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Look for OER item links
            const match = line.match(/\[(.*?)\]\((.*?item\.php\?id=.*?)\)/);

            if (match && match[1] && match[2]) {
                const title = match[1].trim();
                let link = match[2].trim();

                if (!link.startsWith("http")) {
                    link = `https://oasis.geneseo.edu/${link}`;
                }

                if (title === currentTitle || title.length < 5 || title.includes("Item Details")) continue;
                currentTitle = title;

                items.push({
                    id: `oasis-${Math.random().toString(36).substring(7)}`,
                    title: title,
                    abstract: "Federated Open Educational Resource discovered via OASIS.",
                    authors: ["OASIS Federator"],
                    year: new Date().getFullYear(),
                    doi: "",
                    url: link,
                    citationCount: 0,
                    source: "oasis",
                });
            }
        }

        console.log(`[OASIS] Discovered ${items.length} federated OER materials`);
        return items.slice(0, 10);

    } catch (error) {
        console.error("[OASIS] Discovery failed:", error);
        return [];
    }
}
