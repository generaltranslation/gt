#!/usr/bin/env node

import './telemetry.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { addDocsTools } from './mcp/tools/docs.js';
import { existsSync, readFileSync } from 'node:fs';
import { fromPackageRoot } from './utils/getPaths.js';
import { addGuidesTools } from './mcp/tools/guides.js';
import { addFileManagerTools } from './mcp/tools/fileManager.js';

async function main() {
  const stateFile = process.env.LOCADEX_FILES_STATE_FILE_PATH;
  if (stateFile && existsSync(stateFile)) {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    console.error(`[locadex-mcp] state: ${JSON.stringify(state, null, 2)}`);
  } else {
    throw new Error(`[locadex-mcp] state file not found: ${stateFile}`);
  }

  const server = new McpServer({
    name: 'Locadex: AI Agent for Internationalization',
    version: JSON.parse(readFileSync(fromPackageRoot('package.json'), 'utf8'))
      .version,
  });
  addDocsTools(server);
  addGuidesTools(server);
  addFileManagerTools(server, stateFile);

  console.error('[locadex-mcp] All tools registered');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[locadex-mcp] started on stdio');
}
main();
