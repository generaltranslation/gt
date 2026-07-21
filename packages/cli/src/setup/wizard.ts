import { detectFormatter } from '../hooks/postProcess.js';
import { promptSelect } from '../console/logging.js';
import { logger } from '../console/logger.js';
import chalk from 'chalk';
import { promptConfirm } from '../console/logging.js';
import { SetupOptions, SupportedReactFrameworks } from '../types/index.js';
import findFilepath from '../fs/findFilepath.js';
import { formatFiles } from '../hooks/postProcess.js';
import { handleInitGT } from '../next/parse/handleInitGT.js';
import { getPackageJson, isPackageInstalled } from '../utils/packageJson.js';
import { wrapContentNext } from '../next/parse/wrapContent.js';
import { getPackageManager } from '../utils/packageManager.js';
import { installPackage } from '../utils/installPackage.js';
import { createOrUpdateConfig } from '../fs/config/setupConfig.js';
import { loadConfig } from '../fs/config/loadConfig.js';
import { addVitePlugin } from '../react/parse/addVitePlugin/index.js';
import { exitSync } from '../console/logging.js';
import { ReactFrameworkObject } from '../types/index.js';
import {
  getFrameworkDisplayName,
  getReactFrameworkLibrary,
} from './frameworkUtils.js';
import { Libraries } from '../types/libraries.js';
import path from 'node:path';
import fs from 'node:fs';
import {
  hasPagesRouterLocaleRouting,
  setupPagesRouter,
} from '../next/parse/setupPagesRouter.js';
import { createDiagnosticMessage } from 'generaltranslation/internal';

