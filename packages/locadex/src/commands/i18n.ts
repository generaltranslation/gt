import { intro, outro, text, select, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ClaudeCodeRunner } from '../utils/claudeCode.js';
import { fromPackageRoot } from '../utils/getPaths.js';
import { logInfo } from '../utils/logging.js';

const I18N_SYSTEM_PROMPT = ``;

interface LocadexConfig {
  projectType?: string;
  apiKey?: string;
  mcpConfig?: string;
  setupComplete?: boolean;
}

export async function i18nCommand() {
  intro(chalk.blue('🌍 Locadex i18n'));

  try {
    const claudeRunner = new ClaudeCodeRunner({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const mcpConfigPath = fromPackageRoot('.locadex-mcp.json');

    const result = await claudeRunner.run({
      // systemPrompt: I18N_SYSTEM_PROMPT,
      prompt: 'Internationalize this next.js app',
      mcpConfig: mcpConfigPath,
    });

    outro(chalk.green('✅ Task completed!'));
  } catch (error) {
    outro(
      chalk.red(
        `❌ Task failed: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}
