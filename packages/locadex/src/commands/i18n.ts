import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { ClaudeCodeRunner } from '../utils/claudeCode.js';
import { fromPackageRoot } from '../utils/getPaths.js';
import { displayHeader } from '../logging/console.js';

export async function i18nCommand() {
  displayHeader(chalk.blue('🌍 Locadex i18n'));

  try {
    const mcpConfigPath = fromPackageRoot('.locadex-mcp.json');

    const claudeRunner = new ClaudeCodeRunner({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const setupPrompt = `Use the locadex mcp server to learn how to use gt-next. 
This project is already setup for internationalization.
Your job is to internationalize the project using gt-next. 
To validate the use of gt-next, you can run the following command:
'npx gtx-cli translate --dry-run'`;

    await claudeRunner.run({
      // systemPrompt: SETUP_SYSTEM_PROMPT,
      prompt: setupPrompt,
      mcpConfig: mcpConfigPath,
    });

    outro(chalk.green('✅ Locadex i18n complete!'));
  } catch (error) {
    outro(
      chalk.red(
        `❌ Setup failed: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}
