import { spawn } from 'node:child_process';
import { ClaudeSDKMessage } from '../types/claude-sdk.js';
import { guides } from '../mcp/tools/guides.js';
import { SpinnerResult } from '@clack/prompts';
import { logger } from '../logging/logger.js';
import { posthog } from '../telemetry.js';
import { LocadexManager } from './agentManager.js';

export interface ClaudeCodeOptions {
  additionalSystemPrompt?: string;
  prompt: string;
  additionalAllowedTools?: string[];
  maxTurns?: number;
  sessionId?: string;
}

export interface ClaudeCodeObservation {}

const DEFAULT_ALLOWED_TOOLS = [
  'mcp__locadex__fetch-docs',
  'mcp__locadex__list-docs',
  'Bash',
  'Edit',
  'MultiEdit',
  'Write',
].concat(guides.map((guide) => `mcp__locadex__${guide.id}`));
// .concat(Object.keys(fileManagerTools).map((key) => `mcp__locadex__${key}`));

const DISALLOWED_TOOLS = ['NotebookEdit', 'WebFetch', 'WebSearch'];

// Global tracking of all Claude processes
const activeClaudeProcesses = new Set<any>();

// Setup global process termination handlers once
let handlersSetup = false;
const setupProcessHandlers = () => {
  if (handlersSetup) return;
  handlersSetup = true;

  const killAllClaudeProcesses = () => {
    activeClaudeProcesses.forEach((proc) => {
      if (!proc.killed) {
        proc.kill('SIGTERM');
      }
    });
    activeClaudeProcesses.clear();
  };

  process.on('SIGINT', killAllClaudeProcesses);
  process.on('SIGTERM', killAllClaudeProcesses);
};

export class ClaudeCodeRunner {
  private sessionId: string = '';
  private mcpConfig: string | undefined;
  private manager: LocadexManager;

  constructor(
    manager: LocadexManager,
    private options: {
      apiKey?: string;
      mcpConfig?: string;
    } = {}
  ) {
    this.manager = manager;
    this.mcpConfig = options.mcpConfig;

    // Ensure API key is set
    if (!process.env.ANTHROPIC_API_KEY && !this.options.apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable or apiKey option is required'
      );
    }

    // Setup global process handlers
    setupProcessHandlers();
  }

  getSessionId(): string {
    return this.sessionId;
  }

  async run(
    options: ClaudeCodeOptions,
    obs: ClaudeCodeObservation
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ['-p', options.prompt];

      if (options.additionalSystemPrompt) {
        args.push('--append-system-prompt', options.additionalSystemPrompt);
      }

      args.push('--output-format', 'stream-json');
      args.push('--verbose');
      if (options.sessionId) {
        args.push('--resume', options.sessionId);
      }

      if (this.mcpConfig) {
        args.push('--mcp-config', this.mcpConfig);
      }

      args.push(
        '--allowedTools',
        [
          ...DEFAULT_ALLOWED_TOOLS,
          ...(options?.additionalAllowedTools || []),
        ].join(',')
      );

      args.push('--disallowedTools', DISALLOWED_TOOLS.join(','));

      if (options.maxTurns) {
        args.push('--max-turns', options.maxTurns.toString());
      }

      const env = { ...process.env };
      if (this.options.apiKey) {
        env.ANTHROPIC_API_KEY = this.options.apiKey;
      }

      const claude = spawn('npx', ['claude', ...args], {
        stdio: ['inherit', 'pipe', 'pipe'],
        env,
      });

      activeClaudeProcesses.add(claude);

      const output = '';
      const errorOutput = '';

      let buffer = '';
      claude.stdout?.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');

        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              logger.verboseMessage(line);
              const outputData: ClaudeSDKMessage = JSON.parse(line);
              this.handleSDKOutput(outputData, obs);
            } catch (error) {
              logger.verboseMessage(
                `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }
      });

      claude.stderr?.on('data', () => {
        logger.warning('An error occurred while running Claude Code');
      });

      claude.on('close', (code) => {
        activeClaudeProcesses.delete(claude);
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(
            new Error(`Claude Code exited with code ${code}: ${errorOutput}`)
          );
        }
      });

      claude.on('error', (error) => {
        activeClaudeProcesses.delete(claude);
        reject(new Error(`Failed to run Claude Code: ${error.message}`));
      });
    });
  }

  private handleSDKOutput(
    outputData: ClaudeSDKMessage,
    obs: ClaudeCodeObservation
  ) {
    if (outputData.type === 'assistant') {
      const text: string[] = [];
      const toolUses: string[] = [];
      outputData.message.content.forEach((c) => {
        if (c.type === 'text') {
          text.push(c.text);
        }
        if (c.type === 'tool_use') {
          toolUses.push(c.name);
          if (c.name.startsWith('mcp__locadex__')) {
            posthog.capture({
              distinctId: 'anonymous',
              event: 'tool_used',
              properties: {
                tool: c.name,
              },
            });
          }
        }
      });
      if (text.length > 0) {
        logger.verboseMessage(text.join('').trim());
      }
      if (toolUses.length > 0) {
        logger.verboseMessage(`Used tools: ${toolUses.join(', ')}`);
      }
      this.manager.stats.updateStats({
        newToolCalls: toolUses.length,
      });
    } else if (outputData.type === 'result') {
      if (!outputData.is_error) {
        logger.verboseMessage(
          `Claude Code finished\nCost: $${Number(outputData.cost_usd).toFixed(2)}\nDuration: ${
            Number(outputData.duration_ms) / 1000
          }s`
        );
      } else {
        logger.verboseMessage(
          `Claude Code finished with error: ${outputData.subtype}\nCost: $${outputData.cost_usd}\nDuration: ${
            Number(outputData.duration_ms) / 1000
          }s`
        );
      }
      this.manager.stats.updateStats({
        newCost: Number(outputData.cost_usd),
        newWallDuration: Number(outputData.duration_ms),
        newApiDuration: Number(outputData.duration_api_ms),
      });
    } else if (outputData.type === 'system') {
      if (outputData.subtype === 'init') {
        this.sessionId = outputData.session_id;
      }
    }
  }
}
