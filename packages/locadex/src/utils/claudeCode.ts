import { spawn } from 'node:child_process';
import { ClaudeSDKMessage } from '../types/claude-sdk.js';
import { guides } from '../mcp/tools/guides.js';
import { logger } from '../logging/logger.js';
import { posthog } from '../telemetry.js';
import { LocadexManager } from './locadexManager.js';
import { getSessionId } from './session.js';
import * as Sentry from '@sentry/node';
import {
  TimeoutError,
  UserAbortError,
  AgentProcessError,
  AgentSpawnError,
} from './errors.js';

export type ClaudeRunOptions = {
  additionalSystemPrompt?: string;
  additionalAllowedTools?: string[];
  maxTurns?: number; // Hard limit on the number of turns per Claude Code call

  // required
  timeoutSec: number; // Timeout per .run() call
  maxRetries: number; // Max number of retries per .run() call
};

export type ClaudeRunnerOptions = {
  softTurnLimit?: number; // Soft limit on the number of turns per Claude runner
};

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

/**
 * Wraps a promise with a timeout mechanism that can abort the underlying operation
 */
async function withTimeout<T>(
  promiseFactory: (abortController: AbortController) => Promise<T>,
  timeoutSec: number,
  timeoutMessage?: string
): Promise<T> {
  const timeoutController = new AbortController();

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = global.setTimeout(() => {
      timeoutController.abort();
      reject(
        new TimeoutError(
          timeoutMessage || `Operation timed out after ${timeoutSec}s`,
          timeoutSec
        )
      );
    }, timeoutSec * 1000);

    // Clear timeout if the operation completes or is aborted
    timeoutController.signal.addEventListener('abort', () => {
      global.clearTimeout(timeoutId);
    });
  });

  const promise = promiseFactory(timeoutController);
  return Promise.race([promise, timeoutPromise]);
}

