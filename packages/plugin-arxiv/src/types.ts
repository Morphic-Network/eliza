import { z } from "zod";
import { IAgentRuntime } from "@elizaos/core";

// ArXiv paper schema
export const ArxivPaperSchema = z.object({
    id: z.string(),
    title: z.string(),
    summary: z.string(),
    authors: z.array(z.string()),
    published: z.string(),
    updated: z.string(),
    link: z.string(),
    categories: z.array(z.string()),
    processed: z.boolean().default(false),
});

// Plugin configuration schema
export const ArxivPluginConfigSchema = z.object({
    query: z.string().default("cat:cs.AI OR cat:cs.LG OR cat:cs.CL"),
    maxResults: z.number().default(10),
    checkInterval: z.number().default(1440), // minutes
    categories: z.array(z.string()).default(["cs.AI", "cs.LG", "cs.CL"]),
    keywords: z
        .array(z.string())
        .default([
            "artificial intelligence",
            "machine learning",
            "TEE",
            "trusted execution environment",
            "privacy",
            "security",
        ]),
});

// Type definitions
export type ArxivPaper = z.infer<typeof ArxivPaperSchema>;
export type ArxivPluginConfig = z.infer<typeof ArxivPluginConfigSchema>;
