import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { ClaudeCodeRunner } from '../utils/claudeCode.js';
import { fromPackageRoot } from '../utils/getPaths.js';
import { createSpinner, displayHeader } from '../logging/console.js';
import { mcpTools } from '../prompts/system.js';

export async function i18nCommand() {
  displayHeader();

  const spinner = createSpinner();

  spinner.start('Initializing Locadex...');

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

Your core principles are:
- Minimize the footprint of the changes
- Keep content in the same file where it came from
- Use the tools provided to you to internationalize the content

You additionally have access to the following mcp tools made available via the 'locadex' mcp server:
${mcpTools}
Use these tools to help you with your tasks.
`;

    await claudeRunner.run(
      {
        additionalSystemPrompt: mcpTools,
        prompt: setupPrompt,
        mcpConfig: mcpConfigPath,
      },
      { spinner }
    );

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
