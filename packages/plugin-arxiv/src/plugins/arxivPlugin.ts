import { Plugin } from "@elizaos/core";
import { searchArxivAction } from "../actions/searchArxivAction";
import { arxivProvider } from "../providers/arxivProvider";

export const arxivPlugin: Plugin = {
    name: "arxiv",
    description: "Plugin for searching and analyzing arXiv papers",
    actions: [searchArxivAction],
    providers: [arxivProvider],
    evaluators: [],
    services: [],
    clients: [],
};
