import type { Action, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { api } from "../providers/arxiv";
import "../types"; // Import type declarations

export const getPaperAction: Action = {
    name: "getArxivPaper",
    similes: ["GET_ARXIV_PAPER", "FETCH_PAPER", "GET_PAPER"],
    description: "Get details of a specific arXiv paper",
    examples: [
        [
            {
                user: "user",
                content: { text: "Get the paper with ID 2301.00001" },
            },
        ],
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        return (
            message.content.text !== undefined &&
            message.content.text.length > 0
        );
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: any
    ) => {
        const content = {
            text: message.content.text,
            id: message.content.text.match(/\d+\.\d+/)?.[0],
        };

        if (!content.id) {
            return {
                success: false,
                error: "No valid arXiv ID found in the message",
            };
        }

        const result = await api.getPaper(content.id); // Use the api directly to get the paper

        if (!result) {
            return {
                success: false,
                error: "Failed to fetch paper",
            };
        }

        return {
            success: true,
            data: result,
        };
    },
};
