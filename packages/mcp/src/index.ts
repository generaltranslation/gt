#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { addDocsTools } from './tools/docs.js';
import { addDocsResource } from './resources/docs.js';
import { readFileSync } from 'node:fs';
import { fromPackageRoot } from './utils/getPaths.js';

async function main() {
  const server = new McpServer({
    name: 'General Translation MCP Server',
    version: JSON.parse(readFileSync(fromPackageRoot('package.json'), 'utf8'))
      .version,
  });
  addDocsResource(server);
  addDocsTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('General Translation MCP server started on stdio');
}
main();
