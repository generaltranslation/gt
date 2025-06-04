import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { createSpinner, displayHeader } from '../logging/console.js';
import { allMcpPrompt } from '../prompts/system.js';
import { CliOptions } from '../types/cli.js';
import { configureAgent } from '../utils/configuration.js';
import { logger } from '../logging/logger.js';

export async function setupCommand(options: CliOptions) {
  logger.initialize(options);
  
  displayHeader(chalk.cyan('Locadex: i18n AI Agent'));

  const spinner = createSpinner();

  spinner.start('Initializing Locadex...');

  try {
    const { agent } = configureAgent();

    const setupPrompt = `Use gt-next to setup this project for internationalization.
Only prepare the project for internationalization, do not internationalize any content.

${allMcpPrompt}
`;

    await agent.run({ prompt: setupPrompt }, { spinner });

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
