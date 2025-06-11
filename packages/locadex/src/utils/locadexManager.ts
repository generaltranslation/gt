import { ClaudeCodeRunner, killAllClaudeProcesses } from './claudeCode.js';
import { fromPackageRoot } from './getPaths.js';
import fs from 'node:fs';
import path from 'node:path';
import { FileEntry } from './dag/getFiles.js';
import { logger } from '../logging/logger.js';
import { addToGitIgnore } from './fs/writeFiles.js';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { setTimeout } from 'node:timers';
import { AgentStats } from './stats.js';
import { CliOptions, LocadexConfig } from '../types/cli.js';
import { findAvailablePort } from '../mcp/getPort.js';
import { createConfig, getConfig } from './config.js';
import { gracefulShutdown, exit } from './shutdown.js';
import { LOCKFILE_NAME } from './lockfile.js';

export interface LocadexRunMetadata {
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
  batchSize: number;
  maxConcurrency: number;
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
const mcpSseConfig = {
  mcpServers: {
    locadex: {
      type: 'sse',
      url: 'http://localhost:8888/sse',
    },
  },
};

export class LocadexManager {
  private static instance: LocadexManager | undefined;
  private mcpProcess: ChildProcess | undefined;
  private mcpTransport: 'sse' | 'stdio';
  private mcpConfigPath: string;
  private filesStateFilePath: string;
  private metadataFilePath: string;
  private lockFilePath: string;
  private workingDir: string;
  private locadexDirectory: string;
  private apiKey: string;
  private maxConcurrency: number;
  private batchSize: number;
  private agentPool: Map<
    string,
    { agent: ClaudeCodeRunner; sessionId?: string; busy: boolean }
  >;
  private agentAbortController: AbortController;
  private mcpAbortController: AbortController;
  private agentMutex = Promise.resolve();
  private config: LocadexConfig;
  stats: AgentStats;
  logFile: string;

  private constructor(params: {
    mcpTransport: 'sse' | 'stdio';
    apiKey: string;
    metadata: Partial<LocadexRunMetadata>;
    options: Partial<LocadexConfig>;
  }) {
    this.apiKey = params.apiKey;
    this.agentPool = new Map();
    this.stats = new AgentStats();
    this.mcpTransport = params.mcpTransport;
    this.agentAbortController = new AbortController();
    this.mcpAbortController = new AbortController();

    const cwd = process.cwd();
    this.locadexDirectory = path.resolve(cwd, '.locadex');
    this.workingDir = path.resolve(
      this.locadexDirectory,
      'runs',
      Date.now().toString()
    );
    fs.mkdirSync(this.workingDir, { recursive: true });

    this.config = getConfig(this.locadexDirectory, params.options);

    createConfig(this.locadexDirectory, {
      batchSize: this.config.batchSize,
      maxConcurrency: this.config.maxConcurrency,
      matchingFiles: this.config.matchingFiles,
      matchingExtensions: this.config.matchingExtensions,
    });

    addToGitIgnore(cwd, '.locadex/runs');

    this.maxConcurrency = this.config.maxConcurrency;
    this.batchSize = this.config.batchSize;
    this.mcpConfigPath = path.resolve(this.workingDir, 'mcp.json');
    this.filesStateFilePath = path.resolve(this.workingDir, 'files-state.json');
    this.metadataFilePath = path.resolve(this.workingDir, 'metadata.json');
    this.logFile = path.resolve(this.workingDir, 'log.txt');
    this.lockFilePath = path.resolve(this.locadexDirectory, LOCKFILE_NAME);

    // Create files-state.json
    const filesState: FileEntry[] = [];
    fs.writeFileSync(
      this.filesStateFilePath,
      JSON.stringify(filesState, null, 2)
    );

    // Create metadata.json
    const metadata: LocadexRunMetadata = {
      createdAt: new Date().toISOString(),
      locadexVersion: JSON.parse(
        fs.readFileSync(fromPackageRoot('package.json'), 'utf8')
      ).version,
      workingDirectory: cwd,
      projectName: path.basename(cwd),
      transport: params.mcpTransport,
      tempDirectory: this.workingDir,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      logFile: this.logFile,
      batchSize: this.config.batchSize,
      maxConcurrency: this.config.maxConcurrency,
      ...params.metadata,
    };
    fs.writeFileSync(this.metadataFilePath, JSON.stringify(metadata, null, 2));

    // Register cleanup with graceful shutdown
    gracefulShutdown.addHandler({
      name: 'locadex-manager-cleanup',
      handler: () => this.cleanup(),
      timeout: 5000,
    });
  }

