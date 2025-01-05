import {
    Provider,
    IAgentRuntime,
    Memory,
    State,
    elizaLogger,
} from "@elizaos/core";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser();

export const arxivProvider: Provider = {
    get: async (_runtime: IAgentRuntime, message: Memory, _state: State) => {
        try {
            const query = encodeURIComponent(message.content.text);
            const baseUrl = "http://export.arxiv.org/api/query";
            const searchUrl = `${baseUrl}?search_query=all:${query}&start=0&max_results=5`;

            const response = await axios.get(searchUrl);
            const result = parser.parse(response.data);

            if (!result.feed.entry) {
                return [];
            }

            const papers = Array.isArray(result.feed.entry)
                ? result.feed.entry
                : [result.feed.entry];

            return papers.map((paper) => ({
                title: paper.title,
                authors: Array.isArray(paper.author)
                    ? paper.author.map((a) => a.name)
                    : [paper.author.name],
                summary: paper.summary,
                link: paper.id,
                published: paper.published,
            }));
        } catch (error) {
            elizaLogger.error("Error in arxivProvider:", error);
            return [];
        }
    },
};
