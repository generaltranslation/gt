import { Command } from 'commander';
import { BaseCLI } from './base.js';
import { SupportedLibraries, TranslateFlags, Options } from '../types/index.js';
import {
  attachInlineTranslateFlags,
  attachTranslateFlags,
  attachValidateFlags,
} from './flags.js';
import { displayHeader, exitSync } from '../console/logging.js';
import { logger } from '../console/logger.js';
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

/**
 * Stand in for a CLI tool that does any sort of inline content translations
 */
export class InlineCLI extends BaseCLI {
  constructor(
    command: Command,
    library: 'gt-react' | 'gt-next' | 'gt-node',
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
            'Scans the project for a dictionary and inline translations and sends the updates to the General Translation API for translation.'
          )
      )
    ).action(async (options: TranslateFlags) => {
      displayHeader('Translating project...');
      await this.handleTranslate(options);
      logger.endCommand('Done!');
    });
  }

  protected setupValidateCommand(): void {
    attachValidateFlags(
      this.program
        .command('validate [files...]')
        .description(
          'Scans the project for a dictionary and/or inline content and validates the project for errors.'
        )
    ).action(async (files: string[], options: Options) => {
      // intro here since we don't want to show the ascii title
      intro(chalk.cyan('Validating project...'));
      await this.handleValidate(options, files);
      logger.endCommand('Done!');
    });
  }

  protected setupGenerateSourceCommand(): void {
    attachInlineTranslateFlags(
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

    const updates = await aggregateInlineTranslations(
      initOptions,
      settings,
      fallbackToGtReact(this.library)
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

    // Fallback to gt-react
    const pkg = fallbackToGtReact(this.library);

    if (files && files.length > 0) {
      // Validate specific files using createInlineUpdates
      await validateProject(options, pkg, files);
    } else {
      // Validate whole project as before
      await validateProject(options, pkg);
    }
  }
}

function fallbackToGtReact(
  library: SupportedLibraries
): 'gt-next' | 'gt-react' | 'gt-node' {
  return ['gt-next', 'gt-node'].includes(library)
    ? (library as 'gt-next' | 'gt-node')
    : 'gt-react';
}