  async startMcpServer() {
    if (this.mcpTransport === 'stdio') {
      mcpStdioConfig.mcpServers.locadex.env = {
        LOCADEX_FILES_STATE_FILE_PATH: this.filesStateFilePath,
        LOCADEX_LOG_FILE_PATH: this.logFile,
      };
      fs.writeFileSync(
        this.mcpConfigPath,
        JSON.stringify(mcpStdioConfig, null, 2)
      );
    } else {
      // First, search for an available port
      const port = await findAvailablePort(8888);
      mcpSseConfig.mcpServers.locadex.url = `http://localhost:${port}/sse`;
      fs.writeFileSync(
        this.mcpConfigPath,
        JSON.stringify(mcpSseConfig, null, 2)
      );

      this.mcpProcess = spawn('node', [fromPackageRoot('dist/mcp-sse.js')], {
        env: {
          ...process.env,
          LOCADEX_FILES_STATE_FILE_PATH: this.filesStateFilePath,
          LOCADEX_VERBOSE: logger.verbose ? 'true' : 'false',
          LOCADEX_DEBUG: logger.debug ? 'true' : 'false',
          LOCADEX_LOG_FILE_PATH: this.logFile,
          PORT: port.toString(),
        },
        stdio: 'inherit',
        signal: this.mcpAbortController.signal,
      });

      this.mcpProcess.on('error', async (error) => {
        if (error.name === 'AbortError') {
          logger.debugMessage('MCP server was closed');
        } else {
          logger.error(`MCP server failed to start: ${error.message}`);
          await exit(1);
        }
      });

      this.mcpProcess.on('exit', async (code, signal) => {
        if (code !== 0 && code !== null) {
          logger.error(`MCP server exited with code ${code}`);
          await exit(code as 0 | 1);
        }
        if (signal) {
          logger.error(`MCP server was killed with signal ${signal}`);
          await exit(0);
        }
      });
    }
  }

  static getInstance(): LocadexManager {
    if (!LocadexManager.instance) {
      throw new Error('LocadexManager not initialized');
    }
    return LocadexManager.instance;
  }

  static initialize(params: {
    mcpTransport: 'sse' | 'stdio';
    apiKey: string;
    metadata: Partial<LocadexRunMetadata>;
    cliOptions: CliOptions;
    options: Partial<LocadexConfig>;
  }): void {
    if (!LocadexManager.instance) {
      LocadexManager.instance = new LocadexManager(params);
      logger.initialize(params.cliOptions, LocadexManager.instance.logFile);

      logger.debugMessage(
        `Locadex loaded with config: ${JSON.stringify(
          LocadexManager.instance.config,
          null,
          2
        )}`
      );
      LocadexManager.instance.startMcpServer();
    }
  }

  static reset(): void {
    if (LocadexManager.instance) {
      LocadexManager.instance.cleanup();
      LocadexManager.instance = undefined;
    }
  }

  createSingleAgent(id: string): ClaudeCodeRunner {
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
          agent: this.createSingleAgent(agentId),
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

  markAgentFree(agentId: string): void {
    const agentData = this.agentPool.get(agentId);
    if (agentData) {
      agentData.busy = false;
    }
  }

  getAgentPool(): Map<
    string,
    { agent: ClaudeCodeRunner; sessionId?: string; busy: boolean }
  > {
    return this.agentPool;
  }

  cleanupAgents(): void {
    logger.debugMessage('Cleaning up all Claude Code agents and processes');

    // Abort all active processes
    this.agentAbortController.abort();

    // Mark agents as free
    for (const agentData of this.agentPool.values()) {
      agentData.busy = false;
    }

    // Kill all active Claude Code processes (fallback)
    killAllClaudeProcesses();

    // Clear the agent pool
    this.agentPool.clear();
  }

  getFilesStateFilePath(): string {
    return this.filesStateFilePath;
  }
  getMetadataFilePath(): string {
    return this.metadataFilePath;
  }
  getMaxConcurrency(): number {
    return this.maxConcurrency;
  }
  getBatchSize(): number {
    return this.batchSize;
  }
  getConfig(): LocadexConfig {
    return this.config;
  }

  getLockFilePath(): string {
    return this.lockFilePath;
  }

  cleanup(): void {
    // Clean up agents first (if not already done)
    this.cleanupAgents();

    // Clean up MCP process using abort controller
    if (this.mcpProcess && !this.mcpProcess.killed) {
      logger.debugMessage('Terminating MCP process via abort controller');
      this.mcpAbortController.abort();

      // Give the process a moment to handle the abort signal gracefully
      setTimeout(() => {
        if (this.mcpProcess && !this.mcpProcess.killed) {
          logger.debugMessage('Force killing MCP process as fallback');
          this.mcpProcess.kill('SIGTERM');
        }
      }, 1000);
    }
  }

  getWorkingDir(): string {
    return this.workingDir;
  }

  getAgentAbortController(): AbortController {
    return this.agentAbortController;
  }
}
