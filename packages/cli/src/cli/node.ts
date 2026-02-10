import { Command } from 'commander';
import { BaseCLI } from './base.js';
import { SupportedLibraries, TranslateFlags, Options } from '../types/index.js';
import { attachInlineTranslateFlags, attachTranslateFlags } from './flags.js';
import { displayHeader, exitSync } from '../console/logging.js';
import { logger } from '../console/logger.js';
import findFilepath from '../fs/findFilepath.js';
import { intro } from '@clack/prompts';
import chalk from 'chalk';
import { resolveLocaleFiles } from '../fs/config/parseFilesConfig.js';
import { noFilesError } from '../console/index.js';
import { saveJSON } from '../fs/saveJSON.js';
import loadJSON from '../fs/loadJSON.js';
import { generateSettings } from '../config/generateSettings.js';
import { aggregateInlineTranslations } from '../translation/stage.js';
import { validateConfigExists } from '../config/validateSettings.js';
import { validateProject } from '../translation/validate.js';

const pkg = 'gt-node';

export class NodeCLI extends BaseCLI {
  constructor(
    command: Command,
    library: 'gt-node',
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, library, additionalModules);
  }

  protected setupStageCommand(): void {
    attachInlineTranslateFlags(
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
    attachInlineTranslateFlags(
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

  protected async handleGenerateSourceCommand(
    initOptions: TranslateFlags
  ): Promise<void> {
    const settings = await generateSettings(initOptions);

    const updates = await aggregateInlineTranslations(
      initOptions,
      settings,
      pkg
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
