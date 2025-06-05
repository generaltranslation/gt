import { guides } from '../tools/guides.js';
import { docsTools } from '../tools/docs.js';
import { fileManagerTools } from '../tools/fileManager.js';

export const mcpDocsTools = Object.keys(docsTools).map(
  (tool) => `mcp__locadex__${tool}`
);

export const mcpFileManagerTools = Object.keys(fileManagerTools).map(
  (tool) => `mcp__locadex__${tool}`
);

export const mcpGuidesTools = guides.map(
  (guide) => `mcp__locadex__${guide.id}`
);

export const allMcpTools = `${mcpDocsTools}
${mcpFileManagerTools.join('\n')}
${guides.map((guide) => `mcp__locadex__${guide.id}`).join('\n')}`;

// Helper function to generate tool strings with mcp__locadex__ prefix
const formatTools = (
  tools: { id: string; description: string }[] | { [id: string]: string }
) => {
  if (Array.isArray(tools)) {
    return tools
      .map((tool) => `mcp__locadex__${tool.id}: ${tool.description}`)
      .join('\n');
  } else {
    return Object.entries(tools)
      .map(([id, description]) => `mcp__locadex__${id}: ${description}`)
      .join('\n');
  }
};

// Generate tool descriptions with mcp__locadex__ prefix
const docsToolsWithDescriptions = formatTools(docsTools);
const fileManagerToolsWithDescriptions = formatTools(fileManagerTools);
const guidesToolsWithDescriptions = formatTools(guides);

export const allMcpPrompt = `You have access to mcp tools made available via the 'locadex' mcp server:

## I18n File Checklist Manager Tools (Essential for tracking progress):
${fileManagerToolsWithDescriptions}

## Documentation Tools:
${docsToolsWithDescriptions}

## Guide Tools:
${guidesToolsWithDescriptions}

Generally, you should use the guides tools to help you with your tasks. You should only call the docs tools when you need specific information not covered by the guides. Always use the file manager tools to track your progress systematically.`;
