import {
    Action,
    IAgentRuntime,
    generateText,
    ModelClass,
    Memory,
    HandlerCallback,
    State,
    elizaLogger,
    stringToUuid,
    getEmbeddingZeroVector,
} from "@elizaos/core";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { createResourceTemplate } from "../templates";

const parser = new XMLParser();

export const searchArxivAction: Action = {
    name: "searchArxiv",
    description: "Search papers from arXiv based on query",
    similes: ["search papers", "find research", "look up papers"],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state: State,
        _options: any,
        callback: HandlerCallback
    ) => {
        try {
            const arxivSearchQuery = message.content.text;
            elizaLogger.log("arxiv search prompt received:", arxivSearchQuery);

            const baseUrl = "http://export.arxiv.org/api/query";
            const searchUrl = `${baseUrl}?search_query=all:${arxivSearchQuery}&start=0&max_results=3`;

            const response = await axios.get(searchUrl);
            const result = parser.parse(response.data);

            if (!result.feed.entry || result.feed.entry.length === 0) {
                callback({ text: "No papers found matching your query." }, []);
                return;
            }

            const papers = Array.isArray(result.feed.entry)
                ? result.feed.entry
                : [result.feed.entry];

            const formattedPapers = papers
                .map(
                    (paper) =>
                        `Title: ${paper.title}\n` +
                        `Authors: ${Array.isArray(paper.author) ? paper.author.map((a) => a.name).join(", ") : paper.author.name}\n` +
                        `Published: ${new Date(paper.published).toLocaleDateString()}\n` +
                        `Link: ${paper.id}\n` +
                        `Summary: ${paper.summary.substring(0, 200)}...\n`
                )
                .join("\n---\n\n");

            // generate summary
            const summaryPrompt = `Please summarize the following ${papers.length} arXiv papers: ${formattedPapers}

            A short paragraph of all papers first, then a concise overview of the main research themes, breakthough, and potential implications in plain text. No markdown please.

            Keep the summary clear and concise`;

            const summarizedPapers = await generateText({
                runtime,
                context: summaryPrompt,
                modelClass: ModelClass.SMALL,
            });

            // persist papers if needed to memory/knowledge
            const memory = {
                id: stringToUuid(arxivSearchQuery),
                userId: runtime.agentId,
                agentId: runtime.agentId,
                roomId: message.roomId,
                content: {
                    text: formattedPapers,
                    source: "arxiv",
                },
                type: "arxiv",
                timestamp: new Date().toISOString(),
                embedding: getEmbeddingZeroVector(),
            };

            await runtime.messageManager.createMemory(memory);

            callback(
                {
                    text: `Found ${papers.length} papers:\n\n${summarizedPapers}`,
                },
                []
            );
        } catch (error) {
            elizaLogger.error("Error searching arXiv papers:", error);
            callback(
                {
                    text: "Failed to search arXiv papers. Please try again later.",
                },
                []
            );
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Find papers about quantum computing",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Found 3 papers:\n\nTitle: Recent Advances in Quantum Computing...",
                },
            },
        ],
    ],
};
