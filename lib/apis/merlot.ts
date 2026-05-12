/**
 * MERLOT Discovery Client
 *
 * Scrapes MERLOT (Multimedia Educational Resource for Learning and Online Teaching)
 * using Jina Reader to discover OER materials.
 */

import { AcademicPaper } from "../types/research";
import { scrapeWithJinaReader } from "./web-scraper";

const BASE_URL = "https://www.merlot.org/merlot/materials.htm";

export interface MerlotOptions {
    query: string;
}

export async function searchMerlot(options: MerlotOptions): Promise<AcademicPaper[]> {
    const { query } = options;

    try {
        const url = `${BASE_URL}?keywords=${encodeURIComponent(query)}&sort.property=relevance`;

        console.log(`[MERLOT] Scraping search: ${url}`);

        const scrapeResult = await scrapeWithJinaReader({ url });

        if (!scrapeResult.success || !scrapeResult.markdown) {
            throw new Error(`MERLOT scrape failed: ${scrapeResult.error}`);
        }

        const items: AcademicPaper[] = [];
        const lines = scrapeResult.markdown.split("\n");
        let currentTitle = "";

        // Naive markdown parser for MERLOT search results
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Look for material links: [Title](https://www.merlot.org/merlot/viewMaterial.htm?id=...)
            const match = line.match(/\[(.*?)\]\((.*?viewMaterial\.htm\?id=.*?)\)/);

            if (match && match[1] && match[2]) {
                const title = match[1].trim();
                const link = match[2].trim();

                if (title === currentTitle || title.length < 5) continue;
                currentTitle = title;

                // Try to grab the description from the next few lines
                let abstract = "Open Educational Resource (OER) discovered on MERLOT.";
                for (let j = 1; j < 5; j++) {
                    if (lines[i + j] && !lines[i + j].startsWith("[") && lines[i + j].length > 20) {
                        abstract = lines[i + j].trim();
                        break;
                    }
                }

                items.push({
                    id: `merlot-${Math.random().toString(36).substring(7)}`,
                    title: title,
                    abstract: abstract,
                    authors: ["MERLOT Contributor"],
                    year: new Date().getFullYear(),
                    doi: "",
                    url: link.startsWith("http") ? link : `https://www.merlot.org${link}`,
                    citationCount: 0,
                    source: "merlot",
                });
            }
        }

        console.log(`[MERLOT] Discovered ${items.length} OER materials`);
        return items.slice(0, 10);

    } catch (error) {
        console.error("[MERLOT] Discovery failed:", error);
        return [];
    }
}
