import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { createSpinner, displayHeader } from '../logging/console.js';
import { allMcpPrompt } from '../prompts/system.js';
import { configureAgent } from '../utils/agentManager.js';
export async function setupCommand() {
  displayHeader();

  const spinner = createSpinner();

  spinner.start('Initializing Locadex...');

  try {
    const { agent } = configureAgent({
      mcpTransport: 'sse',
    });

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
