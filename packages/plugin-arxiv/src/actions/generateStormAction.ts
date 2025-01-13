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

const parser = new XMLParser();

export const generateStormAction: Action = {
    name: "generateStorm",
    description: "Generate research reports from storm based on topic",
    similes: ["generate paper", "generate report", "generate article"],
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
            const topic = message.content.text;
            elizaLogger.log("arxiv search prompt received:", topic);

            const baseUrl = process.env.STORM_SERVER_URL;
            const searchUrl = `${baseUrl}?/article/generate?open_api_key=${process.env.OPENAI_API_KEY}&retriever=tavily&tavily_api_key=${process.env.TAVILY_API_KEY}&topic=${topic}`;

            const response = await axios.get(searchUrl);
            const result = parser.parse(response.data);

            if (!result.url || result.url.length === 0) {
                callback({ text: "Error when calling storm" }, []);
                return;
            }

            callback(
                {
                    text: `Generating research report for topic "${topic}"...\n\nLink: ${result.url}`,
                },
                []
            );
        } catch (error) {
            elizaLogger.error("Error searching storm paper:", error);
            callback(
                {
                    text: "Failed to search generate storm paper. Please try again later.",
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
                    text: "Generate a research report about AI Agent",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Generate a paper about TEE",
                },
            },
        ],
    ],
};
