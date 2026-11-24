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
import { resolveLocaleFiles } from '../fs/config/parseFilesConfig.js';
import { noFilesError } from '../console/index.js';
import { saveJSON } from '../fs/saveJSON.js';
import { loadJSON } from '../fs/loadJSON.js';
import { generateSettings } from '../config/generateSettings.js';
import { aggregateInlineTranslations } from '../translation/stage.js';
import { validateProject } from '../translation/validate.js';
import { Libraries, InlineLibrary } from '../types/libraries.js';
import { collectSourceMetadata } from '../translation/sourceMetadata.js';

type GenerateSourceFlags = TranslateFlags & {
  sourceOnly?: boolean;
  metadata?: string;
};

/**
 * Stand in for a CLI tool that does any sort of inline content translations
 */
export class InlineCLI extends BaseCLI {
  constructor(
    command: Command,
    library: SupportedLibraries,
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, library, additionalModules);
  }
  public init() {
    this.setupStageCommand();
    this.setupTranslateCommand();
    this.setupGenerateSourceCommand();
    this.setupValidateCommand();
    this.setupDownloadCommand();
    this.setupEnqueueCommand();
  }

  /** Allows framework adapters to describe their own default source scope. */
  protected getInlineSourceHelp(): string | undefined {
    return undefined;
  }

  /** Returns the inline parser used by generate and targeted validation. */
  protected getInlineLibrary(): InlineLibrary {
    return fallbackToGtReact(this.library);
  }

  protected setupStageCommand(): void {
    attachInlineTranslateFlags(
      attachTranslateFlags(
        this.program
          .command('stage')
          .description(
            'Submits the project to the General Translation API for translation. Translations created using this command will require human approval.'
          )
      ),
      this.getInlineSourceHelp()
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
      ),
      this.getInlineSourceHelp()
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
        ),
      this.getInlineSourceHelp()
    ).action(async (files: string[], options: Options) => {
      // startCommand here since we don't want to show the ascii title; it
      // renders the same intro while honoring --quiet.
      logger.startCommand('Validating project...');
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
          .option(
            '--source-only',
            'Write only the source locale file and leave target locale files unchanged',
            false
          )
          .option(
            '--metadata <path>',
            "Also write each entry's metadata (dataFormat, id, context, maxChars, requiresReview, filePaths) to this JSON file, keyed by the same hashes as the source file"
          )
      ),
      this.getInlineSourceHelp()
    ).action(async (initOptions: GenerateSourceFlags) => {
      displayHeader('Generating source templates...');
      await this.handleGenerateSourceCommand(initOptions);
      logger.endCommand('Done!');
    });
  }

  protected async handleGenerateSourceCommand(
    initOptions: GenerateSourceFlags
  ): Promise<void> {
    const settings = await generateSettings(initOptions, undefined, {
      requireConfig: true,
    });

    const updates = await aggregateInlineTranslations(
      initOptions,
      settings,
      this.getInlineLibrary()
    );

    // Convert updates to the proper data format
    const newData: Record<string, unknown> = {};
    for (const update of updates) {
      const { source, metadata } = update;
      const { hash } = metadata;
      if (hash) {
        newData[hash] = source;
      }
    }

    if (initOptions.metadata) {
      await saveJSON(initOptions.metadata, collectSourceMetadata(updates));
      logger.step(`Entry metadata saved to ${initOptions.metadata}`);
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
      if (initOptions.sourceOnly) return;
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
    const settings = await generateSettings(initOptions, undefined, {
      requireConfig: true,
    });

    // First run the base class's handleTranslate method
    const options = { ...initOptions, ...settings };

    // Fallback to gt-react
    const pkg = this.getInlineLibrary();

    if (files && files.length > 0) {
      // Validate specific files using createInlineUpdates
      await validateProject(options, pkg, files);
    } else {
      // Validate whole project as before
      await validateProject(options, pkg);
    }
  }
}

function fallbackToGtReact(library: SupportedLibraries): InlineLibrary {
  return [
    Libraries.GT_NEXT,
    Libraries.GT_NODE,
    Libraries.GT_REACT_NATIVE,
    Libraries.GT_TANSTACK_START,
    Libraries.GT_FLASK,
    Libraries.GT_FASTAPI,
    Libraries.GT_VUE,
    Libraries.GT_SVELTE,
  ].includes(library as Libraries)
    ? (library as
        | typeof Libraries.GT_NEXT
        | typeof Libraries.GT_NODE
        | typeof Libraries.GT_REACT_NATIVE
        | typeof Libraries.GT_TANSTACK_START
        | typeof Libraries.GT_FLASK
        | typeof Libraries.GT_FASTAPI
        | typeof Libraries.GT_VUE
        | typeof Libraries.GT_SVELTE)
    : Libraries.GT_REACT;
}
