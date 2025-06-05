import { ClaudeCodeRunner } from './claudeCode.js';
import { fromPackageRoot } from './getPaths.js';
import fs from 'node:fs';
import path from 'node:path';
import { FileEntry } from './getFiles.js';
import { logger } from '../logging/logger.js';
import { addToGitIgnore } from './fs/writeFiles.js';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

const mcpStdioConfig = {
  mcpServers: {
    locadex: {
      command: 'npx',
      args: ['locadex-mcp'],
      env: {},
    },
  },
};

export function configureAgent(options: { mcpTransport: 'sse' | 'stdio' }) {
  const cwd = process.cwd();
  const tempDir = path.resolve(cwd, '.locadex', Date.now().toString());
  fs.mkdirSync(tempDir, { recursive: true });

  logger.debugMessage(`Temp directory created at: ${tempDir}`);

  addToGitIgnore(cwd, '.locadex');

  logger.debugMessage(`Added .locadex to .gitignore`);

  let mcpConfigPath = path.resolve(tempDir, 'mcp.json');
  const filesStateFilePath = path.resolve(tempDir, 'files-state.json');

  const filesState: FileEntry[] = [];

  fs.writeFileSync(filesStateFilePath, JSON.stringify(filesState, null, 2));

  let mcpProcess: ChildProcess | undefined = undefined;

  if (options.mcpTransport === 'stdio') {
    mcpStdioConfig.mcpServers.locadex.env = {
      LOCADEX_FILES_STATE_FILE_PATH: filesStateFilePath,
    };
    try {
      fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpStdioConfig, null, 2));
    } catch {
      mcpConfigPath = fromPackageRoot('.locadex-mcp-stdio.json');
    }
  } else {
    // Start the SSE MCP server as a child process
    mcpProcess = spawn('node', [fromPackageRoot('dist/mcp-sse.js')], {
      env: {
        LOCADEX_FILES_STATE_FILE_PATH: filesStateFilePath,
        LOCADEX_VERBOSE: logger.verbose ? 'true' : 'false',
        LOCADEX_DEBUG: logger.debug ? 'true' : 'false',
        ...process.env,
      },
      stdio: 'inherit',
    });

    // Handle process cleanup
    process.on('exit', () => {
      mcpProcess?.kill();
    });

    mcpConfigPath = fromPackageRoot('.locadex-mcp.json');
  }

  const agent = new ClaudeCodeRunner({
    apiKey: process.env.ANTHROPIC_API_KEY,
    mcpConfig: mcpConfigPath,
  });

  return {
    agent,
    filesStateFilePath,
    mcpProcess,
  };
}
