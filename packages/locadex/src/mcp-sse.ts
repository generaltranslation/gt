#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { addDocsTools } from './mcp/tools/docs.js';
import { existsSync, readFileSync } from 'node:fs';
import { fromPackageRoot, getLocadexVersion } from './utils/getPaths.js';
import { addGuidesTools } from './mcp/tools/guides.js';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { logger } from './logging/logger.js';
import { findAvailablePort } from './mcp/getPort.js';
import { exit } from './utils/shutdown.js';
import { addValidateProjectTool } from './mcp/tools/validate.js';
import { validateEnv } from './mcp/validateEnv.js';

export async function start() {
  const { stateFile, logFile, verbose, debug, appDirectory } = validateEnv();
  const requestedPort = process.env.PORT ? parseInt(process.env.PORT) : 8888;
  const port = await findAvailablePort(requestedPort);

  logger.initialize({ verbose, debug }, logFile);

  if (stateFile && existsSync(stateFile)) {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    logger.debugMessage(
      `[locadex-mcp] state: ${JSON.stringify(state, null, 2)}`
    );
  } else {
    throw new Error(`[locadex-mcp] state file not found: ${stateFile}`);
  }

  const mcpServer = new McpServer({
    name: 'Locadex: AI Agent for Internationalization',
    version: JSON.parse(readFileSync(fromPackageRoot('package.json'), 'utf8'))
      .version,
  });

  const app = express();
  app.use(express.json());

  // Store transports for each session type
  const transports = {
    streamable: {} as Record<string, StreamableHTTPServerTransport>,
    sse: {} as Record<string, SSEServerTransport>,
  };

  addDocsTools(mcpServer);
  addGuidesTools(mcpServer);
  addValidateProjectTool(mcpServer, appDirectory);

  // SSE endpoint for legacy clients
  // Claude Code only supports SSE as of 2025-06-04
  app.get('/sse', async (req, res) => {
    const transport = new SSEServerTransport('/messages', res);
    transports.sse[transport.sessionId] = transport;

    res.on('close', () => {
      logger.log(
        `[locadex-mcp] SSE transport closed for sessionId: ${transport.sessionId}`
      );
      delete transports.sse[transport.sessionId];
    });

    await mcpServer.connect(transport);
  });

  // Companion endpoint for sending messages
  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.sse[sessionId];
    if (transport) {
      await transport.handlePostMessage(req, res, req.body);
    } else {
      logger.log(
        `[locadex-mcp] No transport found for sessionId: ${sessionId}`
      );
      res.status(400).send('No transport found for sessionId');
    }
  });

  app.listen(port, () => {
    const portMessage =
      port !== requestedPort
        ? `${port} (requested ${requestedPort} was in use)`
        : `${port}`;
    logger.debugMessage(
      `[locadex-mcp v${getLocadexVersion()}] started on port ${portMessage} with state file ${stateFile}`
    );
  });
}

// Start the SSE server
start().catch(async (error) => {
  logger.error(
    `[locadex-mcp] Failed to start: ${error instanceof Error ? error.message : String(error)}`
  );
  await exit(1);
});
