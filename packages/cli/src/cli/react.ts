import { Command } from 'commander';
import {
  Options,
  SupportedFrameworks,
  WrapOptions,
  GenerateSourceOptions,
  SupportedLibraries,
  TranslateFlags,
} from '../types/index.js';
import { displayHeader, exitSync, promptConfirm } from '../console/logging.js';
import { logger } from '../console/logger.js';
import loadJSON from '../fs/loadJSON.js';
import findFilepath from '../fs/findFilepath.js';
import chalk from 'chalk';
import { formatFiles } from '../hooks/postProcess.js';
import { BaseCLI } from './base.js';
import { wrapContentReact } from '../react/parse/wrapContent.js';
import { generateSettings } from '../config/generateSettings.js';
import { saveJSON } from '../fs/saveJSON.js';
import { resolveLocaleFiles } from '../fs/config/parseFilesConfig.js';
import { noFilesError } from '../console/index.js';
import { aggregateReactTranslations } from '../translation/stage.js';
import { validateConfigExists } from '../config/validateSettings.js';
import { validateProject } from '../translation/validate.js';
import { intro } from '@clack/prompts';
import {
  attachAdditionalReactTranslateFlags,
  attachTranslateFlags,
} from './flags.js';

const pkg = 'gt-react';

export class ReactCLI extends BaseCLI {
  constructor(
    command: Command,
    library: 'gt-react' | 'gt-next',
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, library, additionalModules);
  }
  public init() {
    this.setupStageCommand();
    this.setupTranslateCommand();
    this.setupGenerateSourceCommand();
    this.setupValidateCommand();
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
    attachAdditionalReactTranslateFlags(
      attachTranslateFlags(
        this.program
          .command('stage')
          .description(
            'Submits the project to the General Translation API for translation. Translations created using this command will require human approval.'
          )
      )
    ).action(async (options: TranslateFlags) => {
      displayHeader(
        'Staging project for translation with approval required...'
      );
      await this.handleStage(options);
      logger.endCommand('Done!');
    });
  }

  protected setupTranslateCommand(): void {
    attachAdditionalReactTranslateFlags(
      attachTranslateFlags(
        this.program
          .command('translate')
          .description(
            'Scans the project for a dictionary and/or <T> tags, and sends the updates to the General Translation API for translation.'
          )
      )
    ).action(async (options: TranslateFlags) => {
      displayHeader('Translating project...');
      await this.handleTranslate(options);
      logger.endCommand('Done!');
    });
  }

  protected setupValidateCommand(): void {
    this.program
      .command('validate [files...]')
      .description(
        'Scans the project for a dictionary and/or <T> tags, and validates the project for errors.'
      )
      .option(
        '-c, --config <path>',
        'Filepath to config file, by default gt.config.json',
        findFilepath(['gt.config.json'])
      )
      .option(
        '--tsconfig, --jsconfig <path>',
        'Path to jsconfig or tsconfig file',
        findFilepath(['./tsconfig.json', './jsconfig.json'])
      )
      .option('--dictionary <path>', 'Path to dictionary file')
      .option(
        '--src <paths...>',
        "Space-separated list of glob patterns containing the app's source code, by default 'src/**/*.{js,jsx,ts,tsx}' 'app/**/*.{js,jsx,ts,tsx}' 'pages/**/*.{js,jsx,ts,tsx}' 'components/**/*.{js,jsx,ts,tsx}'"
      )
      .option(
        '--inline',
        'Include inline <T> tags in addition to dictionary file',
        true
      )
      .action(async (files: string[], options: Options) => {
        // intro here since we don't want to show the ascii title
        intro(chalk.cyan('Validating project...'));
        await this.handleValidate(options, files);
        logger.endCommand('Done!');
      });
  }

  protected setupGenerateSourceCommand(): void {
    attachAdditionalReactTranslateFlags(
      attachTranslateFlags(
        this.program
          .command('generate')
          .description(
            'Generate a translation file for the source locale. This command should be used if you are handling your own translations.'
          )
      )
    ).action(async (initOptions: TranslateFlags) => {
      displayHeader('Generating source templates...');
      await this.handleGenerateSourceCommand(initOptions);
      logger.endCommand('Done!');
    });
  }

  protected async handleGenerateSourceCommand(
    initOptions: TranslateFlags
  ): Promise<void> {
    const settings = await generateSettings(initOptions);

    const updates = await aggregateReactTranslations(
      initOptions,
      settings,
      this.library === 'gt-next' ? 'gt-next' : 'gt-react'
    );

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
        logger.error(noFilesError);
        exitSync(1);
      }
      await saveJSON(translationFiles.gt, newData);
      logger.step('Source file saved successfully!');
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
      logger.step('Merged translations successfully!');
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
      logger.error('Operation cancelled.');
      exitSync(0);
    }

    // ----- Create a starter gt.config.json file -----
    await generateSettings(options);

    // ----- //
    const includeTId = await promptConfirm({
      message: 'Do you want to include an unique id for each <T> tag?',
      defaultValue: true,
    });
    options.disableIds = !includeTId;

    const errors: string[] = [];
    const warnings: string[] = [];
    // Wrap all JSX elements in the src directory with a <T> tag, with unique ids
    const { filesUpdated } = await this.wrapContent(
      options,
      'react',
      errors,
      warnings
    );

    if (errors.length > 0) {
      logger.error(chalk.red('Failed to write files:\n') + errors.join('\n'));
    }

    // Format updated files if formatters are available
    if (!options.disableFormatting) await formatFiles(filesUpdated);

    logger.success(
      `Success! Added <T> tags and updated ${chalk.bold.cyan(
        filesUpdated.length
      )} files:\n` +
        filesUpdated.map((file) => `${chalk.green('-')} ${file}`).join('\n')
    );
    if (filesUpdated.length > 0) {
      logger.step(chalk.green('Please verify the changes before committing.'));
    }

    if (warnings.length > 0) {
      logger.warn(
        chalk.yellow('Warnings encountered:') +
          '\n' +
          warnings
            .map((warning) => `${chalk.yellow('-')} ${warning}`)
            .join('\n')
      );
    }
  }

  protected async handleValidate(
    initOptions: Options,
    files?: string[]
  ): Promise<void> {
    validateConfigExists();
    const settings = await generateSettings(initOptions);

    // First run the base class's handleTranslate method
    const options = { ...initOptions, ...settings };

    const pkg = this.library === 'gt-next' ? 'gt-next' : 'gt-react';

    if (files && files.length > 0) {
      // Validate specific files using createInlineUpdates
      await validateProject(options, pkg, files);
    } else {
      // Validate whole project as before
      await validateProject(options, pkg);
    }
  }
}
