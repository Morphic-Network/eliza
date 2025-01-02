import type { IAgentRuntime, Provider, Memory, State } from "@ai16z/eliza";
import axios from "axios";
import { parseStringPromise } from "xml2js";

export interface ArxivSearchResult {
    id: string;
    title: string;
    authors: string[];
    summary: string;
    published: string;
    updated: string;
    link: string;
}

// ArxivAPI class for handling arXiv API requests
export class ArxivAPI {
    private static readonly BASE_URL = "http://export.arxiv.org/api/query";
    private static readonly RATE_LIMIT_DELAY = 3000; // 3 seconds between requests

    private lastRequestTime: number = 0;

    private async waitForRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < ArxivAPI.RATE_LIMIT_DELAY) {
            await new Promise((resolve) =>
                setTimeout(
                    resolve,
                    ArxivAPI.RATE_LIMIT_DELAY - timeSinceLastRequest
                )
            );
        }
        this.lastRequestTime = Date.now();
    }

    async search(
        query: string,
        maxResults: number = 10
    ): Promise<ArxivSearchResult[]> {
        await this.waitForRateLimit();

        const response = await axios.get(ArxivAPI.BASE_URL, {
            params: {
                search_query: query,
                start: 0,
                max_results: maxResults,
                sortBy: "relevance",
                sortOrder: "descending",
            },
        });

        const result = await parseStringPromise(response.data);
        const entries = result.feed.entry || [];

        return entries.map((entry: any) => ({
            id: entry.id[0].split("/abs/")[1],
            title: entry.title[0].trim(),
            authors: entry.author.map((author: any) => author.name[0]),
            summary: entry.summary[0].trim(),
            published: entry.published[0],
            updated: entry.updated[0],
            link: entry.id[0],
        }));
    }

    async getPaper(id: string): Promise<ArxivSearchResult> {
        await this.waitForRateLimit();

        const response = await axios.get(ArxivAPI.BASE_URL, {
            params: {
                id_list: id,
            },
        });

        const result = await parseStringPromise(response.data);
        const entry = result.feed.entry[0];

        return {
            id: entry.id[0].split("/abs/")[1],
            title: entry.title[0].trim(),
            authors: entry.author.map((author: any) => author.name[0]),
            summary: entry.summary[0].trim(),
            published: entry.published[0],
            updated: entry.updated[0],
            link: entry.id[0],
        };
    }
}

// Create API instance
const api = new ArxivAPI();

// Provider implementation
const arxivProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<ArxivSearchResult | ArxivSearchResult[] | null> => {
        const query = message.content.text;
        if (!query) {
            return null;
        }

        try {
            if (query.startsWith("arxiv:") || /\d{4}\.\d{4,5}/.test(query)) {
                // If the query looks like an arXiv ID, get the specific paper
                const id = query.replace("arxiv:", "");
                return await api.getPaper(id);
            } else {
                // Otherwise, treat it as a search query
                return await api.search(query);
            }
        } catch (error) {
            console.error("Error in arxivProvider:", error);
            return null;
        }
    },
};

export { arxivProvider, api };
