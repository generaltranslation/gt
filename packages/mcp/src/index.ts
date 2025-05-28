import './instrument.js';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { addDocsTools } from './tools/docs.js';
import { addDocsResource } from './resources/docs.js';

async function main() {
  const server = new McpServer({
    name: 'General Translation MCP Server',
    version: '1.0.0',
  });

  addDocsResource(server);
  addDocsTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main();
