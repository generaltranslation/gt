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

export class LocadexManager {
  private mcpProcess: ChildProcess | undefined;
  private mcpConfigPath: string;
  private filesStateFilePath: string;
  private tempDir: string;
  private apiKey?: string;

  constructor(options: { mcpTransport: 'sse' | 'stdio'; apiKey?: string }) {
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;

    const cwd = process.cwd();
    this.tempDir = path.resolve(cwd, '.locadex', Date.now().toString());
    fs.mkdirSync(this.tempDir, { recursive: true });

    logger.debugMessage(`Temp directory created at: ${this.tempDir}`);

    addToGitIgnore(cwd, '.locadex');

    logger.debugMessage(`Added .locadex to .gitignore`);

    this.mcpConfigPath = path.resolve(this.tempDir, 'mcp.json');
    this.filesStateFilePath = path.resolve(this.tempDir, 'files-state.json');

    const filesState: FileEntry[] = [];
    fs.writeFileSync(
      this.filesStateFilePath,
      JSON.stringify(filesState, null, 2)
    );

    if (options.mcpTransport === 'stdio') {
      mcpStdioConfig.mcpServers.locadex.env = {
        LOCADEX_FILES_STATE_FILE_PATH: this.filesStateFilePath,
      };
      try {
        fs.writeFileSync(
          this.mcpConfigPath,
          JSON.stringify(mcpStdioConfig, null, 2)
        );
      } catch {
        this.mcpConfigPath = fromPackageRoot('.locadex-mcp-stdio.json');
      }
    } else {
      this.mcpProcess = spawn('node', [fromPackageRoot('dist/mcp-sse.js')], {
        env: {
          LOCADEX_FILES_STATE_FILE_PATH: this.filesStateFilePath,
          LOCADEX_VERBOSE: logger.verbose ? 'true' : 'false',
          LOCADEX_DEBUG: logger.debug ? 'true' : 'false',
          ...process.env,
        },
        stdio: 'inherit',
      });

      this.mcpProcess.on('error', (error) => {
        logger.error(`MCP server failed to start: ${error.message}`);
        process.exit(1);
      });

      this.mcpProcess.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
          logger.error(`MCP server exited with code ${code}`);
          process.exit(code);
        }
        if (signal) {
          logger.error(`MCP server was killed with signal ${signal}`);
          process.exit(1);
        }
      });

      process.on('exit', () => {
        this.cleanup();
      });

      this.mcpConfigPath = fromPackageRoot('.locadex-mcp.json');
    }
  }

  createAgent(): ClaudeCodeRunner {
    return new ClaudeCodeRunner({
      apiKey: this.apiKey,
      mcpConfig: this.mcpConfigPath,
    });
  }

  getFilesStateFilePath(): string {
    return this.filesStateFilePath;
  }

  cleanup(): void {
    if (this.mcpProcess && !this.mcpProcess.killed) {
      this.mcpProcess.kill('SIGTERM');
      setTimeout(() => {
        if (this.mcpProcess && !this.mcpProcess.killed) {
          this.mcpProcess.kill('SIGKILL');
        }
      }, 1000);
    }
  }
}

export function configureAgent(options: { mcpTransport: 'sse' | 'stdio' }) {
  const manager = new LocadexManager(options);
  const agent = manager.createAgent();

  process.on('beforeExit', () => {
    manager.cleanup();
  });

  return {
    agent,
    filesStateFilePath: manager.getFilesStateFilePath(),
  };
}
