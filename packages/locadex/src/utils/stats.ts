import { posthog } from '../telemetry.js';
import { getSessionId } from './session.js';
import * as Sentry from '@sentry/node';

export class AgentStats {
  private totalFiles: number = 0;
  private processedFiles: number = 0;
  private totalCost: number = 0;
  private totalToolCalls: number = 0;
  private totalApiDuration: number = 0;
  private totalWallDuration: number = 0;
  private startTime: number;
  private inputTokens: number = 0;
  private outputTokens: number = 0;
  private cachedInputTokens: number = 0;
  private turns: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  updateStats(stats: {
    newProcessedFiles?: number;
    newCost?: number;
    newToolCalls?: number;
    newApiDuration?: number;
    newWallDuration?: number;
    newInputTokens?: number;
    newOutputTokens?: number;
    newCachedInputTokens?: number;
    newTurns?: number;
  }) {
    if (stats.newProcessedFiles) {
      this.processedFiles += stats.newProcessedFiles;
    }
    if (stats.newCost) {
      this.totalCost += stats.newCost;
    }
    if (stats.newToolCalls) {
      this.totalToolCalls += stats.newToolCalls;
    }
    if (stats.newApiDuration) {
      this.totalApiDuration += stats.newApiDuration;
    }
    if (stats.newWallDuration) {
      this.totalWallDuration += stats.newWallDuration;
    }
    if (stats.newInputTokens) {
      this.inputTokens += stats.newInputTokens;
    }
    if (stats.newOutputTokens) {
      this.outputTokens += stats.newOutputTokens;
    }
    if (stats.newCachedInputTokens) {
      this.cachedInputTokens += stats.newCachedInputTokens;
    }
    if (stats.newTurns) {
      this.turns += stats.newTurns;
    }
  }

  getStats() {
    return {
      totalFiles: this.totalFiles,
      processedFiles: this.processedFiles,
      totalCost: this.totalCost,
      totalToolCalls: this.totalToolCalls,
      totalApiDuration: this.totalApiDuration,
      totalWallDuration: this.totalWallDuration,
      startTime: this.startTime,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      cachedInputTokens: this.cachedInputTokens,
      turns: this.turns,
    };
  }

  recordTelemetry(success: boolean) {
    Sentry.getActiveSpan()?.setAttributes({
      'agent.total_input_tokens': this.inputTokens,
      'agent.total_cached_input_tokens': this.cachedInputTokens,
      'agent.total_output_tokens': this.outputTokens,
      'agent.total_turns': this.turns,
      'agent.total_cost_usd': this.totalCost,
      'agent.total_wall_duration_ms': this.totalWallDuration,
      'agent.total_api_duration_ms': this.totalApiDuration,
      'agent.total_files_processed': this.processedFiles,
      'agent.total_tool_calls': this.totalToolCalls,
      'agent.success': success,
    });

    posthog.capture({
      distinctId: getSessionId(),
      event: 'agent_stats',
      properties: {
        total_files: this.processedFiles,
        total_turns: this.turns,
        total_input_tokens: this.inputTokens,
        total_output_tokens: this.outputTokens,
        total_cost_usd: this.totalCost,
        total_wall_duration_ms: this.totalWallDuration,
        total_api_duration_ms: this.totalApiDuration,
        total_files_processed: this.processedFiles,
        total_tool_calls: this.totalToolCalls,
        success: success,
      },
    });
  }
}
