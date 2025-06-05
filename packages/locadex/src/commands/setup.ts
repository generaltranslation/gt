import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { createSpinner, displayHeader } from '../logging/console.js';
import { allMcpPrompt } from '../prompts/system.js';
import { configureAgent } from '../utils/configuration.js';
import { logger } from '../logging/logger.js';
import type { ChildProcess } from 'node:child_process';

export async function setupCommand() {
  displayHeader();

  const spinner = createSpinner();

  spinner.start('Initializing Locadex...');

  let mcpProcess: ChildProcess | undefined = undefined;
  try {
    const { agent, mcpProcess: childProcess } = configureAgent({
      mcpTransport: 'sse',
    });
    mcpProcess = childProcess;

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
  } finally {
    // Clean up the MCP process
    if (mcpProcess) {
      logger.debugMessage(`[setupCommand] Cleaning up MCP process`);
      mcpProcess.kill();
    }
  }
}
