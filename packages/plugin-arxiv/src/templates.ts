export const createResourceTemplate = `
Extract the following details to create a new resource:
- **name** (string): Name of the resource
- **type** (string): Type of resource (document, image, video)
- **description** (string): Description of the resource
- **tags** (array): Array of tags to categorize the resource

Provide the values in the following JSON format:

\`\`\`json
{
    "name": "<resource_name>",
    "type": "<resource_type>",
    "description": "<resource_description>",
    "tags": ["<tag1>", "<tag2>"]
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const readResourceTemplate = `
Extract the following details to read a resource:
- **id** (string): Unique identifier of the resource
- **fields** (array): Specific fields to retrieve (optional)

Provide the values in the following JSON format:

\`\`\`json
{
    "id": "<resource_id>",
    "fields": ["<field1>", "<field2>"]
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const updateResourceTemplate = `
Extract the following details to update a resource:
- **id** (string): Unique identifier of the resource
- **updates** (object): Key-value pairs of fields to update

Provide the values in the following JSON format:

\`\`\`json
{
    "id": "<resource_id>",
    "updates": {
        "<field1>": "<new_value1>",
        "<field2>": "<new_value2>"
    }
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const arxivReviewTemplate = `
# Task: Review arXiv Paper
Analyze and comment on the following paper from the perspective of {{agentName}}:

Title: {{paperTitle}}
Authors: {{paperAuthors}}
Categories: {{paperCategories}}
Abstract: {{paperSummary}}

Guidelines:
- Focus on key innovations and their implications
- Connect to fundamental computing/AI principles
- Consider privacy and security aspects
- Maintain scholarly yet accessible tone
- Keep response under {{maxTweetLength}} characters
- Use \\n\\n for multiple statements

Your response should be 1-3 sentences that:
1. Highlight the most significant contribution
2. Connect it to broader AI/computing theory
3. Consider practical implications
`;

export const arxivSummaryTemplate = `
# Task: Summarize Recent arXiv Papers
Generate a summary of recent papers in AI and TEE:

Papers:
{{papers}}

Guidelines:
- Identify emerging trends
- Note significant breakthroughs
- Consider security implications
- Keep academic but engaging tone
- Focus on practical applications
- Highlight cross-disciplinary connections

Your response should synthesize the key developments and their potential impact.
`;
