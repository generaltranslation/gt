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
import { getNextDirectories } from '../utils/fs/getFiles.js';
import { LocadexManager } from '../utils/locadexManager.js';
import { outro } from '@clack/prompts';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { exit } from '../utils/shutdown.js';
import {
  addTranslateScript,
  installGlobalPackage,
} from '../utils/packages/installPackage.js';
import { CLAUDE_CODE_VERSION } from '../utils/shared.js';
import { getLocadexVersion } from '../utils/getPaths.js';
import { getResource } from '../resources/getResource.js';

export async function setupTask(
  bypassPrompts: boolean,
  specifiedPackageManager?: string
) {
  if (!bypassPrompts) {
    await promptConfirm({
      message: chalk.yellow(
        `Locadex will modify files! Make sure you have committed or stashed any changes. Do you want to continue?`
      ),
      defaultValue: true,
      cancelMessage: 'Operation cancelled.',
    });
  }

  const manager = LocadexManager.getInstance();

  const packageManager = await getPackageManager(
    manager.rootDirectory,
    specifiedPackageManager
  );
  let appPackageJson = await getPackageJson(manager.appDirectory);

  if (appPackageJson) {
    if (!isPackageInstalled('gt-next', appPackageJson)) {
      const spinner = createSpinner('timer');
      spinner.start(`Installing gt-next with ${packageManager.name}...`);
      await installPackage(
        'gt-next',
        packageManager,
        false,
        manager.appDirectory
      );
      spinner.stop('Automatically installed gt-next.');
    }
  }

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
  const gtConfig: any = {
    defaultLocale: 'en',
    locales: ['es', 'fr', 'de', 'ja', 'zh'],
    framework: 'next-app',
  };

  // Add local translations config if flag is set
  if (manager.getCliOptions().localTranslations) {
    gtConfig.files = {
      gt: {
        output: 'public/_gt/[locale].json',
      },
    };
  }

  await createOrUpdateConfig(
    path.resolve(manager.appDirectory, 'gt.config.json'),
    gtConfig
  );

  logger.success(
    `Feel free to edit ${chalk.cyan(
      'gt.config.json'
    )} to customize your translation setup. Docs: https://generaltranslation.com/docs/cli/reference/config`
  );

  // Create loadTranslations file if local translations flag is set
  if (manager.getCliOptions().localTranslations) {
    logger.step(`Creating loadTranslations file...`);
    await createLoadTranslationsFile(manager.appDirectory);
  }

  // Add translate to scripts
  // Re-get the package.json to make sure it's updated
  appPackageJson = await getPackageJson(manager.appDirectory);
  if (appPackageJson) {
    await addTranslateScript(manager, appPackageJson, packageManager);
  }

  // Install claude-code if not installed
  await installGlobalPackage('@anthropic-ai/claude-code', CLAUDE_CODE_VERSION);

  // Install locadex if not installed
  await installGlobalPackage('locadex', getLocadexVersion());

  // Set up locale selector
  await setupLocaleSelector();

  // Create dictionary.json file if not exists
  setupDictionary(manager);

  // Add locadex github action if not exists
  setupGithubAction(manager);

  const formatter = await detectFormatter();
  if (formatter && filesUpdated.length > 0) {
    await formatFiles(filesUpdated, formatter);
  }

  // Run i18n command
  await i18nTask();
}

function setupDictionary(manager: LocadexManager) {
  const usingSrcDirectory = existsSync(path.join(manager.appDirectory, 'src'));
  const dictionaryPath = usingSrcDirectory
    ? path.join(manager.appDirectory, 'src', 'dictionary.json')
    : path.join(manager.appDirectory, 'dictionary.json');
  if (!existsSync(dictionaryPath)) {
    writeFileSync(dictionaryPath, '{}');
    logger.step(
      `Created ${chalk.cyan(
        'dictionary.json'
      )} file at ${chalk.cyan(dictionaryPath)}.`
    );
  } else {
    logger.step(
      `Found ${chalk.cyan('dictionary.json')} file at ${chalk.cyan(
        dictionaryPath
      )}. Skipping creation...`
    );
  }
}

function setupGithubAction(manager: LocadexManager) {
  const githubActionPath = path.join(
    manager.rootDirectory,
    '.github',
    'workflows',
    'locadex.yml'
  );
  if (!existsSync(githubActionPath)) {
    mkdirSync(path.join(manager.rootDirectory, '.github', 'workflows'), {
      recursive: true,
    });
    const resource = getResource('ghaYaml.yml');
    if (resource.content) {
      writeFileSync(githubActionPath, resource.content);
      logger.step(
        `Created ${chalk.cyan(
          'locadex.yml'
        )} Github Action at ${chalk.cyan(githubActionPath)}.`
      );
    } else {
      logger.error(`Error reading resource ghaYaml.yml: ${resource.error}`);
    }
  } else {
    logger.step(
      `Found ${chalk.cyan('locadex.yml')} Github Action at ${chalk.cyan(
        githubActionPath
      )}. Skipping creation...`
    );
  }
}
async function setupLocaleSelector() {
  logger.initializeSpinner();
  logger.spinner.start('Creating locale selector...');

  // Create agent
  const manager = LocadexManager.getInstance();

  const agent = manager.createSingleAgent('claude_setup_agent', {});

  // Fix prompt
  const localeSelectorPrompt = getLocaleSelectorPrompt(manager.appDirectory);
  try {
    await agent.run(
      localeSelectorPrompt,
      {
        maxTurns: 50,
        timeoutSec: 120,
        maxRetries: 1,
      },
      {}
    );

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
    agent.aggregateStats();
    // Check if this is an abort
    if (manager.getAgentAbortController().signal.aborted) {
      return;
    }
    logger.debugMessage(`[setup] Adding locale selector failed: ${error}`);
    outro(chalk.red('❌ Locadex setup failed!'));
    await exit(1);
  }
  agent.aggregateStats();

  logger.spinner.stop('Locale selector setup complete');
}

async function createLoadTranslationsFile(appDirectory: string) {
  const loadTranslationsContent = `
export default async function loadTranslations(locale) {
  try {
    // Load translations from public/_gt directory
    // This matches the GT config files.gt.output path
    const t = await import(\`../public/_gt/\${locale}.json\`);
    return t.default;
  } catch (error) {
    console.warn(\`Failed to load translations for locale \${locale}:\`, error);
    return {};
  }
}
`;
  const filePath = path.join(appDirectory, 'src', 'loadTranslations.js');
  writeFileSync(filePath, loadTranslationsContent);
  logger.step(`Created ${chalk.cyan('src/loadTranslations.js')} file`);
}

function getLocaleSelectorPrompt(appDirectory: string) {
  const prompt = `# Task: Add a locale selector to the app

## Instructions
- The locale selector should be a dropdown that allows the user to select the locale.
- The app root is: "${appDirectory}"

## LOCALE SELECTOR USAGE
(1) Import the locale selector component from 'gt-next'
(2) Add the locale selector to the app

For example:
import { LocaleSelector } from 'gt-next';

function MyComponent() {
  return (
    <div>
      <LocaleSelector />
      <p>Hello, world!</p>
    </div>
  );
}

## RULES
- The locale selector should be added to a header or footer or some other very obvious place in the app.
- Scan across files to find the best place to add the locale selector.
- **DO NOT** create new files. You may only modify existing files.
- You do not need to mark the component containing the LocaleSelector with 'use client'. The LocaleSelector component is already internally marked with 'use client'.

## Final output
- When you are done, please return a **brief summary** of the files you modified.
- **DO NOT** include any other text in your response.
`;
  return prompt;
}
