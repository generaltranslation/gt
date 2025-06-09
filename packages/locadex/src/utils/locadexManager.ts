import { ClaudeCodeRunner, killAllClaudeProcesses } from './claudeCode.js';
import { fromPackageRoot } from './getPaths.js';
import fs from 'node:fs';
import path from 'node:path';
import { FileEntry } from './getFiles.js';
import { logger } from '../logging/logger.js';
import { addToGitIgnore } from './fs/writeFiles.js';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { setTimeout } from 'node:timers';
import { AgentStats } from './stats.js';
import { CliOptions } from '../types/cli.js';

export interface LocadexMetadata {
  createdAt: string;
  locadexVersion: string;
  workingDirectory: string;
  projectName: string;
  transport: 'sse' | 'stdio';
  tempDirectory: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  logFile: string;
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
  private static instance: LocadexManager | undefined;
  private mcpProcess: ChildProcess | undefined;
  private mcpConfigPath: string;
  private filesStateFilePath: string;
  private metadataFilePath: string;
  private tempDir: string;
  private apiKey?: string;
  private maxConcurrency: number;
  private agentPool: Map<
    string,
    { agent: ClaudeCodeRunner; sessionId?: string; busy: boolean }
  >;
  private agentMutex = Promise.resolve();
  private agentsCleanedUp: boolean = false;
  stats: AgentStats;
  logFile: string;

  private constructor(options: {
    mcpTransport: 'sse' | 'stdio';
    apiKey?: string;
    metadata?: Partial<LocadexMetadata>;
    maxConcurrency?: number;
  }) {
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    this.maxConcurrency = options.maxConcurrency || 1;
    this.agentPool = new Map();
    this.stats = new AgentStats();

    const cwd = process.cwd();
    this.tempDir = path.resolve(cwd, '.locadex', Date.now().toString());
    fs.mkdirSync(this.tempDir, { recursive: true });

    addToGitIgnore(cwd, '.locadex');

    this.mcpConfigPath = path.resolve(this.tempDir, 'mcp.json');
    this.filesStateFilePath = path.resolve(this.tempDir, 'files-state.json');
    this.metadataFilePath = path.resolve(this.tempDir, 'metadata.json');
    this.logFile = path.resolve(this.tempDir, 'log.txt');

    // Create files-state.json
    const filesState: FileEntry[] = [];
    fs.writeFileSync(
      this.filesStateFilePath,
      JSON.stringify(filesState, null, 2)
    );

    // Create metadata.json
    const metadata: LocadexMetadata = {
      createdAt: new Date().toISOString(),
      locadexVersion: JSON.parse(
        fs.readFileSync(fromPackageRoot('package.json'), 'utf8')
      ).version,
      workingDirectory: cwd,
      projectName: path.basename(cwd),
      transport: options.mcpTransport,
      tempDirectory: this.tempDir,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      logFile: this.logFile,
      ...options.metadata,
    };
    fs.writeFileSync(this.metadataFilePath, JSON.stringify(metadata, null, 2));

    if (options.mcpTransport === 'stdio') {
      mcpStdioConfig.mcpServers.locadex.env = {
        LOCADEX_FILES_STATE_FILE_PATH: this.filesStateFilePath,
        LOCADEX_LOG_FILE_PATH: this.logFile,
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
          ...process.env,
          LOCADEX_FILES_STATE_FILE_PATH: this.filesStateFilePath,
          LOCADEX_VERBOSE: logger.verbose ? 'true' : 'false',
          LOCADEX_DEBUG: logger.debug ? 'true' : 'false',
          LOCADEX_LOG_FILE_PATH: this.logFile,
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

      this.mcpConfigPath = fromPackageRoot('.locadex-mcp.json');
    }
    process.on('beforeExit', () => {
      this.cleanup();
    });
  }

  static getInstance(): LocadexManager {
    if (!LocadexManager.instance) {
      throw new Error('LocadexManager not initialized');
    }
    return LocadexManager.instance;
  }

  static initialize(options: {
    mcpTransport: 'sse' | 'stdio';
    apiKey?: string;
    metadata?: Partial<LocadexMetadata>;
    maxConcurrency?: number;
    cliOptions?: CliOptions;
  }): void {
    if (!LocadexManager.instance) {
      LocadexManager.instance = new LocadexManager(options);
      if (options.cliOptions) {
        logger.initialize(options.cliOptions, LocadexManager.instance.logFile);
      }
    }
  }

  static reset(): void {
    if (LocadexManager.instance) {
      LocadexManager.instance.cleanup();
      LocadexManager.instance = undefined;
    }
  }

  createAgent(id: string): ClaudeCodeRunner {
    return new ClaudeCodeRunner(this, {
      apiKey: this.apiKey,
      mcpConfig: this.mcpConfigPath,
      id,
    });
  }

  createAgentPool(): void {
    if (this.agentPool.size === 0) {
      for (let i = 0; i < this.maxConcurrency; i++) {
        const agentId = `claude_task_agent_${i + 1}`;
        this.agentPool.set(agentId, {
          agent: this.createAgent(agentId),
          sessionId: undefined,
          busy: false,
        });
      }
    }
  }

  async getAvailableAgent(): Promise<{
    id: string;
    agent: ClaudeCodeRunner;
    sessionId?: string;
  } | null> {
    return new Promise((resolve) => {
      this.agentMutex = this.agentMutex.then(() => {
        for (const [id, agentData] of this.agentPool) {
          if (!agentData.busy) {
            agentData.busy = true;
            resolve({
              id,
              agent: agentData.agent,
              sessionId: agentData.sessionId,
            });
            return;
          }
        }
        resolve(null);
      });
    });
  }

  markAgentBusy(agentId: string): void {
    const agentData = this.agentPool.get(agentId);
    if (agentData) {
      agentData.busy = true;
    }
  }

  markAgentFree(agentId: string, sessionId?: string): void {
    const agentData = this.agentPool.get(agentId);
    if (agentData) {
      agentData.busy = false;
      if (sessionId) {
        agentData.sessionId = sessionId;
      }
    }
  }

  getAgentPool(): Map<
    string,
    { agent: ClaudeCodeRunner; sessionId?: string; busy: boolean }
  > {
    return this.agentPool;
  }

  getMaxConcurrency(): number {
    return this.maxConcurrency;
  }

  cleanupAgents(): void {
    if (this.agentsCleanedUp) {
      return; // Already cleaned up
    }

    logger.debugMessage('Cleaning up all Claude Code agents and processes');

    // Mark all agents as free
    for (const agentData of this.agentPool.values()) {
      agentData.busy = false;
    }

    // Kill all active Claude Code processes
    killAllClaudeProcesses();

    // Clear the agent pool
    this.agentPool.clear();

    this.agentsCleanedUp = true;
  }

  getFilesStateFilePath(): string {
    return this.filesStateFilePath;
  }

  getMetadataFilePath(): string {
    return this.metadataFilePath;
  }

  cleanup(): void {
    // Clean up agents first (if not already done)
    this.cleanupAgents();

    // Clean up MCP process
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
