import { intro, outro, text, select, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ClaudeCodeRunner } from '../utils/claudeCode.js';
import { mcpConfig } from '../utils/mcpConfig.js';
import { fromPackageRoot } from '../utils/getPaths.js';

const I18N_SYSTEM_PROMPT = ``;

interface LocadexConfig {
  projectType?: string;
  apiKey?: string;
  mcpConfig?: string;
  setupComplete?: boolean;
}

export async function i18nCommand() {
  intro(chalk.blue('🌍 Locadex i18n'));

  try {
    // Check if configured
    const configPath = join(process.cwd(), '.locadex.json');
    if (!existsSync(configPath)) {
      outro(
        chalk.red('❌ Locadex not configured. Run `npx locadex setup` first.')
      );
      return;
    }

    const config: LocadexConfig = JSON.parse(readFileSync(configPath, 'utf8'));

    if (!config.setupComplete) {
      outro(
        chalk.red('❌ Setup incomplete. Please run `npx locadex setup` again.')
      );
      return;
    }

    // Select i18n task
    const task = await select({
      message: 'What would you like to do?',
      options: [
        { value: 'extract', label: 'Extract text for translation' },
        { value: 'translate', label: 'Generate translations' },
        { value: 'audit', label: 'Audit existing translations' },
        { value: 'refactor', label: 'Refactor hardcoded strings' },
        { value: 'custom', label: 'Custom i18n task' },
      ],
    });

    let prompt = '';

    switch (task) {
      case 'extract':
        prompt =
          'Scan the codebase and extract all user-facing text that needs translation. Create appropriate translation keys and organize them logically.';
        break;
      case 'translate':
        const targetLang = await text({
          message: 'Target language (e.g., "es", "fr", "de"):',
          placeholder: 'es',
        });
        prompt = `Generate translations for the target language: ${typeof targetLang === 'string' ? targetLang : 'es'}. Maintain context and ensure culturally appropriate translations.`;
        break;
      case 'audit':
        prompt =
          'Audit existing translations for completeness, consistency, and quality. Identify missing keys and potential improvements.';
        break;
      case 'refactor':
        prompt =
          'Find hardcoded strings in the codebase and refactor them to use the i18n system. Maintain functionality while making text translatable.';
        break;
      case 'custom':
        const customPrompt = await text({
          message: 'Describe your i18n task:',
          placeholder: 'I need help with...',
        });
        prompt = typeof customPrompt === 'string' ? customPrompt : '';
        break;
    }

    const s = spinner();

    s.start('Processing i18n task...');

    // Run Claude Code
    const claudeRunner = new ClaudeCodeRunner({
      apiKey: config.apiKey,
    });

    const mcpConfigPath = fromPackageRoot('.locadex-mcp.json');

    const result = await claudeRunner.run({
      // systemPrompt: I18N_SYSTEM_PROMPT,
      prompt,
      mcpConfig: mcpConfigPath,
      allowedTools: ['mcp__*'],
    });

    s.stop('Task complete');

    console.log('\n' + chalk.green('📋 Result:'));
    console.log(result);

    outro(chalk.green('✅ i18n task completed!'));
  } catch (error) {
    outro(
      chalk.red(
        `❌ Task failed: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}
