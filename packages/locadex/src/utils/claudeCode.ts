import { spawn } from 'node:child_process';
import { ClaudeSDKMessage } from '../types/claude-sdk.js';
import { guides } from '../mcp/tools/guides.js';
import { logger } from '../logging/logger.js';
import { posthog } from '../telemetry.js';
import { LocadexManager } from './locadexManager.js';
import { getSessionId } from './session.js';
import * as Sentry from '@sentry/node';

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

const DISALLOWED_TOOLS = ['NotebookEdit', 'WebFetch', 'WebSearch'];

// Legacy function for backward compatibility
export const killAllClaudeProcesses = () => {
  // No-op since we now use AbortController
};

export class ClaudeCodeRunner {
  private id: string;
  private sessionId: string = '';
  private mcpConfig: string | undefined;
  private manager: LocadexManager;
  private changes: string[] = [];

  constructor(
    manager: LocadexManager,
    private options: {
      id: string;
      apiKey?: string;
      mcpConfig?: string;
    }
  ) {
    this.manager = manager;
    this.id = options.id;
    this.mcpConfig = options.mcpConfig;

    // Ensure API key is set
    if (!process.env.ANTHROPIC_API_KEY && !this.options.apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable or apiKey option is required'
      );
    }

    // AbortController handles cleanup automatically
  }

  getSessionId(): string {
    return this.sessionId;
  }

  async run(
    options: ClaudeCodeOptions,
    obs: ClaudeCodeObservation,
    controller: AbortController
  ): Promise<string> {
    this.changes = [];
    return Sentry.startSpan(
      {
        name: 'claude-code-exec',
        op: 'claude-code.exec',
        attributes: {
          'process.command': 'claude',
        },
      },
      () =>
        new Promise((resolve, reject) => {
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
          logger.debugMessage(
            `[${this.id}] Spawning Claude Code with additional args: ${JSON.stringify(
              {
                maxTurns: options.maxTurns,
                sessionId: options.sessionId,
                mcpConfig: this.mcpConfig,
                additionalAllowedTools: options.additionalAllowedTools,
              },
              null,
              2
            )}`
          );

          const claude = spawn('claude', args, {
            stdio: ['inherit', 'pipe', 'pipe'],
            env,
            signal: controller.signal,
          });

          logger.debugMessage(`[${this.id}] Spawned claude code process`);

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
                  logger.debugMessage(`[${this.id}] ${line}`);
                  const outputData: ClaudeSDKMessage = JSON.parse(line);
                  this.handleSDKOutput(outputData, obs);
                } catch (error) {
                  logger.debugMessage(
                    `[${this.id}] Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`
                  );
                }
              }
            }
          });

          claude.stderr?.on('data', (data) => {
            logger.debugMessage(`[${this.id}] ${data.toString().trim()}`);
          });

          claude.on('close', (code) => {
            if (code === 0) {
              resolve(output.trim());
            } else {
              logger.debugMessage(
                `[${this.id}] Claude Code exited with code ${code}: ${errorOutput}`
              );
              reject(
                new Error(
                  `[${this.id}] Claude Code exited with code ${code}: ${errorOutput}`
                )
              );
            }
          });

          claude.on('error', (error) => {
            // Check if this is an AbortError
            if (error.name === 'AbortError') {
              logger.debugMessage(
                `[${this.id}] Claude Code process was aborted`
              );
              reject(new Error(`[${this.id}] Claude Code process was aborted`));
            } else {
              logger.debugMessage(
                `[${this.id}] failed to run Claude Code: ${error.message}`
              );
              reject(
                new Error(
                  `[${this.id}] failed to run Claude Code: ${error.message}`
                )
              );
            }
          });
        })
    );
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
              distinctId: getSessionId(),
              event: 'tool_used',
              properties: {
                tool: c.name,
              },
            });
          }
        }
      });
      if (text.length > 0) {
        logger.verboseMessage(`[${this.id}] ${text.join('').trim()}`);
      }
      if (toolUses.length > 0) {
        logger.debugMessage(`[${this.id}] used tools: ${toolUses.join(', ')}`);
      }
      this.manager.stats.updateStats({
        newToolCalls: toolUses.length,
        newInputTokens: outputData.message.usage.input_tokens,
        newOutputTokens: outputData.message.usage.output_tokens,
        newCachedInputTokens:
          outputData.message.usage.cache_read_input_tokens ?? 0,
      });
    } else if (outputData.type === 'result') {
      if (!outputData.is_error) {
        logger.verboseMessage(
          `[${this.id}] finished task.\nCost: $${Number(outputData.cost_usd).toFixed(2)}\nDuration: ${
            Number(outputData.duration_ms) / 1000
          }s`
        );
      } else {
        logger.verboseMessage(
          `[${this.id}] finished task with error: ${outputData.subtype}\nCost: $${outputData.cost_usd}\nDuration: ${
            Number(outputData.duration_ms) / 1000
          }s`
        );
      }
      if (outputData.subtype === 'success') {
        this.changes.push(outputData.result);
      }
      this.manager.stats.updateStats({
        newCost: Number(outputData.cost_usd),
        newWallDuration: Number(outputData.duration_ms),
        newApiDuration: Number(outputData.duration_api_ms),
        newTurns: Number(outputData.num_turns),
      });
    } else if (outputData.type === 'system') {
      if (outputData.subtype === 'init') {
        this.sessionId = outputData.session_id;
      }
    }
  }

  generateReport(): string {
    return this.changes.join('\n');
  }
}
