import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { ClaudeCodeRunner } from '../utils/claudeCode.js';
import { fromPackageRoot } from '../utils/getPaths.js';
import { displayHeader } from '../logging/console.js';
import { ADDITIONAL_TOOLS_PROMPT } from '../prompts/system.js';

export async function i18nCommand() {
  displayHeader(chalk.blue('🌍 Locadex i18n'));

  try {
    const mcpConfigPath = fromPackageRoot('.locadex-mcp.json');

    const claudeRunner = new ClaudeCodeRunner({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const setupPrompt = `This project is already setup for internationalization.
You do not need to setup the project again.
Your job is to internationalize the app's content using gt-next, specifically using:
- useGT
- getGT
- useDict
- getDict
- <T> 

To validate the use of gt-next, you can run the following command:
'npx gtx-cli translate --dry-run'
${ADDITIONAL_TOOLS_PROMPT}
`;

    await claudeRunner.run({
      additionalSystemPrompt: ADDITIONAL_TOOLS_PROMPT,
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
