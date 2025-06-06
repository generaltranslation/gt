import { ClaudeCodeRunner } from './claudeCode.js';
import { fromPackageRoot } from './getPaths.js';
import fs from 'node:fs';
import path from 'node:path';
import { FileEntry } from './getFiles.js';
import { logger } from '../logging/logger.js';
import { addToGitIgnore } from './fs/writeFiles.js';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

export interface LocadexMetadata {
  createdAt: string;
  locadexVersion: string;
  workingDirectory: string;
  transport: 'sse' | 'stdio';
  tempDirectory: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  batchSize?: number;
  [key: string]: any;
}

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
  private metadataFilePath: string;
  private tempDir: string;
  private apiKey?: string;

  constructor(options: { 
    mcpTransport: 'sse' | 'stdio'; 
    apiKey?: string;
    metadata?: Partial<LocadexMetadata>;
  }) {
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;

    const cwd = process.cwd();
    this.tempDir = path.resolve(cwd, '.locadex', Date.now().toString());
    fs.mkdirSync(this.tempDir, { recursive: true });

    logger.debugMessage(`Temp directory created at: ${this.tempDir}`);

    addToGitIgnore(cwd, '.locadex');

    logger.debugMessage(`Added .locadex to .gitignore`);

    this.mcpConfigPath = path.resolve(this.tempDir, 'mcp.json');
    this.filesStateFilePath = path.resolve(this.tempDir, 'files-state.json');
    this.metadataFilePath = path.resolve(this.tempDir, 'metadata.json');

    // Create files-state.json
    const filesState: FileEntry[] = [];
    fs.writeFileSync(
      this.filesStateFilePath,
      JSON.stringify(filesState, null, 2)
    );

    // Create metadata.json
    const metadata: LocadexMetadata = {
      createdAt: new Date().toISOString(),
      locadexVersion: JSON.parse(fs.readFileSync(fromPackageRoot('package.json'), 'utf8')).version,
      workingDirectory: cwd,
      transport: options.mcpTransport,
      tempDirectory: this.tempDir,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      ...options.metadata
    };
    fs.writeFileSync(
      this.metadataFilePath,
      JSON.stringify(metadata, null, 2)
    );

    logger.debugMessage(`Created metadata.json at: ${this.metadataFilePath}`);

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

  getMetadataFilePath(): string {
    return this.metadataFilePath;
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

export function configureAgent(options: { 
  mcpTransport: 'sse' | 'stdio';
  metadata?: Partial<LocadexMetadata>;
}, manager?: LocadexManager) {
  // If no manager is provided, create a new one
  if (!manager) {
    manager = new LocadexManager(options);
    logger.debugMessage(`Configure agent called with no manager. Creating new manager.`);
  }

  // Create agent
  const agent = manager.createAgent();

  process.on('beforeExit', () => {
    manager.cleanup();
  });

  return {
    agent,
    filesStateFilePath: manager.getFilesStateFilePath(),
    metadataFilePath: manager.getMetadataFilePath(),
  };
}
