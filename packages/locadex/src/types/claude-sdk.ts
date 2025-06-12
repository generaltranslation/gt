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
      cost_usd: Number;
      duration_ms: Number;
      duration_api_ms: Number;
      is_error: boolean;
      num_turns: Number;
      result: string;
      session_id: string;
    }

  // Emitted as the last message, when we've reached the maximum number of turns
  | {
      type: 'result';
      subtype: 'error_max_turns';
      cost_usd: Number;
      duration_ms: Number;
      duration_api_ms: Number;
      is_error: boolean;
      num_turns: Number;
      session_id: string;
    }

  // Emitted as the first message at the start of a conversation
  | {
      type: 'system';
      subtype: 'init';
      session_id: string;
      tools: string[];
      mcp_servers: {
        name: string;
        status: string;
      }[];
    };