/**
 * Retries an async operation with exponential backoff
 * Retries on TimeoutError but not on UserAbortError
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 1,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on user aborts - these are intentional
      if (
        lastError instanceof UserAbortError ||
        lastError.name === 'AbortError'
      ) {
        throw lastError;
      }

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        throw lastError;
      }

      const delay = baseDelayMs * Math.pow(2, attempt);

      // Log different messages for different error types
      if (lastError instanceof TimeoutError) {
        logger.debugMessage(
          `Claude Code operation timed out (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms: ${lastError.message}`
        );
      } else {
        logger.debugMessage(
          `Claude Code operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms: ${lastError.message}`
        );
      }

      await new Promise((resolve) => global.setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

export class ClaudeCodeRunner {
  private id: string;
  private sessionId: string | undefined;
  private mcpConfig: string | undefined;
  private manager: LocadexManager;
  private changes: string[] = [];
  private controller: AbortController;
  private softTurnLimit: number;
  private turns: number = 0;

  private stats: {
    cost: number;
    wallDuration: number;
    apiDuration: number;
    turns: number;
    mcpToolCalls: number;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
  };

  constructor(
    manager: LocadexManager,
    controller: AbortController,
    private options: {
      id: string;
      apiKey: string;
      mcpConfig: string;
      softTurnLimit: number;
    }
  ) {
    this.manager = manager;
    this.id = options.id;
    this.mcpConfig = options.mcpConfig;
    this.controller = controller;
    this.softTurnLimit = options.softTurnLimit;

    this.stats = {
      cost: 0,
      wallDuration: 0,
      apiDuration: 0,
      turns: 0,
      mcpToolCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
    };

    // Ensure API key is set
    if (!process.env.ANTHROPIC_API_KEY && !this.options.apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable or apiKey option is required'
      );
    }
  }

  getSessionId(): string | undefined {
    return this.sessionId;
  }
  reset() {
    this.sessionId = undefined;
    this.turns = 0;
    this.resetStats();
  }
  resetStats() {
    this.stats = {
      cost: 0,
      wallDuration: 0,
      apiDuration: 0,
      turns: 0,
      mcpToolCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
    };
  }
  aggregateStats() {
    this.manager.stats.updateStats({
      newCost: this.stats.cost,
      newWallDuration: this.stats.wallDuration,
      newApiDuration: this.stats.apiDuration,
      newTurns: this.stats.turns,
      newToolCalls: this.stats.mcpToolCalls,
      newInputTokens: this.stats.inputTokens,
      newOutputTokens: this.stats.outputTokens,
      newCachedInputTokens: this.stats.cachedInputTokens,
    });
  }

  async run(
    prompt: string,
    options: ClaudeRunOptions,
    _obs: ClaudeCodeObservation
  ): Promise<string> {
    this.changes = [];
    return withRetry(
      () =>
        Sentry.startSpan(
          {
            name: 'claude-code-exec',
            op: 'claude-code.exec',
            attributes: {
              'process.command': 'claude',
            },
          },
          () =>
            withTimeout(
              (timeoutController: AbortController) =>
                new Promise<string>((resolve, reject) => {
                  const args = ['-p', prompt];

                  if (options.additionalSystemPrompt) {
                    args.push(
                      '--append-system-prompt',
                      options.additionalSystemPrompt
                    );
                  }

                  args.push('--output-format', 'stream-json');
                  args.push('--verbose');

                  if (this.sessionId && this.turns < this.softTurnLimit) {
                    args.push('--resume', this.sessionId);
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
                  env.ANTHROPIC_API_KEY = this.options.apiKey;
                  logger.debugMessage(
                    `[${this.id}] Spawning Claude Code with additional args: ${JSON.stringify(
                      {
                        maxTurns: options.maxTurns,
                        softTurnLimit: this.softTurnLimit,
                        timeoutSec: options.timeoutSec,
                        maxRetries: options.maxRetries,
                        sessionId: this.sessionId,
                        mcpConfig: this.mcpConfig,
                        additionalAllowedTools: options.additionalAllowedTools,
                      },
                      null,
                      2
                    )}. API key is ${this.options.apiKey ? 'set' : 'not set'}`
                  );

                  // Create a combined abort controller that triggers on either user abort or timeout
                  const combinedController = new AbortController();

                  const abortHandler = () => {
                    combinedController.abort();
                  };

                  this.controller.signal.addEventListener(
                    'abort',
                    abortHandler
                  );
                  timeoutController.signal.addEventListener(
                    'abort',
                    abortHandler
                  );

                  const claude = spawn('claude', args, {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    env,
                    signal: combinedController.signal,
                  });

                  logger.debugMessage(
                    `[${this.id}] Spawned claude code process`
                  );

                  const output = {
                    error: '',
                  };

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
                          const result = this.handleSDKOutput(outputData, _obs);
                          if (!result.success) {
                            output.error = result.error ?? '';
                          }
                        } catch (error) {
                          logger.debugMessage(
                            `[${this.id}] Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`
                          );
                        }
                      }
                    }
                  });

                  claude.stderr?.on('data', (data) => {
                    logger.debugMessage(
                      `[${this.id}] ${data.toString().trim()}`
                    );
                  });

                  claude.on('close', (code, signal) => {
                    // Clean up event listeners
                    this.controller.signal.removeEventListener(
                      'abort',
                      abortHandler
                    );
                    timeoutController.signal.removeEventListener(
                      'abort',
                      abortHandler
                    );

                    if (signal === 'SIGTERM' || signal === 'SIGKILL') {
                      // Process was terminated due to abort
                      if (this.controller.signal.aborted) {
                        reject(
                          new UserAbortError(
                            'Claude Code process was aborted by user'
                          )
                        );
                      } else if (timeoutController.signal.aborted) {
                        reject(
                          new TimeoutError(
                            `Claude Code process timed out after ${options.timeoutSec}s`,
                            options.timeoutSec
                          )
                        );
                      } else {
                        reject(
                          new AgentProcessError(
                            `[${this.id}] Claude Code process was terminated with signal ${signal}`,
                            code ?? undefined
                          )
                        );
                      }
                    } else if (code === 0) {
                      logger.debugMessage(
                        `[${this.id}] Claude Code exited with code ${code}`
                      );
                      resolve('');
                    } else {
                      logger.debugMessage(
                        `[${this.id}] Claude Code exited with code ${code}: ${output.error}`
                      );
                      reject(
                        new AgentProcessError(
                          `[${this.id}] Claude Code exited with code ${code}: ${output.error}`,
                          code ?? undefined
                        )
                      );
                    }
                  });

                  claude.on('error', (error) => {
                    // Clean up event listeners
                    this.controller.signal.removeEventListener(
                      'abort',
                      abortHandler
                    );
                    timeoutController.signal.removeEventListener(
                      'abort',
                      abortHandler
                    );

                    if (error.name === 'AbortError') {
                      // Determine if this was a user abort or timeout abort
                      if (this.controller.signal.aborted) {
                        reject(
                          new UserAbortError(
                            'Claude Code process was aborted by user'
                          )
                        );
                      } else if (timeoutController.signal.aborted) {
                        reject(
                          new TimeoutError(
                            `Claude Code process timed out after ${options.timeoutSec}s`,
                            options.timeoutSec
                          )
                        );
                      } else {
                        reject(
                          new UserAbortError('Claude Code process was aborted')
                        );
                      }
                    } else {
                      logger.debugMessage(
                        `[${this.id}] failed to run Claude Code: ${error.message}`
                      );
                      reject(
                        new AgentSpawnError(
                          `[${this.id}] failed to run Claude Code: ${error.message}`,
                          error
                        )
                      );
                    }
                  });
                }),
              options.timeoutSec,
              `Claude Code operation timed out after ${options.timeoutSec}s`
            )
        ),
      options.maxRetries
    );
  }

  private handleSDKOutput(
    outputData: ClaudeSDKMessage,
    _obs: ClaudeCodeObservation
  ): { success: boolean; error?: string } {
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
      this.stats.mcpToolCalls += toolUses.length;
      this.stats.inputTokens += outputData.message.usage.input_tokens;
      this.stats.outputTokens += outputData.message.usage.output_tokens;
      this.stats.cachedInputTokens +=
        outputData.message.usage.cache_read_input_tokens ?? 0;
    } else if (outputData.type === 'result') {
      this.stats.cost = outputData.total_cost_usd;
      this.stats.wallDuration = outputData.duration_ms;
      this.stats.apiDuration = outputData.duration_api_ms;
      this.stats.turns = outputData.num_turns;
      this.turns = outputData.num_turns;
      if (!outputData.is_error) {
        logger.verboseMessage(
          `[${this.id}] finished task.\nCost: $${outputData.total_cost_usd.toFixed(2)}\nDuration: ${
            outputData.duration_ms / 1000
          }s`
        );
      } else {
        logger.verboseMessage(
          `[${this.id}] finished task with error: ${outputData.subtype}\nCost: $${outputData.total_cost_usd}\nDuration: ${
            outputData.duration_ms / 1000
          }s`
        );
        return {
          success: false,
          error: outputData.subtype,
        };
      }
      if (outputData.subtype === 'success') {
        this.changes.push(outputData.result);
      }
    } else if (outputData.type === 'system') {
      if (outputData.subtype === 'init') {
        this.sessionId = outputData.session_id;
      }
    }
    return {
      success: true,
    };
  }

  generateReport(): string {
    return this.changes.join('\n');
  }
}
