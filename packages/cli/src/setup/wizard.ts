import { detectFormatter } from '../hooks/postProcess.js';
import { createSpinner, logMessage, promptSelect } from '../console/logging.js';
import {
  logInfo,
  logError,
  logSuccess,
  logStep,
  logWarning,
} from '../console/logging.js';
import chalk from 'chalk';
import { promptConfirm } from '../console/logging.js';
import { SetupOptions, SupportedFrameworks } from '../types/index.js';
import findFilepath from '../fs/findFilepath.js';
import { formatFiles } from '../hooks/postProcess.js';
import { handleInitGT } from '../next/parse/handleInitGT.js';
import { getPackageJson, isPackageInstalled } from '../utils/packageJson.js';
import { wrapContentReact } from '../react/parse/wrapContent.js';
import { wrapContentNext } from '../next/parse/wrapContent.js';
import { getPackageManager } from '../utils/packageManager.js';
import { installPackage } from '../utils/installPackage.js';
import { createOrUpdateConfig } from '../fs/config/setupConfig.js';

export async function handleSetupReactCommand(
  options: SetupOptions
): Promise<void> {
  // Ask user for confirmation using inquirer
  const answer = await promptConfirm({
    message: chalk.yellow(
      `This wizard will configure your React project for internationalization with GT.
If your project is already using a different i18n library, this wizard may cause issues.

Make sure you have committed or stashed any changes. Do you want to continue?`
    ),
    defaultValue: true,
    cancelMessage:
      'Operation cancelled. You can re-run this wizard with: npx gtx-cli setup',
  });
  if (!answer) {
    logInfo(
      'Operation cancelled. You can re-run this wizard with: npx gtx-cli setup'
    );
    process.exit(0);
  }

  const frameworkType = await promptSelect<SupportedFrameworks | 'other'>({
    message: 'What framework are you using?',
    options: [
      { value: 'next-app', label: chalk.blue('Next.js App Router') },
      { value: 'next-pages', label: chalk.green('Next.js Pages Router') },
      { value: 'vite', label: chalk.cyan('Vite + React') },
      { value: 'gatsby', label: chalk.magenta('Gatsby') },
      { value: 'react', label: chalk.yellow('React') },
      { value: 'redwood', label: chalk.red('RedwoodJS') },
      { value: 'other', label: chalk.dim('Other') },
    ],
    defaultValue: 'next-app',
  });
  if (frameworkType === 'other') {
    logError(
      `Sorry, other React frameworks are not currently supported. 
Please let us know what you would like to see supported at https://github.com/generaltranslation/gt/issues`
    );
    process.exit(0);
  }

  // ----- Create a starter gt.config.json file -----
  await createOrUpdateConfig(options.config || 'gt.config.json', {
    framework: frameworkType as SupportedFrameworks,
  });

  const packageJson = await getPackageJson();
  // Check if gt-next or gt-react is installed
  if (
    frameworkType === 'next-app' &&
    !isPackageInstalled('gt-next', packageJson)
  ) {
    const packageManager = await getPackageManager();
    const spinner = createSpinner('timer');
    spinner.start(`Installing gt-next with ${packageManager.name}...`);
    await installPackage('gt-next', packageManager);
    spinner.stop(chalk.green('Automatically installed gt-next.'));
  } else if (
    ['next-pages', 'react', 'redwood', 'vite', 'gatsby'].includes(
      frameworkType
    ) &&
    !isPackageInstalled('gt-react', packageJson)
  ) {
    const packageManager = await getPackageManager();
    const spinner = createSpinner('timer');
    spinner.start(`Installing gt-react with ${packageManager.name}...`);
    await installPackage('gt-react', packageManager);
    spinner.stop(chalk.green('Automatically installed gt-react.'));
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  let filesUpdated: string[] = [];

  if (frameworkType === 'next-app') {
    // Check if they have a next.config.js file
    const nextConfigPath = findFilepath([
      './next.config.js',
      './next.config.ts',
      './next.config.mjs',
      './next.config.mts',
    ]);
    if (!nextConfigPath) {
      logError('No next.config.[js|ts|mjs|mts] file found.');
      process.exit(1);
    }

    const addGTProvider = await promptConfirm({
      message:
        'Do you want the setup wizard to automatically add the GTProvider component?',
      defaultValue: true,
    });

    const addWithGTConfig = await promptConfirm({
      message: `Do you want to automatically add withGTConfig() to your ${nextConfigPath}?`,
      defaultValue: true,
    });
    const includeTId = await promptConfirm({
      message: 'Do you want to include an unique id for each <T> tag?',
      defaultValue: true,
    });
    const mergeOptions = {
      ...options,
      disableIds: !includeTId,
      disableFormatting: true,
      skipTs: false,
      addGTProvider,
    };
    const spinner = createSpinner();
    spinner.start('Wrapping JSX content with <T> tags...');
    // Wrap all JSX elements in the src directory with a <T> tag, with unique ids
    const { filesUpdated: filesUpdatedNext } = await wrapContentNext(
      mergeOptions,
      'gt-next',
      errors,
      warnings
    );
    filesUpdated = [...filesUpdated, ...filesUpdatedNext];

    spinner.stop(
      chalk.green(
        `Success! Added <T> tags and updated ${chalk.bold.cyan(
          filesUpdated.length
        )} files:\n`
      ) + filesUpdated.map((file) => `${chalk.green('-')} ${file}`).join('\n')
    );

    if (addWithGTConfig) {
      // Add the withGTConfig() function to the next.config.js file
      await handleInitGT(nextConfigPath, errors, warnings, filesUpdated);
      logStep(
        chalk.green(`Added withGTConfig() to your ${nextConfigPath} file.`)
      );
    }

    if (errors.length > 0) {
      logError(chalk.red('Failed to write files:\n') + errors.join('\n'));
    }

    logSuccess(
      chalk.green(
        `Success! All JSX content has been wrapped with <T> tags${
          includeTId ? ' and unique ids.' : '.'
        }`
      )
    );
    logMessage(
      `To translate strings, see the docs on useGT and getGT: https://generaltranslation.com/docs/next/api/strings/getGT`
    );
  } else {
    let addGTProvider = false;
    if (frameworkType === 'next-pages') {
      addGTProvider = await promptConfirm({
        message:
          'Do you want the setup wizard to automatically add the GTProvider component?',
        defaultValue: true,
      });
    }

    const includeTId = await promptConfirm({
      message: 'Do you want to include an unique id for each <T> tag?',
      defaultValue: true,
    });

    const mergeOptions = {
      ...options,
      disableIds: !includeTId,
      disableFormatting: true,
      skipTs: false,
      addGTProvider,
    };
    const spinner = createSpinner();
    spinner.start('Wrapping JSX content with <T> tags...');
    // Wrap all JSX elements in the src directory with a <T> tag, with unique ids
    const { filesUpdated: filesUpdatedReact } = await wrapContentReact(
      mergeOptions,
      'gt-react',
      frameworkType,
      errors,
      warnings
    );
    filesUpdated = [...filesUpdated, ...filesUpdatedReact];
    spinner.stop(
      chalk.green(
        `Success! Added <T> tags and updated ${chalk.bold.cyan(
          filesUpdated.length
        )} files:\n`
      ) + filesUpdated.map((file) => `${chalk.green('-')} ${file}`).join('\n')
    );

    if (errors.length > 0) {
      logError(chalk.red('Failed to write files:\n') + errors.join('\n'));
    }

    logSuccess(
      chalk.green(
        `Success! All JSX content has been wrapped with <T> tags${
          includeTId ? ' and unique ids.' : '.'
        }`
      )
    );
    logMessage(
      `To translate strings, see the docs on useGT: https://generaltranslation.com/docs/react/api/strings/useGT`
    );
  }

  if (warnings.length > 0) {
    logWarning(
      chalk.yellow('Warnings encountered:') +
        '\n' +
        warnings.map((warning) => `${chalk.yellow('-')} ${warning}`).join('\n')
    );
  }

  const formatter = await detectFormatter();

  if (!formatter || filesUpdated.length === 0) {
    return;
  }

  const applyFormatting = await promptConfirm({
    message: `Would you like the wizard to auto-format the modified files? ${chalk.dim(
      `(${formatter})`
    )}`,
    defaultValue: true,
  });
  // Format updated files if formatters are available
  if (applyFormatting) await formatFiles(filesUpdated, formatter);
}
