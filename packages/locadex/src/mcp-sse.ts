#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { addDocsTools } from './mcp/tools/docs.js';
import { existsSync, readFileSync } from 'node:fs';
import { fromPackageRoot } from './utils/getPaths.js';
import { addGuidesTools } from './mcp/tools/guides.js';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { logger } from './logging/logger.js';
import { createServer } from 'node:http';

async function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.listen(startPort, () => {
      const port = (server.address() as any)?.port;
      server.close(() => resolve(port));
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        // Port is in use, try the next one
        findAvailablePort(startPort + 1)
          .then(resolve)
          .catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

export async function start() {
  const stateFile = process.env.LOCADEX_FILES_STATE_FILE_PATH;
  const requestedPort = process.env.PORT ? parseInt(process.env.PORT) : 8888;
  const port = await findAvailablePort(requestedPort);

  const verbose = process.env.LOCADEX_VERBOSE === 'true';
  const debug = process.env.LOCADEX_DEBUG === 'true';

  logger.initialize({ verbose, debug });

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

  // SSE endpoint for legacy clients
  // Claude Code only supports SSE as of 2025-06-04
  app.get('/sse', async (req, res) => {
    const transport = new SSEServerTransport('/messages', res);
    transports.sse[transport.sessionId] = transport;

    res.on('close', () => {
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
      res.status(400).send('No transport found for sessionId');
    }
  });

  app.listen(port, () => {
    const portMessage =
      port !== requestedPort
        ? `${port} (requested ${requestedPort} was in use)`
        : `${port}`;
    logger.debugMessage(
      `[locadex-mcp] started on port ${portMessage} with state file ${stateFile}`
    );
  });
}

// Start the SSE server
start().catch((error) => {
  logger.error(
    `[locadex-mcp-sse] Failed to start: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
