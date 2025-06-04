import { guides } from '../tools/guides.js';

export const mcpTools = `mcp__locadex__fetch-docs
mcp__locadex__list-docs
${guides.map((guide) => `mcp__locadex__${guide.id}`).join('\n')}`;
