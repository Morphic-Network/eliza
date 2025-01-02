import type { ArxivAPI } from "./providers/arxiv";

declare module "@ai16z/eliza" {
    interface Providers {
        arxiv: ArxivAPI;
    }
}
