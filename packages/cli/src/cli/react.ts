// packages/gt-cli-core/src/BaseCLI.ts
import { program } from 'commander';
import {
  Options,
  SetupOptions,
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
  logInfo,
  logStep,
  logSuccess,
  logWarning,
  promptConfirm,
  promptSelect,
} from '../console/console';
import loadJSON from '../fs/loadJSON';
import findFilepath, { findFilepaths } from '../fs/findFilepath';
import createESBuildConfig from '../react/config/createESBuildConfig';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import chalk from 'chalk';
import { detectFormatter, formatFiles } from '../hooks/postProcess';
import { fetchTranslations } from '../api/fetchTranslations';
import path from 'path';
import { BaseCLI } from './base';
import scanForContentReact from '../react/parse/scanForContent';
import createDictionaryUpdates from '../react/parse/createDictionaryUpdates';
import createInlineUpdates from '../react/parse/createInlineUpdates';
import { resolveProjectId } from '../fs/utils';
import { sendUpdates } from '../api/sendUpdates';
import { saveTranslations } from '../formats/gt/save';
import { generateSettings } from '../config/generateSettings';
import { saveJSON } from '../fs/saveJSON';
import { resolveLocaleFiles } from '../fs/config/parseFilesConfig';
import fs from 'fs';
import { noFilesError } from '../console/errors';

const DEFAULT_TIMEOUT = 600;
const pkg = 'gt-react';

export class ReactCLI extends BaseCLI {
  constructor(
    library: SupportedLibraries,
    additionalModules?: SupportedLibraries[]
  ) {
    super(library, additionalModules);
  }
  public init() {
    this.setupTranslateCommand();
    this.setupScanCommand();
    this.setupGenerateSourceCommand();
  }
  public execute() {
    super.execute();
  }

  protected scanForContent(
    options: WrapOptions,
    framework: SupportedFrameworks,
    errors: string[],
    warnings: string[]
  ): Promise<{ filesUpdated: string[] }> {
    return scanForContentReact(options, pkg, framework, errors, warnings);
  }

  protected createDictionaryUpdates(
    options: Options,
    dictionaryPath: string,
    esbuildConfig?: any
  ): Promise<Updates> {
    return createDictionaryUpdates(options, dictionaryPath, esbuildConfig);
  }

  protected createInlineUpdates(
    options: Options
  ): Promise<{ updates: Updates; errors: string[] }> {
    return createInlineUpdates(options, pkg);
  }

