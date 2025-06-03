import { ClaudeSDKMessage } from '../types/claude-sdk';

export function constructResultInfo(result: ClaudeSDKMessage) {
  if (result.type === 'result') {
    if (result.subtype === 'success') {
      return `Done!\nCost: $${Number(result.cost_usd).toFixed(2)}\nDuration: ${
        Number(result.duration_ms) / 1000
      }s`;
    } else {
      return `Error: ${result.subtype}\nCost: $${result.cost_usd}\nDuration: ${
        Number(result.duration_ms) / 1000
      }s`;
    }
  }

  return '';
}
