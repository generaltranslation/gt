import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
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
import {
  noFilesError,
  outdatedTranslationFilesError,
  unreadableTranslationFileError,
} from '../console/index.js';
import { saveJSON } from '../fs/saveJSON.js';
import { loadJSON } from '../fs/loadJSON.js';
import { generateSettings } from '../config/generateSettings.js';
import { aggregateInlineTranslations } from '../translation/stage.js';
import { validateProject } from '../translation/validate.js';
import {
  Libraries,
  InlineLibrary,
  isInlineLibrary,
} from '../types/libraries.js';

type GenerateFlags = TranslateFlags & { check?: boolean };

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
    return isInlineLibrary(this.library) ? this.library : Libraries.GT_REACT;
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
            '--check',
            'Write nothing, and exit with code 1 if a translation file is out of date',
            false
          )
      ),
      this.getInlineSourceHelp()
    ).action(async (initOptions: GenerateFlags) => {
      displayHeader('Generating source templates...');
      await this.handleGenerateSourceCommand(initOptions);
      logger.endCommand('Done!');
    });
  }

  protected async handleGenerateSourceCommand(
    initOptions: GenerateFlags
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
      const sourceFile = translationFiles.gt;
      // A set, since without [locale] in the output path every locale resolves to the source's file.
      const files = new Set([
        sourceFile,
        ...settings.locales.map(
          (locale) =>
            resolveLocaleFiles(settings.files.placeholderPaths, locale).gt
        ),
      ]);
      const outdated: [string, Record<string, unknown>][] = [];
      for (const file of files) {
        if (!file) continue;
        const saved = loadJSON(file);
        if (file !== sourceFile && saved === null && fs.existsSync(file)) {
          // Generating over it would replace its translations with source text.
          logger.error(
            unreadableTranslationFileError(path.relative(process.cwd(), file))
          );
          exitSync(1);
        }
        // A locale file keeps its translations of the messages still in the source.
        const data =
          file === sourceFile
            ? newData
            : Object.fromEntries(
                Object.keys(newData).map((key) => [
                  key,
                  saved && Object.hasOwn(saved, key)
                    ? saved[key]
                    : newData[key],
                ])
              );
        // Compared as the JSON that would be saved: an extractor's objects can differ from a parsed file in ways saving removes.
        if (!isDeepStrictEqual(saved, JSON.parse(JSON.stringify(data)))) {
          outdated.push([file, data]);
        }
      }
      const outdatedPaths = outdated.map(([file]) =>
        path.relative(process.cwd(), file)
      );
      if (outdated.length === 0) {
        logger.step('Translation files are up to date.');
        return;
      }
      if (initOptions.check) {
        logger.error(outdatedTranslationFilesError(outdatedPaths));
        exitSync(1);
      }
      if (initOptions.dryRun) {
        logger.step(`Dry run. Would write: ${outdatedPaths.join(', ')}`);
        return;
      }

      for (const [file, data] of outdated) {
        await saveJSON(file, data);
      }
      logger.step(`Saved: ${outdatedPaths.join(', ')}`);
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
