import { elizaLogger, ServiceType } from "@elizaos/core";
import {
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    Plugin,
    State,
    Service,
} from "@elizaos/core";
import { ITextGenerationService } from "@elizaos/core";
import { stringToUuid } from "@elizaos/core";
import { generateWebSearch } from "@elizaos/core";
import { SearchResult } from "@elizaos/core";
import { encodingForModel, TiktokenModel } from "js-tiktoken";

const DEFAULT_MAX_WEB_SEARCH_TOKENS = 4000;
const DEFAULT_MODEL_ENCODING = "gpt-3.5-turbo";

function getTotalTokensFromString(
    str: string,
    encodingName: TiktokenModel = DEFAULT_MODEL_ENCODING
) {
    const encoding = encodingForModel(encodingName);
    return encoding.encode(str).length;
}

function MaxTokens(
    data: string,
    maxTokens: number = DEFAULT_MAX_WEB_SEARCH_TOKENS
): string {
    if (getTotalTokensFromString(data) >= maxTokens) {
        return data.slice(0, maxTokens);
    }
    return data;
}

class WebSearchUpdateService implements Service {
    private runtime: IAgentRuntime | null = null;
    private updateInterval: NodeJS.Timeout | null = null;
    private config: {
        categories: string[];
        maxResults: number;
        checkInterval: number;
    };

    constructor() {
        this.config = {
            categories: [],
            maxResults: 3,
            checkInterval: 18000000, // 5 hours default
        };
    }

    static async initialize(runtime: IAgentRuntime): Promise<void> {
        const service = new WebSearchUpdateService();
        await service.initialize(runtime);
    }

    static get serviceType(): ServiceType {
        return ServiceType.TEXT_GENERATION;
    }

    get serviceType(): ServiceType {
        return ServiceType.TEXT_GENERATION;
    }


    async initialize(runtime: IAgentRuntime): Promise<void> {
        this.runtime = runtime;
        this.config = {
            categories: runtime.character.settings?.["webSearch"]?.categories || [
                "ai",
                "nlp",
                "eliza",
            ],
            maxResults:
                runtime.character.settings?.["webSearch"]?.maxPapersPerCategory ||
                3,
            checkInterval:
                runtime.character.settings?.["webSearch"]?.updateIntervalMs ||
                18000000,
        };
        await this.start();
    }

    async start(): Promise<void> {
        await this.updateWebSearchCache();
        this.updateInterval = setInterval(() => {
            this.updateWebSearchCache().catch((error) => {
                elizaLogger.error(
                    "Error in web search update interval:",
                    error
                );
            });
        }, this.config.checkInterval);

        elizaLogger.log(
            `Web search update service started with categories: ${this.config.categories.join(", ")}`
        );
    }

    async updateWebSearchCache() {
        const roomId = `webresearch-${this.runtime.agentId}`;
        await this.runtime.ensureRoomExists(stringToUuid(roomId));

        const results: SearchResult[] = [];
        for (const category of this.config.categories) {
            try {
                const ws = await generateWebSearch(
                    `What is the latest news about ${category}?`,
                    this.runtime
                );
                for (const result of ws.results.slice(0, this.config.maxResults)) {
                    const existingMemory =
                        await this.runtime.messageManager.getMemoryById(
                            stringToUuid(result.title)
                        );
                    if (!existingMemory) {
                        await this.storeWebSearchInMemory(result, roomId);
                        elizaLogger.log(`Stored web search: ${result.title}`);
                    }
                }
            } catch (error) {
                elizaLogger.error(
                    `Error fetching web search results for category ${category}:`,
                    error
                );
            }
        }
    }

    private async storeWebSearchInMemory(
        searchResult: SearchResult,
        roomId: string
    ) {
        if (!this.runtime) {
            elizaLogger.error("Runtime not initialized");
            return;
        }

        const textContent = `Title: ${searchResult.title}\n Content: ${searchResult.content}\n URL: ${searchResult.url}\n Published Date: ${searchResult.publishedDate}`;
        const memory: Memory = {
            id: stringToUuid(searchResult.title),
            userId: this.runtime.agentId,
            agentId: this.runtime.agentId,
            roomId: stringToUuid(roomId),
            content: {
                text: textContent,
                source: "websearch",
                searchResult,
            },
            createdAt: Date.now(),
        };
        await this.runtime.messageManager.createMemory(memory);
        elizaLogger.log(`Stored web search in memory: ${searchResult.title}`);
    }

    async stop(): Promise<void> {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}

const webSearch: Action = {
    name: "WEB_SEARCH",
    similes: [
        "SEARCH_WEB",
        "INTERNET_SEARCH",
        "LOOKUP",
        "QUERY_WEB",
        "FIND_ONLINE",
        "SEARCH_ENGINE",
        "WEB_LOOKUP",
        "ONLINE_SEARCH",
        "FIND_INFORMATION",
    ],
    description:
        "Perform a web search to find information related to the message.",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const tavilyApiKeyOk = !!runtime.getSetting("TAVILY_API_KEY");

        return tavilyApiKeyOk;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ) => {
        elizaLogger.log("Composing state for message:", message);
        state = (await runtime.composeState(message)) as State;
        const userId = runtime.agentId;
        elizaLogger.log("User ID:", userId);

        const webSearchPrompt = message.content.text;
        elizaLogger.log("web search prompt received:", webSearchPrompt);

        elizaLogger.log("Generating image with prompt:", webSearchPrompt);
        const searchResponse = await generateWebSearch(
            webSearchPrompt,
            runtime
        );

        if (searchResponse && searchResponse.results.length) {
            const responseList = searchResponse.answer
                ? `${searchResponse.answer}${
                      Array.isArray(searchResponse.results) &&
                      searchResponse.results.length > 0
                          ? `\n\nFor more details, you can check out these resources:\n${searchResponse.results
                                .map(
                                    (result: SearchResult, index: number) =>
                                        `${index + 1}. [${result.title}](${result.url})`
                                )
                                .join("\n")}`
                          : ""
                  }`
                : "";

            callback({
                text: MaxTokens(responseList, DEFAULT_MAX_WEB_SEARCH_TOKENS),
            });
        } else {
            elizaLogger.error("search failed or returned no data.");
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Find the latest news about SpaceX launches.",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here is the latest news about SpaceX launches:",
                    action: "WEB_SEARCH",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you find details about the iPhone 16 release?",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here are the details I found about the iPhone 16 release:",
                    action: "WEB_SEARCH",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What is the schedule for the next FIFA World Cup?",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here is the schedule for the next FIFA World Cup:",
                    action: "WEB_SEARCH",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Check the latest stock price of Tesla." },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here is the latest stock price of Tesla I found:",
                    action: "WEB_SEARCH",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What are the current trending movies in the US?",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here are the current trending movies in the US:",
                    action: "WEB_SEARCH",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What is the latest score in the NBA finals?",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here is the latest score from the NBA finals:",
                    action: "WEB_SEARCH",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "When is the next Apple keynote event?" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here is the information about the next Apple keynote event:",
                    action: "WEB_SEARCH",
                },
            },
        ],
    ],
} as Action;

export const webSearchPlugin: Plugin = {
    name: "webSearch",
    description: "Search web",
    actions: [webSearch],
    evaluators: [],
    providers: [],
    services: [WebSearchUpdateService],
};

export default webSearchPlugin;
