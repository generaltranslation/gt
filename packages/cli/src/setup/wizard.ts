import { detectFormatter } from '../hooks/postProcess.js';
import { createSpinner, promptSelect } from '../console/logging.js';
import { logInfo, logError, logStep, logWarning } from '../console/logging.js';
import chalk from 'chalk';
import { promptConfirm } from '../console/logging.js';
import { SetupOptions, SupportedFrameworks } from '../types/index.js';
import findFilepath from '../fs/findFilepath.js';
import { formatFiles } from '../hooks/postProcess.js';
import { handleInitGT } from '../next/parse/handleInitGT.js';
import { handleInitGT as handleInitGTReactNative } from '../react-native/parse/handleInitGT.js';
import { getPackageJson, isPackageInstalled } from '../utils/packageJson.js';
import { wrapContentNext } from '../next/parse/wrapContent.js';
import { wrapContentReactNative } from '../react-native/parse/wrapContent.js';
import { getPackageManager } from '../utils/packageManager.js';
import { installPackage } from '../utils/installPackage.js';
import { createOrUpdateConfig } from '../fs/config/setupConfig.js';
import { loadConfig } from '../fs/config/loadConfig.js';
import { addVitePlugin } from '../react/parse/addVitePlugin/index.js';
import { detectEntryPoint } from '../react-native/utils/detectEntryPoint.js';
import path from 'node:path';

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
      { value: 'expo', label: chalk.magenta('Expo (React Native)') },
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
  if (!packageJson) {
    logError(
      chalk.red(
        'No package.json found in the current directory. Please run this command from the root of your project.'
      )
    );
    process.exit(1);
  }
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
  } else if (
    frameworkType === 'expo' &&
    !isPackageInstalled('gt-react-native', packageJson)
  ) {
    const packageManager = await getPackageManager();
    const spinner = createSpinner('timer');
    spinner.start(`Installing gt-react-native with ${packageManager.name}...`);
    await installPackage('gt-react-native', packageManager);
    spinner.stop(chalk.green('Automatically installed gt-react-native.'));
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  let filesUpdated: string[] = [];

  // Read tsconfig.json if it exists
  const tsconfigPath = findFilepath(['tsconfig.json']);
  const tsconfigJson = tsconfigPath ? loadConfig(tsconfigPath) : undefined;

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

    const mergeOptions = {
      ...options,
      disableIds: true,
      disableFormatting: true,
      skipTs: true,
      addGTProvider: true,
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
        `Success! Updated ${chalk.bold.cyan(filesUpdated.length)} files:\n`
      ) + filesUpdated.map((file) => `${chalk.green('-')} ${file}`).join('\n')
    );

    // Add the withGTConfig() function to the next.config.js file
    await handleInitGT(
      nextConfigPath,
      errors,
      warnings,
      filesUpdated,
      packageJson,
      tsconfigJson
    );
    logStep(
      chalk.green(`Added withGTConfig() to your ${nextConfigPath} file.`)
    );
  }

  // Handle Expo (React Native) setup
  if (frameworkType === 'expo') {
    const appRoot = process.cwd();
    const babelConfigPath = path.resolve(appRoot, 'babel.config.js');
    const indexPath = path.resolve(appRoot, 'index.js');

    const mergeOptions = {
      ...options,
      disableIds: true,
      disableFormatting: true,
      skipTs: true,
      addGTProvider: true,
    };

    const spinner = createSpinner();
    spinner.start('Setting up Expo project for GT...');

    // Detect entry point before initialization
    const detection = detectEntryPoint(appRoot);

    // Initialize Expo setup (babel.config.js, index.js, package.json)
    await handleInitGTReactNative(
      babelConfigPath,
      indexPath,
      appRoot,
      errors,
      warnings,
      filesUpdated,
      detection
    );

    spinner.stop(
      chalk.green(
        `Configured babel.config.js for GT using entry point: ${chalk.cyan(detection.entryPoint)}`
      )
    );

    // Wrap JSX content with <T> tags
    const spinner2 = createSpinner();
    spinner2.start('Wrapping JSX content with <T> tags...');
    const { filesUpdated: filesUpdatedRN } = await wrapContentReactNative(
      mergeOptions,
      'gt-react-native',
      'expo',
      errors,
      warnings
    );
    filesUpdated = [...filesUpdated, ...filesUpdatedRN];

    spinner2.stop(
      chalk.green(
        `Success! Updated ${chalk.bold.cyan(filesUpdated.length)} files:\n`
      ) + filesUpdated.map((file) => `${chalk.green('-')} ${file}`).join('\n')
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
    logError(chalk.red('Failed to write files:\n') + errors.join('\n'));
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
