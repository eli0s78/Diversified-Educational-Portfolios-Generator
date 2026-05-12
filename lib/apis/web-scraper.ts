/**
 * Jina Reader API Client
 *
 * Free unlimited web-to-markdown scraper using Jina Reader.
 * Docs: https://jina.ai/reader
 */

export interface JinaReaderParams {
    url: string;
    timeoutMs?: number;
}

export interface JinaReaderResponse {
    success: boolean;
    markdown?: string;
    error?: string;
}

/**
 * Scrapes a web page to markdown using the free Jina Reader API.
 */
export async function scrapeWithJinaReader(
    params: JinaReaderParams
): Promise<JinaReaderResponse> {
    const { url, timeoutMs = 20000 } = params;

    try {
        const requestUrl = `https://r.jina.ai/${url}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, timeoutMs);

        const response = await fetch(requestUrl, {
            method: "GET",
            // Important to return as raw string (markdown)
            headers: {
                Accept: "text/plain",
            },
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const err = await response.text();
            return {
                success: false,
                error: `Jina Reader error (${response.status}): ${err.substring(0, 100)}`,
            };
        }

        const markdown = await response.text();
        return {
            success: true,
            markdown,
        };
    } catch (error: any) {
        if (error.name === "AbortError") {
            return { success: false, error: "Jina Reader request timed out." };
        }
        return {
            success: false,
            error: `Jina Reader connection failed: ${error.message}`,
        };
    }
}
