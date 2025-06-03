import { ClaudeSDKMessage } from '../types/claude-sdk';

export function constructResultInfo(result: ClaudeSDKMessage) {
  if (result.type === 'result') {
    if (result.subtype === 'success') {
      return `Done!\nCost: $${result.cost_usd}\nDuration: ${result.duration_ms}ms`;
    } else {
      return `Error: ${result.subtype}\nCost: $${result.cost_usd}\nDuration: ${result.duration_ms}ms`;
    }
  }

  return '';
}
