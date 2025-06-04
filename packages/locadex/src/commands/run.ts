import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { ClaudeCodeRunner } from '../utils/claudeCode.js';
import { fromPackageRoot } from '../utils/getPaths.js';
import { createSpinner, displayHeader } from '../logging/console.js';
import { mcpTools } from '../prompts/system.js';

export async function startCommand() {
  displayHeader();

  const spinner = createSpinner();

  spinner.start('Initializing Locadex...');

  try {
    const mcpConfigPath = fromPackageRoot('.locadex-mcp.json');

    const claudeRunner = new ClaudeCodeRunner({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const setupPrompt = `Use gt-next to internationalize this project.
You additionally have access to the following mcp tools made available via the 'locadex' mcp server:
${mcpTools}
Use these tools to help you with your tasks.
`;

    await claudeRunner.run(
      {
        prompt: setupPrompt,
        mcpConfig: mcpConfigPath,
      },
      { spinner }
    );

    outro(chalk.green('✅ Locadex run complete!'));
  } catch (error) {
    outro(
      chalk.red(
        `❌ Setup failed: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}
