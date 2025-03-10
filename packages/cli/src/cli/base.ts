import { program } from 'commander';
import { displayAsciiTitle } from '../console/console';
import { displayInitializingText } from '../console/console';
import createOrUpdateConfig from '../fs/config/setupConfig';
import { input, select } from '@inquirer/prompts';
import { isValidLocale } from 'generaltranslation';
import findFilepath, { findFile } from '../fs/findFilepath';
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
import { DataFormat, FileExtension } from '../types/data';
import { generateSettings } from '../config/generateSettings';
import chalk from 'chalk';
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

const SUPPORTED_DATA_FORMATS = ['JSX', 'ICU', 'I18NEXT'];

export class BaseCLI {
  private library: SupportedLibraries;
  private additionalModules: SupportedLibraries[];
  // Constructor is shared amongst all CLI class types
  public constructor(
    library: SupportedLibraries,
    additionalModules?: SupportedLibraries[]
  ) {
    this.library = library;
    this.additionalModules = additionalModules || [];
    this.setupInitCommand();
  }
  // Init is never called in a child class
  public init() {
    this.setupGTCommand();
  }
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

        let dataFormat: DataFormat;
        if (this.library === 'next-intl') {
          dataFormat = 'ICU';
        } else if (this.library === 'i18next') {
          if (this.additionalModules.includes('i18next-icu')) {
            dataFormat = 'ICU';
          } else {
            dataFormat = 'I18NEXT';
          }
        } else {
          dataFormat = 'JSX';
        }

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

        // Ask for the default locale
        const defaultLocale = await input({
          message: 'What is the default locale for your project?',
          default: 'en',
        });

        // Ask for the locales
        const locales = await input({
          message: `What locales would you like to translate using General Translation? ${chalk.gray(
            '(space-separated list)'
          )}`,
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

        // Ask where the translations are stored
        const location = await select({
          message: 'Where are your language files stored? (CDN or local)',
          choices: [
            { value: 'cdn', name: 'CDN' },
            { value: 'local', name: 'Local' },
          ],
          default: 'cdn',
        });

        if (location === 'cdn') {
          // Create gt.config.json
          createOrUpdateConfig('gt.config.json', {
            defaultLocale,
            locales: locales.split(' '),
          });
          return;
        }

        // Ask where the translations are stored
        const translationsDir = await input({
          message:
            'What is the path to the directory containing your language files?',
        });

        const thirdPartyLibrary =
          this.library !== 'gt-next' && this.library !== 'gt-react';

        // Ask if using another i18n library
        const i18nLibrary = thirdPartyLibrary
          ? await select({
              message: `Are you using a third-party i18n library? (${chalk.gray(
                `Auto-detected: ${this.library}`
              )})`,
              choices: [
                { value: true, name: 'Yes' },
                { value: false, name: 'No' },
              ],
              default: true,
            })
          : false;

        if (i18nLibrary) {
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
        } else {
          // Create gt.config.json
          createOrUpdateConfig('gt.config.json', {
            defaultLocale,
            locales: locales.split(' '),
            translationsDir: translationsDir,
          });
        }
      });
  }
}
