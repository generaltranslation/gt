import { createSpinner, displayHeader } from '../logging/console.js';
import { getPackageJson, isPackageInstalled } from 'gtx-cli/utils/packageJson';
import { getPackageManager } from 'gtx-cli/utils/packageManager';
import { installPackage } from 'gtx-cli/utils/installPackage';
import chalk from 'chalk';
import { logger } from '../logging/logger.js';
import { findFilepaths } from '../utils/fs/findConfigs.js';
import { wrapContentNext } from 'gtx-cli/next/parse/wrapContent';
import { handleInitGT } from 'gtx-cli/next/parse/handleInitGT';
import { detectFormatter, formatFiles } from 'gtx-cli/hooks/postProcess';
import { createOrUpdateConfig } from 'gtx-cli/fs/config/setupConfig';
import { i18nCommand } from './i18n.js';

export async function setupCommand(batchSize: number) {
  displayHeader();

  const packageJson = await getPackageJson();
  const packageManager = await getPackageManager();

  const spinner = createSpinner('timer');

  spinner.start(`Installing gt-next with ${packageManager.name}...`);

  await installPackage('gt-next', packageManager);

  spinner.stop(chalk.green('Automatically installed gt-next.'));

  const nextConfigPath = findFilepaths([
    './next.config.js',
    './next.config.ts',
    './next.config.mjs',
    './next.config.mts',
  ])[0];

  if (!nextConfigPath) {
    logger.error('No next.config.[js|ts|mjs|mts] file found.');
    process.exit(1);
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  let filesUpdated: string[] = [];

  const babel = createSpinner();

  babel.start('Wrapping JSX content with <T> tags...');

  // Wrap all JSX elements in the src directory with a <T> tag, with unique ids
  const { filesUpdated: filesUpdatedNext } = await wrapContentNext(
    {
      src: findFilepaths(['./src', './app']),
      config: nextConfigPath,
      disableIds: true,
      disableFormatting: true,
      skipTs: true,
      addGTProvider: true,
    },
    'gt-next',
    errors,
    warnings
  );
  filesUpdated = [...filesUpdated, ...filesUpdatedNext];

  babel.stop(chalk.green(`Success! Modified ${filesUpdated.length} files.`));
  // Add the withGTConfig() function to the next.config.js file
  await handleInitGT(nextConfigPath, errors, warnings, filesUpdated);
  logger.step(
    chalk.green(`Added withGTConfig() to your ${nextConfigPath} file.`)
  );

  const formatter = await detectFormatter();
  if (formatter && filesUpdated.length > 0) {
    logger.step(chalk.green(`Formatting ${filesUpdated.length} files...`));
    await formatFiles(filesUpdated, formatter);
  }

  // Create gt.config.json
  await createOrUpdateConfig('gt.config.json', {
    defaultLocale: 'en',
    locales: ['en'],
    framework: 'next-app',
  });

  logger.success(
    `Feel free to edit ${chalk.cyan(
      'gt.config.json'
    )} to customize your translation setup. Docs: https://generaltranslation.com/docs/cli/reference/config`
  );

  // Install locadex if not installed
  const isLocadexInstalled = packageJson
    ? isPackageInstalled('locadex', packageJson, true, true)
    : true; // if no package.json, we can't install it

  if (!isLocadexInstalled) {
    const packageManager = await getPackageManager();
    const spinner = createSpinner();
    spinner.start(
      `Installing locadex as a dev dependency with ${packageManager.name}...`
    );
    await installPackage('locadex', packageManager, true);
    spinner.stop(chalk.green('Installed locadex.'));
  }

  i18nCommand(batchSize);
}
