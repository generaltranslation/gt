// packages/gt-cli-core/src/BaseCLI.ts
import { program } from 'commander';
import {
  Options,
  SupportedFrameworks,
  Updates,
  WrapOptions,
  GenerateSourceOptions,
  SupportedLibraries,
} from '../types';
import {
  displayHeader,
  endCommand,
  logError,
  logErrorAndExit,
  logStep,
  logSuccess,
  logWarning,
  promptConfirm,
} from '../console/console';
import loadJSON from '../fs/loadJSON';
import findFilepath, { findFilepaths } from '../fs/findFilepath';
import chalk from 'chalk';
import { formatFiles } from '../hooks/postProcess';
import { BaseCLI } from './base';
import wrapContentReact from '../react/parse/wrapContent';
import { resolveProjectId } from '../fs/utils';
import { generateSettings } from '../config/generateSettings';
import { saveJSON } from '../fs/saveJSON';
import { resolveLocaleFiles } from '../fs/config/parseFilesConfig';
import { noFilesError, noVersionIdError } from '../console/errors';
import { stageProject } from '../translation/stage';
import { createUpdates } from '../translation/parse';
import { translate } from '../translation/translate';
import updateConfig from '../fs/config/updateConfig';

const DEFAULT_TIMEOUT = 600;
const pkg = 'gt-react';

export class ReactCLI extends BaseCLI {
  constructor(
    library: 'gt-react' | 'gt-next',
    additionalModules?: SupportedLibraries[]
  ) {
    super(library, additionalModules);
  }
  public init() {
    this.setupStageCommand();
    this.setupTranslateCommand();
    this.setupScanCommand();
    this.setupGenerateSourceCommand();
  }
  public execute() {
    super.execute();
  }

  protected wrapContent(
    options: WrapOptions,
    framework: SupportedFrameworks,
    errors: string[],
    warnings: string[]
  ): Promise<{ filesUpdated: string[] }> {
    return wrapContentReact(options, pkg, framework, errors, warnings);
  }

  protected setupStageCommand(): void {
    program
      .command('stage')
      .description(
        'Submits the project to the General Translation API for translation. Translations created using this command will require human approval.'
      )
      .option(
        '-c, --config <path>',
        'Filepath to config file, by default gt.config.json',
        findFilepath(['gt.config.json'])
      )
      .option(
        '--api-key <key>',
        'API key for General Translation cloud service'
      )
      .option(
        '--project-id <id>',
        'Project ID for the translation service',
        resolveProjectId()
      )
      .option('--version-id <id>', 'Version ID for the translation service')
      .option(
        '--tsconfig, --jsconfig <path>',
        'Path to jsconfig or tsconfig file',
        findFilepath(['./tsconfig.json', './jsconfig.json'])
      )
      .option('--dictionary <path>', 'Path to dictionary file')
      .option(
        '--src <paths...>',
        "Filepath to directory containing the app's source code, by default ./src || ./app || ./pages || ./components"
      )
      .option(
        '--default-language, --default-locale <locale>',
        'Default locale (e.g., en)'
      )
      .option(
        '--new, --locales <locales...>',
        'Space-separated list of locales (e.g., en fr es)'
      )
      .option(
        '--inline',
        'Include inline <T> tags in addition to dictionary file',
        true
      )
      .option(
        '--ignore-errors',
        'Ignore errors encountered while scanning for <T> tags',
        false
      )
      .option(
        '--dry-run',
        'Dry run, does not send updates to General Translation API',
        false
      )
      .option(
        '--timeout <seconds>',
        'Timeout in seconds for waiting for updates to be deployed to the CDN',
        DEFAULT_TIMEOUT.toString()
      )
      .action(async (options: Options) => {
        displayHeader('Staging project for translation with approval...');
        await this.handleStage(options);
        endCommand('Done!');
      });
  }

