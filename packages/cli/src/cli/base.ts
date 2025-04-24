import { program } from 'commander';
import createOrUpdateConfig from '../fs/config/setupConfig';
import { isValidLocale } from 'generaltranslation';
import findFilepath, { readFile } from '../fs/findFilepath';
import {
  displayHeader,
  promptText,
  promptSelect,
  logErrorAndExit,
  noDefaultLocaleError,
  noLocalesError,
  noApiKeyError,
  noProjectIdError,
  noFilesError,
  endCommand,
  promptConfirm,
  promptMultiSelect,
} from '../console';
import path from 'path';
import fs from 'fs';
import { FilesOptions, Settings, SupportedLibraries } from '../types';
import { resolveProjectId } from '../fs/utils';
import { DataFormat } from '../types/data';
import { generateSettings } from '../config/generateSettings';
import chalk from 'chalk';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { translateFiles } from '../formats/files/translate';
import { FILE_EXT_TO_FORMAT } from '../formats/files/supportedFiles';

type TranslateOptions = {
  config?: string;
  defaultLocale?: string;
  locales?: string[];
  files?: FilesOptions;
  apiKey?: string;
  projectId?: string;
};

export class BaseCLI {
  protected library: SupportedLibraries;
  protected additionalModules: SupportedLibraries[];
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
        displayHeader('Starting translation...');
        const settings = generateSettings(options);
        await this.handleGenericTranslate(settings);
        endCommand('Done!');
      });
  }

  protected async handleGenericTranslate(settings: Settings): Promise<void> {
    // Validate required settings are present
    if (!settings.locales) {
      logErrorAndExit(noLocalesError);
    }
    if (!settings.defaultLocale) {
      logErrorAndExit(noDefaultLocaleError);
    }
    if (!settings.files) {
      logErrorAndExit(noFilesError);
    }
    if (!settings.apiKey) {
      logErrorAndExit(noApiKeyError);
    }
    if (!settings.projectId) {
      logErrorAndExit(noProjectIdError);
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

    const {
      resolvedPaths: sourceFiles,
      placeholderPaths,
      transformPaths,
    } = settings.files;

    // Process all file types at once with a single call
    await translateFiles(
      sourceFiles,
      placeholderPaths,
      transformPaths,
      dataFormat,
      settings
    );
  }

  protected setupInitCommand(): void {
    program
      .command('init')
      .description('Initialize project for General Translation')
      .action(async () => {
        displayHeader('Initializing project...');

        // Ask for the default locale
        const defaultLocale = await promptText({
          message: 'What is the default locale for your project?',
          defaultValue: libraryDefaultLocale,
        });

        // Ask for the locales
        const locales = await promptText({
          message: `What locales would you like to translate using General Translation? ${chalk.gray('(space-separated list)')}`,
          validate: (input) => {
            const localeList = input.split(' ');
            if (localeList.length === 0) {
              return 'Please enter at least one locale';
            }
            for (const locale of localeList) {
              if (!isValidLocale(locale)) {
                return 'Please enter a valid locale (e.g., en, fr, es)';
              }
            }
            return true;
          },
        });

        let configFilepath = 'gt.config.json';
        if (fs.existsSync('gt.config.json')) {
          configFilepath = 'gt.config.json';
        } else if (fs.existsSync('src/gt.config.json')) {
          configFilepath = 'src/gt.config.json';
        }

        const thirdPartyLibrary =
          this.library !== 'gt-next' && this.library !== 'gt-react';

        // Ask if using another i18n library
        const isUsingGT = thirdPartyLibrary
          ? await promptConfirm({
              message: `Are you using gt-next or gt-react? ${chalk.gray(
                `(Auto-detected: ${this.library === 'base' ? 'none' : this.library})`
              )}`,
              defaultValue: this.library !== 'base',
            })
          : false;

        // Ask where the translations are stored
        const location = isUsingGT
          ? await promptSelect({
              message: `Where would you like to store your translations? ${chalk.gray('(remote or local)')}`,
              options: [
                {
                  value: 'remote',
                  label: 'Remotely',
                  hint: 'Remote translations are stored on the GT CDN.',
                },
                {
                  value: 'local',
                  label: 'Locally',
                  hint: 'Local translations are stored in the codebase and are bundled with the app. This will increase your build time and bundle size.',
                },
              ],
              defaultValue: 'remote',
            })
          : 'local';

        // Ask where the translations are stored
        const translationsDir = isUsingGT
          ? await promptText({
              message:
                'What is the path to the directory where your translations are stored?',
              defaultValue: './public/locales',
            })
          : null;

        const message = !isUsingGT
          ? 'What is the format of your language resource files? Select as many as applicable. Additionally, you can translate any other files you have in your project.'
          : '(Optional) Do you have any separate files you would like to translate? For example, extra Markdown files for documentation.';
        const dataFormats = await promptMultiSelect({
          message,
          options: [
            { value: 'json', label: 'JSON' },
            { value: 'md', label: 'Markdown' },
            { value: 'mdx', label: 'MDX' },
            { value: 'ts', label: 'TypeScript' },
            { value: 'js', label: 'JavaScript' },
          ],
          required: !isUsingGT,
        });

        const files: FilesOptions = {};
        for (const dataFormat of dataFormats) {
          const paths = await promptText({
            message: `${FILE_EXT_TO_FORMAT[dataFormat]}: Please enter a space-separated list of glob patterns matching the location of the ${FILE_EXT_TO_FORMAT[dataFormat]} files you would like to translate. Make sure to include [locale] in the patterns. See https://generaltranslation.com/docs/cli/reference/config#include for more information.`,
            defaultValue: `./**/*.[locale].${dataFormat}`,
          });

          files[dataFormat] = {
            include: paths.split(' '),
          };
        }

        // Add GT translations if using GT and storing locally
        if (isUsingGT && location === 'local' && translationsDir) {
          files.gt = {
            output: path.join(translationsDir, `[locale].json`),
          };
        }
        // Create gt.config.json
        createOrUpdateConfig(configFilepath, {
          defaultLocale,
          locales: locales.split(' '),
          files,
        });

        endCommand(
          `Done! Feel free to edit ${chalk.blue(
            configFilepath
          )} to customize your translation setup. Docs: https://generaltranslation.com/docs/cli/reference/config`
        );
      });
  }
}
