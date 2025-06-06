import { guides } from '../mcp/tools/guides.js';
import { docsTools } from '../mcp/tools/docs.js';

export const mcpDocsTools = Object.keys(docsTools).map(
  (tool) => `mcp__locadex__${tool}`
);

export const mcpGuidesTools = guides.map(
  (guide) => `mcp__locadex__${guide.id}`
);

export const allMcpPrompt = `You have access to mcp tools made available via the 'locadex' mcp server:

## Documentation Tools:
${mcpDocsTools.join('\n')}

## Guide Tools:
${mcpGuidesTools.join('\n')}

Generally, you should use the guides tools to help you with your tasks. You should only call the docs tools when you need specific information not covered by the guides.`;
