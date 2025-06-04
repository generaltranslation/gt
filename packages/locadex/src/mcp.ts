#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { addDocsTools } from './tools/docs.js';
import { readFileSync } from 'node:fs';
import { fromPackageRoot } from './utils/getPaths.js';
import { addGuidesTools } from './tools/guides.js';

async function main() {
  const server = new McpServer({
    name: 'Locadex: AI Agent for Internationalization',
    version: JSON.parse(readFileSync(fromPackageRoot('package.json'), 'utf8'))
      .version,
  });
  addDocsTools(server);
  addGuidesTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('locadex-mcp started on stdio');
}
main();
