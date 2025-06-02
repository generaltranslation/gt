import { intro, outro, text, confirm, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ClaudeCodeRunner } from '../utils/claudeCode.js';
import { fromPackageRoot } from '../utils/getPaths.js';

const SETUP_SYSTEM_PROMPT = ``;

export async function setupCommand() {
  intro(chalk.blue('🌍 Locadex Setup'));

  try {
    // Project analysis
    const projectType = await text({
      message:
        'What type of project is this? (e.g., React, Vue, Node.js, etc.):',
      placeholder: 'React',
    });

    const s = spinner();

    const mcpConfigPath = fromPackageRoot('.locadex-mcp.json');

    // Run Claude Code for project analysis
    s.start('Analyzing project for i18n setup...');

    const claudeRunner = new ClaudeCodeRunner({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const setupPrompt = `Use the locadex mcp server to learn how to use gt-next. 
Then, use gt-next to internationalize this next.js app`;

    const result = await claudeRunner.run({
      // systemPrompt: SETUP_SYSTEM_PROMPT,
      prompt: setupPrompt,
      mcpConfig: mcpConfigPath,
      allowedTools: ['mcp__*'],
    });

    s.stop('Analysis complete');

    console.log('\n' + chalk.green('📋 Setup Analysis:'));
    console.log(result);

    outro(
      chalk.green(
        '✅ Locadex setup complete! Run `npx locadex i18n` to start working on internationalization.'
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
