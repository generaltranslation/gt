import { type Message, type MessageParam } from '@anthropic-ai/sdk/resources';
export type ClaudeSDKMessage =
  // An assistant message
  | {
      type: 'assistant';
      message: Message; // from Anthropic SDK
      session_id: string;
    }

  // A user message
  | {
      type: 'user';
      message: MessageParam; // from Anthropic SDK
      session_id: string;
    }

  // Emitted as the last message
  | {
      type: 'result';
      subtype: 'success';
      duration_ms: number;
      duration_api_ms: number;
      is_error: boolean;
      num_turns: number;
      result: string;
      session_id: string;
      total_cost_usd: number;
    }

  // Emitted as the last message, when we've reached the maximum number of turns
  | {
      type: 'result';
      subtype: 'error_max_turns' | 'error_during_execution';
      duration_ms: number;
      duration_api_ms: number;
      is_error: boolean;
      num_turns: number;
      session_id: string;
      total_cost_usd: number;
    }

  // Emitted as the first message at the start of a conversation
  | {
      type: 'system';
      subtype: 'init';
      apiKeySource: string;
      cwd: string;
      session_id: string;
      tools: string[];
      mcp_servers: {
        name: string;
        status: string;
      }[];
      model: string;
      permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
    };
