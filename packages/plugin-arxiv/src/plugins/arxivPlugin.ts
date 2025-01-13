import {
    Plugin,
    IAgentRuntime,
    elizaLogger,
    Memory,
    stringToUuid,
    Service,
    ServiceType,
    ITextGenerationService,
} from "@elizaos/core";
import { searchArxivAction } from "../actions/searchArxivAction";
import { generateStormAction } from "../actions/generateStormAction";
import { arxivProvider } from "../providers/arxivProvider";
import { ArxivPaper } from "../types";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser();

/**
 * Service for managing arXiv paper updates
 */
class ArxivUpdateService implements Service {
    private static instance: ArxivUpdateService | null = null;
    private runtime: IAgentRuntime | null = null;
    private updateInterval: NodeJS.Timeout | null = null;
    private config: {
        categories: string[];
        maxResults: number;
        checkInterval: number;
    };

    static get serviceType(): ServiceType {
        return "arxiv-update" as ServiceType;
    }

    static async initialize(runtime: IAgentRuntime): Promise<void> {
        const service = new ArxivUpdateService();
        await service.initialize(runtime);
    }

    private constructor() {
        this.config = {
            categories: [],
            maxResults: 5,
            checkInterval: 21600000, // 6 hours default
        };
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        this.runtime = runtime;
        this.config = {
            categories: runtime.character.settings?.["arxiv"]?.categories || [
                "cs.AI",
                "cs.LG",
            ],
            maxResults:
                runtime.character.settings?.["arxiv"]?.maxPapersPerCategory ||
                5,
            checkInterval:
                runtime.character.settings?.["arxiv"]?.updateIntervalMs ||
                21600000,
        };
        await this.start();
    }

    async start() {
        await this.updatePaperCache();
        this.updateInterval = setInterval(() => {
            this.updatePaperCache().catch((error) => {
                elizaLogger.error(
                    "Error in paper cache update interval:",
                    error
                );
            });
        }, this.config.checkInterval);

        elizaLogger.log(
            `ArXiv update service started with categories: ${this.config.categories.join(", ")}`
        );
    }

    async stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    get serviceType(): ServiceType {
        return "arxiv-update" as ServiceType;
    }

    /**
     * Fetches papers from arXiv based on given categories
     */
    private async fetchPapers(
        categories: string[],
        maxResults: number = 5
    ): Promise<ArxivPaper[]> {
        const papers: ArxivPaper[] = [];

        for (const category of categories) {
            try {
                const query = encodeURIComponent(`cat:${category}`);
                const baseUrl = "http://export.arxiv.org/api/query";
                const searchUrl = `${baseUrl}?search_query=${query}&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

                const response = await axios.get(searchUrl);
                const result = parser.parse(response.data);

                if (!result.feed.entry) continue;

                const entries = Array.isArray(result.feed.entry)
                    ? result.feed.entry
                    : [result.feed.entry];

                for (const entry of entries) {
                    papers.push({
                        id: entry.id,
                        title: entry.title,
                        summary: entry.summary,
                        authors: Array.isArray(entry.author)
                            ? entry.author.map((a: any) => a.name)
                            : [entry.author.name],
                        published: entry.published,
                        updated: entry.updated,
                        link: entry.id,
                        categories: [category],
                        processed: false,
                    });
                }
            } catch (error) {
                elizaLogger.error(
                    `Error fetching papers for category ${category}:`,
                    error
                );
            }
        }

        return papers;
    }

    /**
     * Stores paper information in the agent's memory
     */
    private async storePaperInMemory(paper: ArxivPaper, roomId: string) {
        if (!this.runtime) {
            elizaLogger.error("Runtime not initialized");
            return;
        }

        const textContent = `Title: ${paper.title}\nAuthors: ${paper.authors.join(", ")}\nSummary: ${paper.summary}`;
        const textGenService = this.runtime.getService<ITextGenerationService>(
            ServiceType.TEXT_GENERATION
        );
        const embedding =
            await textGenService?.getEmbeddingResponse(textContent);

        const memory: Memory = {
            id: stringToUuid(paper.id),
            userId: this.runtime.agentId,
            agentId: this.runtime.agentId,
            roomId: stringToUuid(roomId),
            content: {
                text: textContent,
                source: "arxiv",
                paper: paper,
            },
            embedding: embedding || [],
            createdAt: Date.parse(paper.published),
        };

        await this.runtime.messageManager.createMemory(memory);
        elizaLogger.log(`Stored paper in memory: ${paper.title}`);
    }

    /**
     * Updates the paper cache and triggers processing of new papers
     */
    private async updatePaperCache() {
        const roomId = `arxiv-papers-${this.runtime.agentId}`;
        await this.runtime.ensureRoomExists(stringToUuid(roomId));

        const papers = await this.fetchPapers(
            this.config.categories,
            this.config.maxResults
        );

        for (const paper of papers) {
            try {
                const existingMemory =
                    await this.runtime.messageManager.getMemoryById(
                        stringToUuid(paper.id)
                    );
                if (!existingMemory) {
                    await this.storePaperInMemory(paper, roomId);
                    elizaLogger.log(`Stored new paper: ${paper.title}`);
                }
            } catch (error) {
                elizaLogger.error(`Error storing paper ${paper.id}:`, error);
            }
        }
    }
}

export const arxivPlugin: Plugin = {
    name: "arxiv",
    description: "Plugin for searching and analyzing arXiv papers",
    actions: [searchArxivAction, generateStormAction],
    providers: [arxivProvider],
    evaluators: [],
    services: [ArxivUpdateService],
    clients: [],
};
