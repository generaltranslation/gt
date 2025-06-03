import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { ClaudeCodeRunner } from '../utils/claudeCode.js';
import { fromPackageRoot } from '../utils/getPaths.js';
import { displayHeader } from '../logging/console.js';

export async function setupCommand() {
  displayHeader(chalk.blue('🌍 Locadex Setup'));

  try {
    const mcpConfigPath = fromPackageRoot('.locadex-mcp.json');

    const claudeRunner = new ClaudeCodeRunner({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const setupPrompt = `Use the locadex mcp server to learn how to use gt-next. 
Then, use gt-next to setup this project for internationalization.
Only prepare the project for internationalization, do not internationalize any content.`;

    await claudeRunner.run({
      // systemPrompt: SETUP_SYSTEM_PROMPT,
      prompt: setupPrompt,
      mcpConfig: mcpConfigPath,
    });

    outro(
      chalk.green(
        "✅ Locadex setup complete! Run `npx locadex i18n` to internationalize your project's content."
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
