import { randomUUID } from 'node:crypto';
import { CliOptions } from '../types/cli.js';
import { ClaudeCodeRunner } from './claudeCode.js';
import { fromPackageRoot } from './getPaths.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { logMessage } from '../logging/console.js';

const mcpConfig = {
  mcpServers: {
    locadex: {
      command: 'npx',
      args: ['locadex-mcp'],
      env: {},
    },
  },
};

export function configureAgent(options: CliOptions) {
  const tempDir = path.resolve(os.tmpdir(), '.locadex', randomUUID());
  fs.mkdirSync(tempDir, { recursive: true });

  if (options.verbose) {
    logMessage(`[locadex] Temp directory created at: ${tempDir}`);
  }

  let mcpConfigPath = path.resolve(tempDir, 'mcp.json');
  const stateFilePath = path.resolve(tempDir, 'files-state.json');

  const state = {};

  fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2));

  mcpConfig.mcpServers.locadex.env = {
    LOCADEX_FILES_STATE_FILE: stateFilePath,
  };

  try {
    fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
  } catch (error) {
    mcpConfigPath = fromPackageRoot('.locadex-mcp.json');
  }

  const agent = new ClaudeCodeRunner({
    apiKey: process.env.ANTHROPIC_API_KEY,
    verbose: options.verbose,
    mcpConfig: mcpConfigPath,
  });

  return {
    agent,
    stateFilePath,
  };
}