export async function handleSetupReactCommand(
  options: SetupOptions,
  frameworkObject: ReactFrameworkObject,
  useDefaults: boolean = false
): Promise<void> {
  const frameworkDisplayName = getFrameworkDisplayName(frameworkObject);

  // Ask user for confirmation using inquirer
  if (!useDefaults) {
    const answer = await promptConfirm({
      message: chalk.yellow(
        `This wizard will configure your ${frameworkDisplayName} project for internationalization with GT. If your project is already using a different i18n library, this wizard may cause issues.

Make sure you have committed or stashed any changes. Do you want to continue?`
      ),
      defaultValue: true,
      cancelMessage:
        'Operation cancelled. You can re-run this wizard with: npx gt setup',
    });
    if (!answer) {
      logger.info(
        'Operation cancelled. You can re-run this wizard with: npx gt setup'
      );
      exitSync(0);
    }
  }

  const frameworkType =
    useDefaults && frameworkObject?.name
      ? frameworkObject.name
      : await promptSelect<SupportedReactFrameworks | 'other'>({
          message: 'Which framework are you using?',
          options: [
            { value: 'next-app', label: chalk.blue('Next.js App Router') },
            { value: 'next-pages', label: chalk.green('Next.js Pages Router') },
            { value: 'vite', label: chalk.cyan('Vite + React') },
            { value: 'gatsby', label: chalk.magenta('Gatsby') },
            { value: 'react', label: chalk.yellow('React') },
            { value: 'redwood', label: chalk.red('RedwoodJS') },
            { value: 'other', label: chalk.dim('Other') },
          ],
          defaultValue: frameworkObject?.name || 'other',
        });
  if (frameworkType === 'other') {
    logger.error(
      `Sorry, the wizard doesn't currently support other React frameworks.
Please let us know what you would like to see added at https://github.com/generaltranslation/gt/issues`
    );
    exitSync(0);
  }

  const gtConfigPath =
    options.config ||
    (fs.existsSync('src/gt.config.json')
      ? 'src/gt.config.json'
      : 'gt.config.json');

  // ----- Create a starter gt.config.json file -----
  await createOrUpdateConfig(gtConfigPath, {
    framework: frameworkType as SupportedReactFrameworks,
  });

  const packageJson = await getPackageJson();
  if (!packageJson) {
    logger.error(
      chalk.red(
        'No package.json found in the current directory. Run this command from the root of your project.'
      )
    );
    exitSync(1);
  }
  const frameworkLibrary = getReactFrameworkLibrary({
    name: frameworkType,
    type: 'react',
  });
  if (!isPackageInstalled(frameworkLibrary, packageJson)) {
    const packageManager = await getPackageManager();
    const spinner = logger.createSpinner('timer');
    spinner.start(
      `Installing ${frameworkLibrary} with ${packageManager.name}...`
    );
    await installPackage(frameworkLibrary, packageManager);
    spinner.stop(chalk.green(`Automatically installed ${frameworkLibrary}.`));
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  let filesUpdated: string[] = [];

  // Read tsconfig.json if it exists
  const tsconfigPath = findFilepath(['tsconfig.json']);
  const tsconfigJson = tsconfigPath ? loadConfig(tsconfigPath) : undefined;

  if (frameworkType === 'next-app' || frameworkType === 'next-pages') {
    // Check if they have a next.config.js file
    const nextConfigPath = findFilepath([
      './next.config.js',
      './next.config.ts',
      './next.config.mjs',
      './next.config.mts',
      './next.config.cjs',
    ]);
    if (!nextConfigPath) {
      logger.error(
        createDiagnosticMessage({
          source: 'gt',
          severity: 'Error',
          whatHappened: 'No Next.js configuration file was found',
          fix: 'Add a next.config.js, next.config.ts, next.config.mjs, next.config.mts, or next.config.cjs file at the project root and rerun setup',
          docsUrl:
            'https://generaltranslation.com/docs/react/nextjs-pages-router-quickstart',
        })
      );
      exitSync(1);
    }

    if (frameworkType === 'next-app') {
      const mergeOptions = {
        ...options,
        disableIds: true,
        disableFormatting: true,
        skipTs: true,
        addGTProvider: true,
      };
      const spinner = logger.createSpinner();
      spinner.start('Wrapping JSX content with <T> tags...');
      // Wrap all JSX elements in the src directory with a <T> tag, with unique ids
      const { filesUpdated: filesUpdatedNext } = await wrapContentNext(
        mergeOptions,
        Libraries.GT_NEXT,
        errors,
        warnings
      );
      filesUpdated = [...filesUpdated, ...filesUpdatedNext];

      spinner.stop(
        chalk.green(
          `Success! Updated ${chalk.bold.cyan(filesUpdated.length)} files:\n`
        ) + filesUpdated.map((file) => `${chalk.green('-')} ${file}`).join('\n')
      );
    } else {
      const pagesDirectory = [
        path.join(process.cwd(), 'pages'),
        path.join(process.cwd(), 'src', 'pages'),
      ].find((candidate) => fs.existsSync(candidate));
      if (!pagesDirectory) {
        logger.error(
          createDiagnosticMessage({
            source: 'gt',
            severity: 'Error',
            whatHappened: 'No Pages Router directory was found',
            fix: 'Run the setup wizard from a Next.js project containing pages or src/pages',
            docsUrl:
              'https://generaltranslation.com/docs/react/nextjs-pages-router-quickstart',
          })
        );
        exitSync(1);
      }
      const { filesUpdated: pagesFilesUpdated } = await setupPagesRouter(
        pagesDirectory,
        errors,
        warnings,
        {
          hasStaticLocaleRouting: hasPagesRouterLocaleRouting(
            await fs.promises.readFile(nextConfigPath, 'utf8')
          ),
        }
      );
      filesUpdated = [...filesUpdated, ...pagesFilesUpdated];
      logger.step(
        chalk.green(
          `Configured ${chalk.bold.cyan(pagesFilesUpdated.length)} Pages Router files for gt-next.`
        )
      );
    }

    // Add the withGTConfig() function to the next.config.js file
    await handleInitGT(
      nextConfigPath,
      errors,
      warnings,
      filesUpdated,
      packageJson,
      tsconfigJson,
      gtConfigPath
    );
    logger.step(
      chalk.green(`Added withGTConfig() to your ${nextConfigPath} file.`)
    );
  }

  // Add gt compiler plugin
  if (frameworkType === 'vite') {
    await addVitePlugin({
      errors,
      warnings,
      filesUpdated,
      packageJson,
      tsconfigJson,
    });
  }

  if (errors.length > 0) {
    logger.error(chalk.red('Failed to write files:\n') + errors.join('\n'));
  }

  if (warnings.length > 0) {
    logger.warn(
      chalk.yellow('Warnings encountered:') +
        '\n' +
        warnings.map((warning) => `${chalk.yellow('-')} ${warning}`).join('\n')
    );
  }

  const formatter = await detectFormatter();

  if (!formatter || filesUpdated.length === 0) {
    return;
  }

  const applyFormatting = useDefaults
    ? true
    : await promptConfirm({
        message: `Would you like the wizard to auto-format the modified files? ${chalk.dim(
          `(${formatter})`
        )}`,
        defaultValue: true,
      });
  // Format updated files if formatters are available
  if (applyFormatting) await formatFiles(filesUpdated, formatter);
}
