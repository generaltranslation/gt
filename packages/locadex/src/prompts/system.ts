import { guides } from '../tools/guides.js';

export const mcpDocsTools = `mcp__locadex__fetch-docs
mcp__locadex__list-docs`;

export const mcpFileManagerTools = `mcp__locadex__addFile
mcp__locadex__markFileAsCompleted
mcp__locadex__removeFile
mcp__locadex__listFiles
mcp__locadex__clearFiles`;

export const allMcpTools = `${mcpDocsTools}
${mcpFileManagerTools}
${guides.map((guide) => `mcp__locadex__${guide.id}`).join('\n')}`;

export const basicMcpGuides = guides
  .filter((guide) => guide.type === 'basic')
  .map((guide) => `mcp__locadex__${guide.id}`)
  .join('\n');

export const advancedMcpGuides = guides
  .filter((guide) => guide.type === 'advanced')
  .map((guide) => `mcp__locadex__${guide.id}`)
  .join('\n');

export const allMcpPrompt = `You have access to mcp tools made available via the 'locadex' mcp server.
Generally, you should use the guides tools to help you with your tasks:
${basicMcpGuides}
${advancedMcpGuides}

You should only call the docs tools: 
${mcpDocsTools}
when you need specific information not covered by the guides.`;
