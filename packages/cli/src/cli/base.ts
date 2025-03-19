import { program } from 'commander';
import { displayAsciiTitle } from '../console/console';
import { displayInitializingText } from '../console/console';
import createOrUpdateConfig from '../fs/config/setupConfig';
import { input, select } from '@inquirer/prompts';
import { isValidLocale } from 'generaltranslation';
import findFilepath, { findFile, readFile } from '../fs/findFilepath';
import {
  noDefaultLocaleError,
  noLocalesError,
  noSourceFileError,
  noDataFormatError,
  noSupportedDataFormatError,
  noApiKeyError,
  noProjectIdError,
  noFilesError,
} from '../console/errors';
import path from 'path';
import yaml from 'yaml';
import { translateJson } from '../formats/json/translate';
import { FilesOptions, Settings, SupportedLibraries } from '../types';
import { resolveProjectId } from '../fs/utils';
import { DataFormat, FileExtension } from '../types/data';
import { generateSettings } from '../config/generateSettings';
import chalk from 'chalk';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { resolveFiles } from '../fs/config/parseFilesConfig';
import { translateFiles } from '../formats/files/translate';

type TranslateOptions = {
  config?: string;
  defaultLocale?: string;
  locales?: string[];
  files?: FilesOptions;
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
      .action(async (options: TranslateOptions) => {
        displayAsciiTitle();
        displayInitializingText();

        const settings = generateSettings(options);
        await this.handleGenericTranslate(settings);
      });
  }

  protected async handleGenericTranslate(settings: Settings): Promise<void> {
    // Validate required settings are present
    if (!settings.locales) {
      console.error(noLocalesError);
      process.exit(1);
    }
    if (!settings.defaultLocale) {
      console.error(noDefaultLocaleError);
      process.exit(1);
    }
    if (!settings.files) {
      console.error(noFilesError);
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

    // dataFormat for JSONs
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

    const { resolvedPaths: sourceFiles, placeholderPaths } = settings.files;

    // ---- CREATING UPDATES ---- //
    if (sourceFiles.json) {
      // Only translate JSON files if not using gt-react or gt-next
      // ReactCLI will handle the JSON files differently
      if (this.library !== 'gt-react' && this.library !== 'gt-next') {
        const rawSource = readFile(sourceFiles.json[0]);
        if (!rawSource) {
          console.error(noSourceFileError);
          process.exit(1);
        }

        if (!dataFormat) {
          console.error(noDataFormatError);
          process.exit(1);
        } else if (!SUPPORTED_DATA_FORMATS.includes(dataFormat)) {
          console.error(noSupportedDataFormatError);
          process.exit(1);
        }
        const source = JSON.parse(rawSource);

        await translateJson(source, settings, dataFormat, placeholderPaths);
      }
    }
    if (sourceFiles.mdx || sourceFiles.md) {
      if (sourceFiles.mdx) {
        await translateFiles(sourceFiles, placeholderPaths, 'MDX', settings);
      }
      if (sourceFiles.md) {
        await translateFiles(sourceFiles, placeholderPaths, 'MD', settings);
      }
    }
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
          default: libraryDefaultLocale,
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
          message: `Where are your language files stored? ${chalk.gray(
            '(remote or local)'
          )}`,
          choices: [
            { value: 'remote', name: 'Remote' },
            { value: 'local', name: 'Local' },
          ],
          default: 'remote',
        });

        if (location === 'remote') {
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
              message: `Are you using a 3rd-party i18n library? ${chalk.gray(
                `(Auto-detected: ${this.library === 'base' ? 'none' : this.library})`
              )}`,
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
            choices: ['json'],
            default: 'json',
          });
          // combine translationsDir and dataFormat into something like
          // translationsDir/[locale].json
          const translationsDirWithFormat = path.join(
            translationsDir,
            `[locale].${dataFormat}`
          );
          // Create gt.config.json
          createOrUpdateConfig('gt.config.json', {
            defaultLocale,
            locales: locales.split(' '),
            files: {
              json: {
                include: [translationsDirWithFormat],
              },
            },
          });
        } else {
          const translationsDirWithFormat = path.join(
            translationsDir,
            `[locale].json`
          );
          // Create gt.config.json
          createOrUpdateConfig('gt.config.json', {
            defaultLocale,
            locales: locales.split(' '),
            files: {
              json: {
                include: [translationsDirWithFormat],
              },
            },
          });
        }
      });
  }
}
