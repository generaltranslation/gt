import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { ClaudeCodeRunner } from '../utils/claudeCode.js';
import { fromPackageRoot } from '../utils/getPaths.js';
import { logInfo } from '../utils/logging.js';

export async function setupCommand() {
  intro(chalk.blue('🌍 Locadex Setup'));

  try {
    const mcpConfigPath = fromPackageRoot('.locadex-mcp.json');

    const claudeRunner = new ClaudeCodeRunner({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const setupPrompt = `Use the locadex mcp server to learn how to use gt-next. 
Then, use gt-next to internationalize this next.js app`;

    const result = await claudeRunner.run({
      // systemPrompt: SETUP_SYSTEM_PROMPT,
      prompt: setupPrompt,
      mcpConfig: mcpConfigPath,
    });

    outro(
      chalk.green(
        '✅ Locadex setup complete! Run `npx locadex i18n` to start working on internationalization.'
      )
    );
  } catch (error) {
    outro(
      chalk.red(
        `❌ Setup failed: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}