  protected setupTranslateCommand(): void {
    program
      .command('translate')
      .description(
        'Scans the project for a dictionary and/or <T> tags, and updates the General Translation remote dictionary with the latest content.'
      )
      .option(
        '--config <path>',
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
        '--no-wait',
        'Do not wait for the updates to be deployed to the CDN before exiting',
        true // Default value of options.wait
      )
      .option(
        '--publish',
        'Publish updates to the CDN.',
        false // Default value of options.publish
      )
      .option(
        '-t, --translations-dir, --translation-dir <path>',
        'Path to directory where translations will be saved. If this flag is not provided, translations will not be saved locally.'
      )
      .option(
        '--timeout <seconds>',
        'Timeout in seconds for waiting for updates to be deployed to the CDN',
        DEFAULT_TIMEOUT.toString()
      )
      .action(async (options: Options) => {
        displayHeader('Translating project...');
        await this.handleTranslateCommand(options);
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
        '--config <path>',
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
    const settings = generateSettings(initOptions);

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
    const { updates, errors } = await this.createUpdates(
      options,
      options.dictionary
    );

    if (errors.length > 0) {
      if (options.ignoreErrors) {
        logWarning(
          chalk.red(
            `CLI tool encountered errors while scanning for ${chalk.green(
              '<T>'
            )} tags. These components will not be translated.\n` +
              errors
                .map((error) => chalk.yellow('• Warning: ') + error)
                .join('\n')
          )
        );
      } else {
        logError(
          chalk.red(
            `CLI tool encountered errors while scanning for ${chalk.green(
              '<T>'
            )} tags. ${chalk.gray('To ignore these errors, re-run with --ignore-errors')}\n` +
              errors.map((error) => chalk.red('• Error: ') + error).join('\n')
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

    const { placeholderPaths } = settings.files;
    // Save source file if files.json is provided
    if (placeholderPaths.gt) {
      const translationFiles = resolveLocaleFiles(
        placeholderPaths,
        settings.defaultLocale
      );
      if (!translationFiles.gt) {
        logError(noFilesError);
        process.exit(1);
      }
      saveJSON(translationFiles.gt, newData);
      logStep('Source file saved successfully!');
      // Also save translations (after merging with existing translations)
      for (const locale of settings.locales) {
        const translationsFile = resolveLocaleFiles(placeholderPaths, locale);

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
        saveJSON(translationsFile.gt, filteredTranslations);
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
    generateSettings(options);

    // ----- //
    const includeTId = await promptConfirm({
      message: 'Do you want to include an unique id for each <T> tag?',
      defaultValue: true,
    });
    options.disableIds = !includeTId;

    let errors: string[] = [];
    let warnings: string[] = [];
    // Wrap all JSX elements in the src directory with a <T> tag, with unique ids
    const { filesUpdated } = await this.scanForContent(
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

  protected async handleTranslateCommand(initOptions: Options): Promise<void> {
    const settings = generateSettings(initOptions);

    // First run the base class's handleTranslate method
    const options = { ...initOptions, ...settings };

    if (!options.dryRun) {
      try {
        await super.handleGenericTranslate(settings);
        // If the base class's handleTranslate completes successfully, continue with ReactCLI-specific code
      } catch (error) {
        // Continue with ReactCLI-specific code even if base handleTranslate failed
      }
    }

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

    let sourceFile: string | undefined;
    // If options.dictionary is provided, use options.dictionary as the source file
    if (options.dictionary) {
      sourceFile = options.dictionary;
    }

    // Separate defaultLocale from locales
    options.locales = options.locales.filter(
      (locale) => locale !== options.defaultLocale
    );

    // validate timeout
    const timeout = parseInt(options.timeout);
    if (isNaN(timeout) || timeout < 0) {
      logErrorAndExit(
        `Invalid timeout: ${options.timeout}. Must be a positive integer.`
      );
    }
    options.timeout = timeout.toString();
    // ---- CREATING UPDATES ---- //
    const { updates, errors } = await this.createUpdates(options, sourceFile);

    if (errors.length > 0) {
      if (options.ignoreErrors) {
        logWarning(
          chalk.red(
            `CLI tool encountered errors while scanning for ${chalk.green(
              '<T>'
            )} tags. These components will not be translated.\n` +
              errors
                .map((error) => chalk.yellow('• Warning: ') + error + '\n')
                .join('')
          )
        );
      } else {
        logError(
          chalk.red(
            `CLI tool encountered errors while scanning for ${chalk.green(
              '<T>'
            )} tags. ${chalk.gray('To ignore these errors, re-run with --ignore-errors')}\n` +
              errors
                .map((error) => chalk.red('• Error: ') + error + '\n')
                .join('')
          )
        );
      }
    }

    // If files.gt.output is not provided in the config, publish the translations
    if (!settings.files?.resolvedPaths?.gt) {
      options.publish = true;
    }

    if (options.dryRun) {
      logSuccess(
        'Dry run complete. No translations were sent to General Translation.'
      );
      process.exit(0);
    }

    // Send updates to General Translation API
    if (updates.length) {
      // Error if no API key at this point
      if (!settings.apiKey) {
        logError(
          chalk.red(
            'No General Translation API key found. Provide one via the --api-key flag or as the GT_API_KEY environment variable.'
          )
        );
        process.exit(1);
      }
      // Error if no projectId at this point
      if (!settings.projectId) {
        logError(
          chalk.red(
            'No General Translation Project ID found. Provide one via the --project-id flag, gt.config.json, or the GT_PROJECT_ID environment variable.'
          )
        );
        process.exit(1);
      }

      const updateResponse = await sendUpdates(
        updates,
        {
          ...settings,
          publish: options.publish,
          wait: options.wait,
          timeout: options.timeout,
          dataFormat: 'JSX',
        },
        this.library
      );
      const versionId = updateResponse?.versionId;

      // Save translations to local directory if files.gt.output is provided
      if (versionId && options.files.placeholderPaths.gt) {
        const translations = await fetchTranslations(
          settings.baseUrl,
          settings.apiKey,
          versionId
        );
        saveTranslations(translations, options.files.placeholderPaths, 'JSX');
      }
    } else {
      logError(
        chalk.red(
          `No in-line content or dictionaries were found for ${chalk.green(
            this.library
          )}. Are you sure you're running this command in the right directory?`
        )
      );
    }
  }

  protected async createUpdates(
    options: Options | GenerateSourceOptions,
    sourceDictionary: string | undefined
  ): Promise<{ updates: Updates; errors: string[] }> {
    let updates: Updates = [];
    let errors: string[] = [];

    // Parse dictionary with esbuildConfig
    if (
      sourceDictionary &&
      fs.existsSync(sourceDictionary) &&
      fs.statSync(sourceDictionary).isFile()
    ) {
      if (sourceDictionary.endsWith('.json')) {
        updates = [
          ...updates,
          ...(await this.createDictionaryUpdates(
            options as any,
            sourceDictionary
          )),
        ];
      } else {
        let esbuildConfig;
        if (options.jsconfig) {
          const jsconfig = loadJSON(options.jsconfig);
          if (!jsconfig) {
            logError(
              `Failed to resolve jsconfig.json or tsconfig.json at provided filepath: "${options.jsconfig}"`
            );
            process.exit(1);
          }
          esbuildConfig = createESBuildConfig(jsconfig);
        } else {
          esbuildConfig = createESBuildConfig({});
        }
        updates = [
          ...updates,
          ...(await this.createDictionaryUpdates(
            options as any,
            sourceDictionary,
            esbuildConfig
          )),
        ];
      }
    }
    // Scan through project for <T> tags
    if (options.inline) {
      const { updates: newUpdates, errors: newErrors } =
        await this.createInlineUpdates(options as any);
      errors = [...errors, ...newErrors];
      updates = [...updates, ...newUpdates];
    }

    // Metadata addition and validation
    const idHashMap = new Map<string, string>();
    const duplicateIds = new Set<string>();

    updates = updates.map((update) => {
      if (!update.metadata.id) return update;
      const existingHash = idHashMap.get(update.metadata.id);
      if (existingHash) {
        if (existingHash !== update.metadata.hash) {
          errors.push(
            `Hashes don't match on two components with the same id: ${chalk.blue(
              update.metadata.id
            )}. Check your ${chalk.green(
              '<T>'
            )} tags and dictionary entries and make sure you're not accidentally duplicating IDs.`
          );
          duplicateIds.add(update.metadata.id);
        }
      } else {
        idHashMap.set(update.metadata.id, update.metadata.hash);
      }
      return update;
    });

    // Filter out updates with duplicate IDs
    updates = updates.filter((update) => !duplicateIds.has(update.metadata.id));
    return { updates, errors };
  }
}
