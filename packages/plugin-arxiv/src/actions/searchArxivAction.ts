import {
    Action,
    IAgentRuntime,
    Memory,
    HandlerCallback,
    State,
    elizaLogger,
} from "@elizaos/core";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

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
            const query = encodeURIComponent(message.content.text);
            const baseUrl = "http://export.arxiv.org/api/query";
            const searchUrl = `${baseUrl}?search_query=all:${query}&start=0&max_results=10`;

            const response = await axios.get(searchUrl);
            const result = parser.parse(response.data);

            if (!result.feed.entry || result.feed.entry.length === 0) {
                callback({ text: "No papers found matching your query." }, []);
                return;
            }

            const papers = Array.isArray(result.feed.entry)
                ? result.feed.entry
                : [result.feed.entry];

            const formattedResponse = papers
                .map(
                    (paper) =>
                        `Title: ${paper.title}\n` +
                        `Authors: ${Array.isArray(paper.author) ? paper.author.map((a) => a.name).join(", ") : paper.author.name}\n` +
                        `Published: ${new Date(paper.published).toLocaleDateString()}\n` +
                        `Link: ${paper.id}\n` +
                        `Summary: ${paper.summary.substring(0, 200)}...\n`
                )
                .join("\n---\n\n");

            // Store in memory manager instead of using non-existent storeMemory
            await runtime.messageManager.createMemory({
                id: runtime.agentId,
                userId: message.userId,
                agentId: runtime.agentId,
                roomId: message.roomId,
                content: {
                    text: formattedResponse,
                    source: "arxiv",
                },
            });

            callback(
                {
                    text: `Found ${papers.length} papers:\n\n${formattedResponse}`,
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
