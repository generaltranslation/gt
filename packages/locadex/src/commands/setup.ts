import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { ClaudeCodeRunner } from '../utils/claudeCode.js';
import { fromPackageRoot } from '../utils/getPaths.js';
import { createSpinner, displayHeader } from '../logging/console.js';
import { allMcpPrompt, allMcpTools } from '../prompts/system.js';

export async function setupCommand() {
  displayHeader();

  const spinner = createSpinner();

  spinner.start('Initializing Locadex...');

  try {
    const mcpConfigPath = fromPackageRoot('.locadex-mcp.json');

    const claudeRunner = new ClaudeCodeRunner({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const setupPrompt = `Use gt-next to setup this project for internationalization.
Only prepare the project for internationalization, do not internationalize any content.

${allMcpPrompt}
`;

    await claudeRunner.run(
      {
        prompt: setupPrompt,
        mcpConfig: mcpConfigPath,
      },
      { spinner }
    );

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
