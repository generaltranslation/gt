import { spawn } from 'node:child_process';

export interface ClaudeCodeOptions {
  systemPrompt?: string;
  prompt: string;
  outputFormat?: 'text' | 'json' | 'stream-json';
  mcpConfig?: string;
  allowedTools?: string[];
  maxTurns?: number;
}

export class ClaudeCodeRunner {
  constructor(private options: { apiKey?: string } = {}) {
    // Ensure API key is set
    if (!process.env.ANTHROPIC_API_KEY && !this.options.apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable or apiKey option is required'
      );
    }
  }

  async run(options: ClaudeCodeOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ['-p', options.prompt];

      if (options.systemPrompt) {
        args.push('--system-prompt', options.systemPrompt);
      }

      if (options.outputFormat) {
        args.push('--output-format', options.outputFormat);
      }

      if (options.mcpConfig) {
        args.push('--mcp-config', options.mcpConfig);
      }

      if (options.allowedTools) {
        args.push('--allowedTools', options.allowedTools.join(','));
      }

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

      let output = '';
      let errorOutput = '';

      claude.stdout?.on('data', (data) => {
        output += data.toString();
      });

      claude.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      claude.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(
            new Error(`Claude Code exited with code ${code}: ${errorOutput}`)
          );
        }
      });

      claude.on('error', (error) => {
        reject(new Error(`Failed to run Claude Code: ${error.message}`));
      });
    });
  }
}
