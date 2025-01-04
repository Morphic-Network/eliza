import type {
    Action,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
} from "@ai16z/eliza";
import { api, type ArxivSearchResult } from "../providers/arxiv";

export const searchAction: Action = {
    name: "searchArxiv",
    similes: ["SEARCH_ARXIV", "FIND_PAPERS", "LOOKUP_ARXIV"],
    description: "Search for papers on arXiv",
    examples: [
        [
            {
                user: "user",
                content: { text: "Find papers about quantum computing" },
            },
        ],
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        console.log("ArxivPlugin: Validating search request...", message);

        // Extended list of search terms to better capture research-related queries
        const searchTerms = [
            "paper",
            "papers",
            "arxiv",
            "research",
            "article",
            "articles",
            "publication",
            "publications",
            "study",
            "studies",
            "journal",
            "journals",
            "preprint",
            "preprints",
            "scientific",
            "academic",
        ];

        // Check for research-related terms
        const hasSearchTerm = searchTerms.some((term) =>
            message.content.text?.toLowerCase().includes(term)
        );

        // Additional validation to avoid processing non-research queries
        const isValid =
            message.content.text !== undefined &&
            message.content.text.length > 0 &&
            hasSearchTerm;

        console.log("ArxivPlugin: Validation result:", isValid, {
            hasSearchTerm,
            query: message.content.text,
        });
        return isValid;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: any,
        callback?: HandlerCallback
    ) => {
        // First validate the message
        const isValid = await searchAction.validate(runtime, message);
        if (!isValid) {
            const response = {
                success: false,
                text: "I can only search for academic or research-related papers. Please include terms like 'paper', 'research', 'study', or specify an academic topic.",
            };

            if (callback) {
                await callback(response);
            }
            return response;
        }

        const content = {
            text: message.content.text,
            query: message.content.text,
        };

        console.log(
            "ArxivPlugin: Calling ArxivAPI.search with query:",
            content.query
        );
        const results = await api.search(content.query, 10);
        console.log(
            "ArxivPlugin: Search results:",
            results ? results.length : 0,
            "papers found"
        );

        const response = {
            success: false,
            text: "I couldn't find any papers matching your query on arXiv. Try rephrasing your search or using different keywords.",
        };

        if (results && results.length > 0) {
            // Format results with better structure and readability
            const formattedResults = results
                .map((paper, index) => {
                    const truncatedSummary =
                        paper.summary.length > 300
                            ? paper.summary.substring(0, 300) + "..."
                            : paper.summary;

                    return (
                        `${index + 1}. **${paper.title}**\n` +
                        `   Authors: ${paper.authors.join(", ")}\n` +
                        `   Published: ${new Date(paper.published).toLocaleDateString()}\n` +
                        `   Summary: ${truncatedSummary}\n` +
                        `   Link: ${paper.link}\n`
                    );
                })
                .join("\n");

            response.success = true;
            response.text = `I found ${results.length} relevant papers on arXiv:\n\n${formattedResults}\n\nLet me know if you'd like to know more about any of these papers!`;
        }

        if (callback) {
            await callback(response);
        }

        // Store in memory
        await runtime.documentsManager.createMemory({
            agentId: runtime.agentId,
            content: { text: response.text },
            userId: message.userId,
            roomId: message.roomId,
        });

        return response;
    },
};
