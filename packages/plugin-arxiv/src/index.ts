import type { Plugin } from "@ai16z/eliza";
import { searchAction } from "./actions/search";
import { getPaperAction } from "./actions/get";
import { arxivProvider } from "./providers/arxiv";

export * from "./actions/search";
export * from "./actions/get";
export * from "./providers/arxiv";

export const arxivPlugin: Plugin = {
    name: "arxiv",
    description: "Plugin for searching and retrieving papers from arXiv",
    actions: [searchAction, getPaperAction],
    evaluators: [],
    providers: [arxivProvider],
};
