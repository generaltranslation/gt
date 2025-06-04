import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { ClaudeCodeRunner } from '../utils/claudeCode.js';
import { fromPackageRoot } from '../utils/getPaths.js';
import { createSpinner, displayHeader } from '../logging/console.js';
import { allMcpPrompt } from '../prompts/system.js';
import { CliOptions } from '../types/cli.js';
import { configureAgent } from '../utils/configuration.js';

export async function startCommand(options: CliOptions) {
  displayHeader();

  const spinner = createSpinner();

  spinner.start('Initializing Locadex...');

  try {
    const { agent } = configureAgent(options);

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
  }
}
