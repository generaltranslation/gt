import { getPackageInfo } from 'gtx-cli/utils/packageInfo';
import { createSpinner } from '../../logging/console.js';
import chalk from 'chalk/index.js';
import { installPackageGlobal } from 'gtx-cli/utils/installPackage';
import { logger } from '../../logging/logger.js';
import { CLAUDE_CODE_VERSION } from '../shared.js';

export async function installClaudeCode() {
  const claudeCodeInfo = await getPackageInfo('@anthropic-ai/claude-code');
  if (!claudeCodeInfo) {
    const spinner = createSpinner();
    spinner.start('Installing claude-code...');
    await installPackageGlobal(
      '@anthropic-ai/claude-code',
      CLAUDE_CODE_VERSION
    );
    spinner.stop(chalk.green('Installed claude-code.'));
  } else {
    logger.step(`claude-code is already installed: v${claudeCodeInfo.version}`);
  }
}
