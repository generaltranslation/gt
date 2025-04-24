import {
  WrapOptions,
  Options,
  Updates,
  SetupOptions,
  SupportedFrameworks,
  SupportedLibraries,
} from '../types';
import {
  logError,
  logInfo,
  logStep,
  logSuccess,
  logWarning,
  promptConfirm,
  promptSelect,
} from '../console/console';
import chalk from 'chalk';
import { detectFormatter, formatFiles } from '../hooks/postProcess';
import findFilepath from '../fs/findFilepath';
import scanForContent from '../next/parse/scanForContent';
import createInlineUpdates from '../react/parse/createInlineUpdates';
import handleInitGT from '../next/parse/handleInitGT';
import { ReactCLI } from './react';
import { generateSettings } from '../config/generateSettings';

const pkg = 'gt-next';

export class NextCLI extends ReactCLI {
  constructor(
    library: SupportedLibraries,
    additionalModules?: SupportedLibraries[]
  ) {
    super(library, additionalModules);
  }
  public init() {
    this.setupTranslateCommand();
    this.setupSetupCommand();
    this.setupScanCommand();
    this.setupGenerateSourceCommand();
  }
  public execute() {
    super.execute();
  }
  protected scanForContent(
    options: WrapOptions,
    framework: SupportedFrameworks
  ): Promise<{ errors: string[]; filesUpdated: string[]; warnings: string[] }> {
    return scanForContent(options, pkg, framework);
  }

  protected createInlineUpdates(
    options: Options
  ): Promise<{ updates: Updates; errors: string[] }> {
    return createInlineUpdates(options, pkg);
  }

  protected async handleSetupCommand(options: SetupOptions): Promise<void> {
    // Ask user for confirmation using inquirer
    const answer = await promptConfirm({
      message: chalk.yellow(
        `This operation will prepare your project for internationalization.
        Make sure you have committed or stashed any changes.
        Do you want to continue?`
      ),
      defaultValue: true,
    });

    if (!answer) {
      logInfo('Operation cancelled.');
      process.exit(0);
    }
    const routerType = await promptSelect({
      message: 'Are you using the Next.js App router or the Pages router?',
      options: [
        { value: 'app', label: 'App Router' },
        { value: 'pages', label: 'Pages Router' },
      ],
      defaultValue: 'app',
    });
    if (routerType === 'pages') {
      logError(
        'Please install gt-react instead. gt-next is currently not supported for the Pages router.'
      );
      process.exit(0);
    }
    const addGTProvider = await promptConfirm({
      message:
        'Do you want the setup tool to automatically add the GTProvider component?',
      defaultValue: true,
    });
    // Check if they have a next.config.js file
    const nextConfigPath = findFilepath([
      './next.config.js',
      './next.config.ts',
      './next.config.mjs',
      './next.config.mts',
    ]);
    if (!nextConfigPath) {
      logError('No next.config.[js|ts|mjs|mts] file found.');
      process.exit(0);
    }
    const addWithGTConfig = await promptConfirm({
      message: `Do you want to automatically add withGTConfig() to your ${nextConfigPath}?`,
      defaultValue: true,
    });
    const includeTId = await promptConfirm({
      message: 'Do you want to include an unique id for each <T> tag?',
      defaultValue: true,
    });

    // ----- Create a starter gt.config.json file -----
    generateSettings(options);

    // ----- //

    const mergeOptions = {
      ...options,
      disableIds: !includeTId,
      disableFormatting: true,
      addGTProvider,
    };

    // Wrap all JSX elements in the src directory with a <T> tag, with unique ids
    const { errors, filesUpdated, warnings } = await this.scanForContent(
      mergeOptions,
      'next-app'
    );

    if (addWithGTConfig) {
      // Add the withGTConfig() function to the next.config.js file
      const { errors: initGTErrors, filesUpdated: initGTFilesUpdated } =
        await handleInitGT(nextConfigPath);

      // merge errors and files
      errors.push(...initGTErrors);
      filesUpdated.push(...initGTFilesUpdated);
    }

    if (errors.length > 0) {
      logError(chalk.red('Failed to write files:\n') + errors.join('\n'));
    }

    logSuccess(
      chalk.green(
        `Success! Added <T> tags and updated ${chalk.bold.cyan(
          filesUpdated.length
        )} files:\n` +
          filesUpdated.map((file) => `${chalk.green('-')} ${file}`).join('\n')
      )
    );

    if (filesUpdated.length > 0) {
      logStep(chalk.green('Please verify the changes before committing.'));
    }

    if (warnings.length > 0) {
      logWarning(
        chalk.yellow('Warnings encountered:') +
          '\n' +
          warnings
            .map((warning) => `${chalk.yellow('-')} ${warning}`)
            .join('\n')
      );
    }
    // Stage only the modified files
    // const { execSync } = require('child_process');
    // for (const file of filesUpdated) {
    //   await execSync(`git add "${file}"`);
    // }

    const formatter = await detectFormatter();

    if (!formatter || filesUpdated.length === 0) {
      return;
    }

    const applyFormatting = await promptConfirm({
      message: `Would you like to auto-format the modified files? ${chalk.gray(
        `(${formatter})`
      )}`,
      defaultValue: true,
    });
    // Format updated files if formatters are available
    if (applyFormatting) await formatFiles(filesUpdated, formatter);
  }
}
