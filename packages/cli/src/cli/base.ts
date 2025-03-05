import { program } from 'commander';
import { displayAsciiTitle } from '../console/console';
import { displayInitializingText } from '../console/console';
import createOrUpdateConfig from '../fs/config/setupConfig';
import { input, select } from '@inquirer/prompts';
import { isValidLocale } from 'generaltranslation';
import findFilepath, { findFile } from '../fs/findFilepath';
import loadConfig from '../fs/config/loadConfig';
import {
  noDefaultLocaleError,
  noLocalesError,
  noSourceFileError,
  noTranslationsDirError,
  noDataFormatError,
  noSupportedDataFormatError,
  noApiKeyError,
  noProjectIdError,
} from '../console/errors';
import path from 'path';
import yaml from 'yaml';
import { translateJson } from '../formats/json/translate';
import { SupportedLibraries } from '../types';
import { resolveProjectId } from '../fs/utils';
import { FileExtension } from '../types/data';
import { generateSettings } from '../config/generateSettings';
type InitOptions = {
  defaultLocale?: string;
  locales?: string[];
  translationsDir?: string | string[];
};

type TranslateOptions = {
  config?: string;
  defaultLocale?: string;
  locales?: string[];
  translationsDir?: string;
  apiKey?: string;
  projectId?: string;
};

const SUPPORTED_DATA_FORMATS = ['json', 'yaml', 'yml'];

export class BaseCLI {
  private library: SupportedLibraries;
  // Constructor is shared amongst all CLI class types
  public constructor(library: SupportedLibraries) {
    this.library = library;
    this.setupInitCommand();
    this.setupGTCommand();
  }
  // Init is never called in a child class
  public init() {}
  // Execute is called by the main program
  public execute() {
    program.parse();
  }

  protected setupGTCommand(): void {
    program
      .command('translate')
      .description('Translate your project using General Translation')
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
      .option(
        '--default-language, --default-locale <locale>',
        'Default locale (e.g., en)'
      )
      .option(
        '--new, --locales <locales...>',
        'Space-separated list of locales (e.g., en fr es)'
      )
      .option(
        '-t, --translations-dir, --translation-dir <path>',
        'Directory containing your language files. Should be in the format path/to/translations/*.json or path/to/translations/*.yaml'
      )
      .action(async (options: TranslateOptions) => {
        displayAsciiTitle();
        displayInitializingText();

        const settings = generateSettings(options);

        if (!settings.locales) {
          console.error(noLocalesError);
          process.exit(1);
        }
        if (!settings.defaultLocale) {
          console.error(noDefaultLocaleError);
          process.exit(1);
        }
        if (!settings.translationsDir) {
          console.error(noTranslationsDirError);
          process.exit(1);
        }
        if (!settings.apiKey) {
          console.error(noApiKeyError);
          process.exit(1);
        }
        if (!settings.projectId) {
          console.error(noProjectIdError);
          process.exit(1);
        }

        // ---- CREATING UPDATES ---- //
        // Find the source file in the translationsDir
        const rawSource = findFile(
          settings.translationsDir,
          settings.defaultLocale
        );
        if (!rawSource) {
          console.error(noSourceFileError);
          process.exit(1);
        }
        // Get the data format from the ending of the translationsDir
        const fileExtension = settings.translationsDir
          .split('.')
          .pop() as FileExtension;

        const dataFormat =
          this.library === 'next-intl'
            ? 'next-intl'
            : this.library === 'react-i18next'
              ? 'react-i18next'
              : this.library === 'next-i18next'
                ? 'next-i18next'
                : 'gt';

        if (!dataFormat) {
          console.error(noDataFormatError);
          process.exit(1);
        } else if (!SUPPORTED_DATA_FORMATS.includes(dataFormat)) {
          console.error(noSupportedDataFormatError);
          process.exit(1);
        }
        const source =
          fileExtension === 'json'
            ? JSON.parse(rawSource)
            : yaml.parse(rawSource);

        const result = await translateJson(
          source,
          settings,
          dataFormat,
          fileExtension
        );
      });
  }

  protected setupInitCommand(): void {
    program
      .command('init')
      .description('Initialize project for General Translation')
      .action(async () => {
        displayAsciiTitle();
        displayInitializingText();

        // Ask where the translations are stored
        const translationsDir = await input({
          message: 'Where is the directory containing your language files?',
        });

        // Ask for the default locale
        const defaultLocale = await input({
          message: 'What is the default locale for your project?',
        });

        // Ask for the locales
        const locales = await input({
          message:
            'What locales would you like to translate using General Translation? (space-separated list)',
          validate: (input) => {
            const locales = input.split(' ');
            if (locales.length === 0) {
              return 'Please enter at least one locale';
            }
            for (const locale of locales) {
              if (!isValidLocale(locale)) {
                return 'Please enter a valid locale (e.g., en, fr, es)';
              }
            }
            return true;
          },
        });

        const dataFormat: string = await select({
          message: 'What is the format of your language files?',
          choices: ['.json', '.yaml'],
          default: '.json',
        });

        // combine translationsDir and dataFormat into something like
        // translationsDir/*[.json|.yaml]
        const translationsDirWithFormat = path.join(
          translationsDir,
          `*${dataFormat}`
        );

        // Create gt.config.json
        createOrUpdateConfig('gt.config.json', {
          defaultLocale,
          locales: locales.split(' '),
          translationsDir: translationsDirWithFormat,
        });
      });
  }
}
