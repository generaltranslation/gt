import { createSpinner } from '../../../console/logging.js';
import { installPackage } from '../../../utils/installPackage.js';
import { isPackageInstalled } from '../../../utils/packageJson.js';
import { getPackageManager } from '../../../utils/packageManager.js';
import chalk from 'chalk';

/**
 * Installs @generaltranslation/compiler if not installed
 */
export async function installCompiler({
  packageJson,
}: {
  packageJson?: { type?: string };
}) {
  // Check if installed
  if (isPackageInstalled('@generaltranslation/compiler', packageJson || {})) {
    return;
  }

  // Animation
  const spinner = createSpinner();
  spinner.start(`Installing @generaltranslation/compiler...`);

  // Install
  const packageManager = await getPackageManager();
  await installPackage('@generaltranslation/compiler', packageManager, true);

  // Animation
  spinner.stop(chalk.green('Installed @generaltranslation/compiler.'));
}