  protected setupTranslateCommand(): void {
    program
      .command('translate')
      .description(
        'Scans the project for a dictionary and/or <T> tags, and sends the updates to the General Translation API for translation.'
      )
      .option(
        '-c, --config <path>',
        'Filepath to config file, by default gt.config.json',
        findFilepath(['gt.config.json'])
      )
      .option(
        '--api-key <key>',
        'API key for General Translation cloud service'
      )
      .option(
        '--project-id <id>',
        'Project ID for the translation service',
        resolveProjectId()
      )
      .option('--version-id <id>', 'Version ID for the translation service')
      .option(
        '--tsconfig, --jsconfig <path>',
        'Path to jsconfig or tsconfig file',
        findFilepath(['./tsconfig.json', './jsconfig.json'])
      )
      .option('--dictionary <path>', 'Path to dictionary file')
      .option(
        '--src <paths...>',
        "Filepath to directory containing the app's source code, by default ./src || ./app || ./pages || ./components"
      )
      .option(
        '--default-language, --default-locale <locale>',
        'Default locale (e.g., en)'
      )
      .option(
        '--new, --locales <locales...>',
        'Space-separated list of locales (e.g., en fr es)'
      )
      .option(
        '--inline',
        'Include inline <T> tags in addition to dictionary file',
        true
      )
      .option(
        '--ignore-errors',
        'Ignore errors encountered while scanning for <T> tags',
        false
      )
      .option(
        '--dry-run',
        'Dry run, does not send updates to General Translation API',
        false
      )
      .option(
        '--timeout <seconds>',
        'Timeout in seconds for waiting for updates to be deployed to the CDN',
        DEFAULT_TIMEOUT.toString()
      )
      .action(async (options: Options) => {
        displayHeader('Translating project...');
        await this.handleTranslate(options);
        endCommand('Done!');
      });
  }

  protected setupGenerateSourceCommand(): void {
    program
      .command('generate')
      .description(
        'Generate a translation file for the source locale. The -t flag must be provided. This command should be used if you are handling your own translations.'
      )
      .option(
        '--src <paths...>',
        "Filepath to directory containing the app's source code, by default ./src || ./app || ./pages || ./components"
      )
      .option(
        '--tsconfig, --jsconfig <path>',
        'Path to jsconfig or tsconfig file',
        findFilepath(['./tsconfig.json', './jsconfig.json'])
      )
      .option('--dictionary <path>', 'Path to dictionary file')
      .option(
        '--default-language, --default-locale <locale>',
        'Source locale (e.g., en)'
      )
      .option(
        '--inline',
        'Include inline <T> tags in addition to dictionary file',
        true
      )
      .option(
        '--ignore-errors',
        'Ignore errors encountered while scanning for <T> tags',
        false
      )
      .option(
        '-t, --translations-dir, --translation-dir <path>',
        'Path to directory where translations will be saved. If this flag is not provided, translations will not be saved locally.'
      )
      .action(async (options: GenerateSourceOptions) => {
        displayHeader('Generating source templates...');
        await this.handleGenerateSourceCommand(options);
        endCommand('Done!');
      });
  }

  protected setupScanCommand(): void {
    program
      .command('scan')
      .description(
        'Scans the project and wraps all JSX elements in the src directory with a <T> tag, with unique ids'
      )
      .option(
        '--src <paths...>',
        "Filepath to directory containing the app's source code, by default ./src || ./app || ./pages || ./components",
        findFilepaths(['./src', './app', './pages', './components'])
      )
      .option(
        '-c, --config <path>',
        'Filepath to config file, by default gt.config.json',
        findFilepath(['gt.config.json'])
      )
      .option('--disable-ids', 'Disable id generation for the <T> tags', false)
      .option(
        '--disable-formatting',
        'Disable formatting of edited files',
        false
      )
      .action(async (options: WrapOptions) => {
        displayHeader('Scanning project...');
        await this.handleScanCommand(options);
        endCommand('Done!');
      });
  }

