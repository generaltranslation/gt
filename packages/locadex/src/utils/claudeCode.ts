import { spawn } from 'node:child_process';
import {
  logMessage,
  logStep,
  logSuccess,
  logWarning,
} from '../logging/console.js';
import { ClaudeSDKMessage } from '../types/claude-sdk.js';
import { constructResultInfo } from '../logging/constructInfo.js';
import { guides } from '../tools/guides.js';
import { SpinnerResult } from '@clack/prompts';

export interface ClaudeCodeOptions {
  additionalSystemPrompt?: string;
  prompt: string;
  additionalAllowedTools?: string[];
  maxTurns?: number;
  sessionId?: string;
}

export interface ClaudeCodeObservation {
  spinner: SpinnerResult;
}

const DEFAULT_ALLOWED_TOOLS = [
  'mcp__locadex__listFiles',
  'mcp__locadex__fetch-docs',
  'mcp__locadex__list-docs',
  'Bash',
  'Edit',
  'MultiEdit',
  'Write',
].concat(guides.map((guide) => `mcp__locadex__${guide.id}`));

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
  private verbose: boolean;
  private mcpConfig: string | undefined;

  constructor(
    private options: {
      apiKey?: string;
      verbose?: boolean;
      mcpConfig?: string;
    } = {}
  ) {
    this.verbose = options.verbose ?? false;
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

      const claude = spawn('claude', args, {
        stdio: ['inherit', 'pipe', 'pipe'],
        env,
      });

      activeClaudeProcesses.add(claude);

      let output = '';
      let errorOutput = '';

      claude.stdout?.on('data', (data) => {
        const lines = data.toString().trim().split('\n');

        for (const line of lines) {
          if (line.trim()) {
            if (this.verbose) {
              logMessage(line);
            }
            try {
              const outputData: ClaudeSDKMessage = JSON.parse(line);
              if (outputData.type === 'assistant') {
                const text: string[] = [];
                const toolUses: string[] = [];
                outputData.message.content.forEach((c) => {
                  if (c.type === 'text') {
                    text.push(c.text);
                  }
                  if (c.type === 'tool_use') {
                    toolUses.push(c.name);
                  }
                });
                if (text.length > 0) {
                  logStep(text.join('').trim());
                }
                if (toolUses.length > 0) {
                  logMessage(`Used tools: ${toolUses.join(', ')}`);
                }
              } else if (outputData.type === 'result') {
                const resultInfo = constructResultInfo(outputData);
                if (resultInfo) {
                  logSuccess(resultInfo);
                }
              } else if (outputData.type === 'system') {
                if (outputData.subtype === 'init') {
                  obs.spinner.stop('Locadex initialized');
                  this.sessionId = outputData.session_id;
                }
              }
            } catch (error) {}
          }
        }
      });

      claude.stderr?.on('data', () => {
        logWarning('An error occurred while running Claude Code');
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
}
