import { createSpinner, promptConfirm } from '../logging/console.js';
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
import { i18nTask } from '../tasks/i18n.js';
import { validateConfig } from '../utils/config.js';
import { getNextDirectories } from '../utils/fs/getFiles.js';
import { LocadexManager } from '../utils/locadexManager.js';
import { outro } from '@clack/prompts';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { exit } from '../utils/shutdown.js';
import { installClaudeCode } from '../utils/packages/installPackage.js';

export async function setupTask(
  bypassPrompts: boolean,
  specifiedPackageManager?: string
) {
  if (!bypassPrompts) {
    const answer = await promptConfirm({
      message: chalk.yellow(
        `Locadex will modify files! Make sure you have committed or stashed any changes. Do you want to continue?`
      ),
      defaultValue: true,
      cancelMessage: 'Operation cancelled.',
    });
    if (!answer) {
      logger.info('Operation cancelled.');
      await exit(0);
    }
  }

  const manager = LocadexManager.getInstance();

  // have to use the package.json from the appDir
  const packageJson = await getPackageJson(manager.appDirectory);
  const packageManager = await getPackageManager(
    manager.rootDirectory,
    specifiedPackageManager
  );

  const spinner = createSpinner('timer');

  spinner.start(`Installing gt-next with ${packageManager.name}...`);

  await installPackage('gt-next', packageManager, false, manager.appDirectory);

  spinner.stop('Automatically installed gt-next.');

  const nextConfigPath = findFilepaths(
    [
      './next.config.js',
      './next.config.ts',
      './next.config.mjs',
      './next.config.mts',
    ],
    manager.appDirectory
  )[0];

  if (!nextConfigPath) {
    logger.error('No next.config.[js|ts|mjs|mts] file found.');
    await exit(1);
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  let filesUpdated: string[] = [];

  const babel = createSpinner();

  babel.start('Wrapping <GTProvider> tags...');

  // Wrap all JSX elements in the src directory with a <T> tag, with unique ids
  const { filesUpdated: filesUpdatedNext } = await wrapContentNext(
    {
      src: getNextDirectories(manager.appDirectory),
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

  babel.stop(`Modified ${filesUpdated.length} files.`);

  // Add the withGTConfig() function to the next.config.js file
  await handleInitGT(nextConfigPath, errors, warnings, filesUpdated);
  logger.step(`Added withGTConfig() to your ${nextConfigPath} file.`);

  // Create gt.config.json
  await createOrUpdateConfig(
    path.resolve(manager.appDirectory, 'gt.config.json'),
    {
      defaultLocale: 'en',
      locales: ['es', 'fr', 'de', 'ja', 'zh'],
      framework: 'next-app',
    }
  );

  logger.success(
    `Feel free to edit ${chalk.cyan(
      'gt.config.json'
    )} to customize your translation setup. Docs: https://generaltranslation.com/docs/cli/reference/config`
  );

  // Install claude-code if not installed
  await installClaudeCode();

  // Install locadex if not installed
  const rootPackageJson = await getPackageJson(manager.rootDirectory);
  const isLocadexInstalled = rootPackageJson
    ? isPackageInstalled('locadex', rootPackageJson, true, true)
    : true; // if no package.json, we can't install it

  if (!isLocadexInstalled) {
    const packageManager = await getPackageManager(manager.rootDirectory);
    const spinner = createSpinner();
    spinner.start(
      `Installing locadex as a dev dependency with ${packageManager.name}...`
    );
    await installPackage(
      'locadex',
      packageManager,
      true,
      manager.rootDirectory
    );
    spinner.stop(chalk.green('Installed locadex.'));
  }

  // Set up locale selector
  await setupLocaleSelector();

  const formatter = await detectFormatter();
  if (formatter && filesUpdated.length > 0) {
    await formatFiles(filesUpdated, formatter);
  }

  // Run i18n command
  await i18nTask();
}

async function setupLocaleSelector() {
  logger.initializeSpinner();
  logger.spinner.start('Creating locale selector...');

  // Create agent
  const manager = LocadexManager.getInstance();

  const agent = manager.createSingleAgent('claude_setup_agent');

  // Fix prompt
  const localeSelectorPrompt = getLocaleSelectorPrompt();
  try {
    await agent.run({ prompt: localeSelectorPrompt }, {});

    // Generate report
    const report = agent.generateReport();
    const reportSummary = `# Summary of locadex setup changes
${report}`;
    const summaryFilePath = path.join(
      manager.getLogDirectory(),
      'locadex-report.md'
    );
    appendFileSync(summaryFilePath, reportSummary);
  } catch (error) {
    // Check if this is an abort
    if (manager.getAgentAbortController().signal.aborted) {
      return;
    }
    logger.debugMessage(`[setup] Adding locale selector failed: ${error}`);
    outro(chalk.red('❌ Locadex setup failed!'));
    await exit(1);
  }

  logger.spinner.stop('Locale selector setup complete');
}

function getLocaleSelectorPrompt() {
  const prompt = `# Task: Add a locale selector to the project

## Instructions
- The locale selector should be a dropdown that allows the user to select the locale.

## LOCALE SELECTOR USAGE
(1) Import the locale selector component from 'gt-next/client'
(2) Add the locale selector to the project

For example:
import { LocaleSelector } from 'gt-next/client';

function MyComponent() {
  return (
    <div>
      <LocaleSelector />
      <p>Hello, world!</p>
    </div>
  );
}

## ADVICE
- The locale selector should be added to a header or footer or some other very obvious place in the project.
- Scan across files to find the best place to add the locale selector.

## Final output
- When you are done, please return a brief summary of the files you modified, following this format.
- **DO NOT** include any other text in your response. 
- If there were issues with some files, please include the issues in the list of changes for that file.

[file 1 path]
- List of changes to file 1
`;
  return prompt;
}
