import { guides } from '../mcp/tools/guides.js';
import { logger } from '../logging/logger.js';
import { posthog } from '../telemetry.js';
import { LocadexManager } from './locadexManager.js';
import { getSessionId } from './session.js';
import * as Sentry from '@sentry/node';
import { TimeoutError, UserAbortError, AgentProcessError } from './errors.js';
import {
  query,
  type Options,
  type SDKMessage,
  type McpServerConfig,
} from '@anthropic-ai/claude-code';

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
  'mcp__locadex__validate-project',
  'Bash',
  'Edit',
  'MultiEdit',
  'Write',
].concat(guides.map((guide) => `mcp__locadex__${guide.id}`));

const DISALLOWED_TOOLS = ['NotebookEdit', 'WebFetch', 'WebSearch'];

export class ClaudeCodeRunner {
  private id: string;
  private sessionId: string | undefined;
  private mcpConfig: McpServerConfig | undefined;
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
      mcpConfig: McpServerConfig;
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
    this.aggregateStats();
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
    logger.verboseMessage(
      `[${this.id}] Aggregating stats.\nCost: $${this.stats.cost.toFixed(
        2
      )}\nDuration: ${this.stats.wallDuration / 1000}s`
    );
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

  /**
   * Wraps a promise with a timeout mechanism that can abort the underlying operation
   */
  private async withTimeout<T>(
    promiseFactory: (abortController: AbortController) => Promise<T>,
    timeoutSec: number,
    timeoutMessage?: string
  ): Promise<T> {
    const timeoutController = new AbortController();
    let timeoutId: ReturnType<typeof global.setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = global.setTimeout(() => {
        timeoutController.abort();
        reject(
          new TimeoutError(
            timeoutMessage || `Operation timed out after ${timeoutSec}s`,
            timeoutSec
          )
        );
      }, timeoutSec * 1000);
    });

    const promise = promiseFactory(timeoutController);
    return Promise.race([promise, timeoutPromise]).finally(() => {
      // Clear the timeout regardless of how the promise resolves
      global.clearTimeout(timeoutId);
    });
  }

  /**
   * Retries an async operation with exponential backoff
   * Retries on TimeoutError but not on UserAbortError
   */
  private async withRetry<T>(
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
          logger.debugMessage(`Claude Code operation aborted by user`);
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
          // reset the session id
          this.reset();
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

  async run(
    prompt: string,
    options: ClaudeRunOptions,
    _obs: ClaudeCodeObservation
  ): Promise<string> {
    this.changes = [];
    return this.withRetry(
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
            this.withTimeout(
              async (timeoutController: AbortController) => {
                // Create a combined abort controller that triggers on either user abort or timeout
                const combinedController = new AbortController();

                const abortHandler = () => {
                  combinedController.abort();
                };

                this.controller.signal.addEventListener('abort', abortHandler);
                timeoutController.signal.addEventListener(
                  'abort',
                  abortHandler
                );

                try {
                  // Build query options
                  const queryOptions: Options = {
                    maxTurns: options.maxTurns,
                    allowedTools: [
                      ...DEFAULT_ALLOWED_TOOLS,
                      ...(options?.additionalAllowedTools || []),
                    ],
                    disallowedTools: DISALLOWED_TOOLS,
                  };

                  if (options.additionalSystemPrompt) {
                    queryOptions.appendSystemPrompt =
                      options.additionalSystemPrompt;
                  }

                  if (this.mcpConfig) {
                    queryOptions.mcpServers = {
                      locadex: this.mcpConfig,
                    };
                  }

                  if (this.sessionId && this.turns < this.softTurnLimit) {
                    queryOptions.resume = this.sessionId;
                  } else if (this.turns >= this.softTurnLimit) {
                    logger.debugMessage(
                      `[${this.id}] Resetting session id because of soft turn limit reached: ${this.turns} >= ${this.softTurnLimit}`
                    );
                    this.reset();
                  }

                  if (this.options.apiKey) {
                    process.env.ANTHROPIC_API_KEY = this.options.apiKey;
                  }

                  logger.debugMessage(
                    `[${this.id}] Running Claude Code SDK with options: ${JSON.stringify(
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
                    )}. API key is ${process.env.ANTHROPIC_API_KEY ? 'set' : 'not set'}`
                  );

                  try {
                    for await (const message of query({
                      prompt,
                      abortController: combinedController,
                      options: queryOptions,
                    })) {
                      const result = this.handleSDKOutput(message, _obs);
                      if (!result.success) {
                        throw new AgentProcessError(
                          `[${this.id}] Claude Code error: ${result.error}`,
                          undefined
                        );
                      }
                    }
                  } finally {
                    // pass
                  }

                  return '';
                } finally {
                  // Clean up event listeners
                  this.controller.signal.removeEventListener(
                    'abort',
                    abortHandler
                  );
                  timeoutController.signal.removeEventListener(
                    'abort',
                    abortHandler
                  );
                }
              },
              options.timeoutSec,
              `Claude Code operation timed out after ${options.timeoutSec}s`
            )
        ),
      options.maxRetries
    );
  }

  private handleSDKOutput(
    outputData: SDKMessage,
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
        logger.verboseMessage(`[${this.id}] finished task.`);
      } else {
        logger.verboseMessage(
          `[${this.id}] finished task with error: ${outputData.subtype}`
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