  protected async handleGenerateSourceCommand(
    initOptions: GenerateSourceOptions
  ): Promise<void> {
    const settings = await generateSettings(initOptions);

    const options = { ...initOptions, ...settings };

    if (!options.dictionary) {
      options.dictionary = findFilepath([
        './dictionary.js',
        './src/dictionary.js',
        './dictionary.json',
        './src/dictionary.json',
        './dictionary.ts',
        './src/dictionary.ts',
      ]);
    }

    // User has to provide a dictionary file
    // will not read from settings.files.resolvedPaths.json
    const { updates, errors } = await createUpdates(
      options,
      options.dictionary,
      this.library === 'gt-next' ? 'gt-next' : 'gt-react'
    );

    if (errors.length > 0) {
      if (options.ignoreErrors) {
        logWarning(
          chalk.yellow(
            `CLI tool encountered errors while scanning for translatable content. These components will not be translated.\n` +
              errors
                .map(
                  (error) => chalk.yellow('• Warning: ') + chalk.white(error)
                )
                .join('\n')
          )
        );
      } else {
        logErrorAndExit(
          chalk.red(
            `CLI tool encountered errors while scanning for translatable content. ${chalk.gray('To ignore these errors, re-run with --ignore-errors')}\n` +
              errors
                .map((error) => chalk.red('• Error: ') + chalk.white(error))
                .join('\n')
          )
        );
      }
    }
    // Convert updates to the proper data format
    const newData: Record<string, any> = {};
    for (const update of updates) {
      const { source, metadata } = update;
      const { hash, id } = metadata;
      if (id) {
        newData[id] = source;
      } else {
        newData[hash] = source;
      }
    }

    // Save source file if files.json is provided
    if (settings.files && settings.files.placeholderPaths.gt) {
      const translationFiles = resolveLocaleFiles(
        settings.files.placeholderPaths,
        settings.defaultLocale
      );
      if (!translationFiles.gt) {
        logError(noFilesError);
        process.exit(1);
      }
      await saveJSON(translationFiles.gt, newData);
      logStep('Source file saved successfully!');
      // Also save translations (after merging with existing translations)
      for (const locale of settings.locales) {
        const translationsFile = resolveLocaleFiles(
          settings.files.placeholderPaths,
          locale
        );

        if (!translationsFile.gt) {
          continue;
        }
        const existingTranslations = loadJSON(translationsFile.gt);
        const mergedTranslations = {
          ...newData,
          ...existingTranslations,
        };
        // Filter out keys that don't exist in newData
        const filteredTranslations = Object.fromEntries(
          Object.entries(mergedTranslations).filter(([key]) => newData[key])
        );
        await saveJSON(translationsFile.gt, filteredTranslations);
      }
      logStep('Merged translations successfully!');
    }
  }

  protected async handleScanCommand(options: WrapOptions): Promise<void> {
    // Ask user for confirmation using inquirer
    const answer = await promptConfirm({
      message: chalk.yellow(
        'Warning: This operation will modify your source files! Make sure you have committed or stashed your current changes. Do you want to continue?'
      ),
      defaultValue: true,
    });

    if (!answer) {
      logError('Operation cancelled.');
      process.exit(0);
    }

    // ----- Create a starter gt.config.json file -----
    await generateSettings(options);

    // ----- //
    const includeTId = await promptConfirm({
      message: 'Do you want to include an unique id for each <T> tag?',
      defaultValue: true,
    });
    options.disableIds = !includeTId;

    let errors: string[] = [];
    let warnings: string[] = [];
    // Wrap all JSX elements in the src directory with a <T> tag, with unique ids
    const { filesUpdated } = await this.wrapContent(
      options,
      'react',
      errors,
      warnings
    );

    if (errors.length > 0) {
      logError(chalk.red('Failed to write files:\n') + errors.join('\n'));
    }

    // Format updated files if formatters are available
    if (!options.disableFormatting) await formatFiles(filesUpdated);

    logSuccess(
      `Success! Added <T> tags and updated ${chalk.bold.cyan(
        filesUpdated.length
      )} files:\n` +
        filesUpdated.map((file) => `${chalk.green('-')} ${file}`).join('\n')
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
  }

  protected async handleStage(initOptions: Options): Promise<void> {
    const settings = await generateSettings(initOptions);

    // First run the base class's handleTranslate method
    const options = { ...initOptions, ...settings };
    if (!settings.stageTranslations) {
      // Update settings.stageTranslations to true
      settings.stageTranslations = true;
      await updateConfig({
        configFilepath: options.config,
        stageTranslations: true,
      });
    }
    const pkg = this.library === 'gt-next' ? 'gt-next' : 'gt-react';
    await stageProject(options, pkg);
  }

  protected async handleTranslate(initOptions: Options): Promise<void> {
    const settings = await generateSettings(initOptions);

    // First run the base class's handleTranslate method
    const options = { ...initOptions, ...settings };

    try {
      await super.handleGenericTranslate(options);
      // If the base class's handleTranslate completes successfully, continue with ReactCLI-specific code
    } catch (error) {
      // Continue with ReactCLI-specific code even if base handleTranslate failed
    }

    if (!settings.stageTranslations) {
      // If stageTranslations is false, stage the project
      const pkg = this.library === 'gt-next' ? 'gt-next' : 'gt-react';
      const results = await stageProject(options, pkg);
      if (results) {
        await translate(options, results.versionId);
      }
    } else {
      if (!settings._versionId) {
        logError(noVersionIdError);
        process.exit(1);
      }
      await translate(options, settings._versionId);
    }
  }
}
