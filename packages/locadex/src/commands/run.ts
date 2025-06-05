import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { createSpinner, displayHeader } from '../logging/console.js';
import { allMcpPrompt } from '../prompts/system.js';
import { configureAgent } from '../utils/configuration.js';
import { logger } from '../logging/logger.js';
import type { ChildProcess } from 'node:child_process';

export async function startCommand() {
  displayHeader();

  const spinner = createSpinner();

  spinner.start('Initializing Locadex...');

  let mcpProcess: ChildProcess | undefined = undefined;
  try {
    const { agent, mcpProcess: childProcess } = configureAgent({
      mcpTransport: 'sse',
    });
    mcpProcess = childProcess;

    const setupPrompt = `This project is a Next.js app router app.
Your task is to internationalize the project using gt-next.

After you finish internationalizing the project, you can run the following command to validate the use of gt-next:
'npx gtx-cli translate --dry-run'

Your core principles are:
- Minimize the footprint of the changes
- Keep content in the same file where it came from
- Use the tools provided to you to internationalize the content

${allMcpPrompt}
`;

    await agent.run({ prompt: setupPrompt }, { spinner });

    outro(chalk.green('✅ Locadex run complete!'));
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
      logger.debugMessage(`[startCommand] Cleaning up MCP process`);
      mcpProcess.kill();
    }
  }
}
