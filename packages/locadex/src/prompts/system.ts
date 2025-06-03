import { guides } from '../tools/guides.js';

export const ADDITIONAL_SETUP_SYSTEM_PROMPT = `You additionally have access to the following mcp tools made available via the 'locadex' mcp server:
mcp__locadex__fetch-docs
mcp__locadex__list-docs
${guides.map((guide) => `mcp__locadex__${guide.id}`).join('\n')}

Use these tools to help you with your tasks.`;
