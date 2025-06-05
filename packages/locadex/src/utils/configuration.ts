import { ClaudeCodeRunner } from './claudeCode.js';
import { fromPackageRoot } from './getPaths.js';
import fs from 'node:fs';
import path from 'node:path';
import { FileEntry } from './getFiles.js';
import { logger } from '../logging/logger.js';
import { addToGitIgnore } from './fs/writeFiles.js';

const mcpConfig = {
  mcpServers: {
    locadex: {
      command: 'npx',
      args: ['locadex-mcp'],
      env: {},
    },
  },
};

export function configureAgent() {
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

  mcpConfig.mcpServers.locadex.env = {
    LOCADEX_FILES_STATE_FILE_PATH: filesStateFilePath,
  };

  try {
    fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
  } catch (error) {
    mcpConfigPath = fromPackageRoot('.locadex-mcp.json');
  }

  const agent = new ClaudeCodeRunner({
    apiKey: process.env.ANTHROPIC_API_KEY,
    mcpConfig: mcpConfigPath,
  });

  return {
    agent,
    filesStateFilePath,
  };
}
