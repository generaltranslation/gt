import { program } from 'commander';
import createOrUpdateConfig from '../fs/config/setupConfig';
import findFilepath, { findFilepaths, readFile } from '../fs/findFilepath';
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
  logSuccess,
  logInfo,
} from '../console';
import path from 'path';
import fs from 'fs';
import {
  FilesOptions,
  Settings,
  SupportedLibraries,
  SetupOptions,
} from '../types';
import { resolveProjectId } from '../fs/utils';
import { DataFormat } from '../types/data';
import { generateSettings } from '../config/generateSettings';
import chalk from 'chalk';
import { translateFiles } from '../formats/files/translate';
import { FILE_EXT_TO_FORMAT } from '../formats/files/supportedFiles';
import { handleSetupReactCommand } from '../setup/wizard';
import { getPackageJson, isPackageInstalled } from '../utils/packageJson';
import { getDesiredLocales } from '../setup/userInput';

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
    this.setupConfigureCommand();
    this.setupSetupCommand();
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

  protected setupInitCommand(): void {
    program
      .command('init')
      .description(
        'Run the setup wizard to configure your project for General Translation'
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
      .action(async (options: SetupOptions) => {
        displayHeader('Running setup wizard...');

        const wrap = await promptConfirm({
          message: `Is this project using React or Next.js? ${chalk.gray(
            '(Selecting yes will run the React setup wizard, setting your project up to use gt-react or gt-next)'
          )}`,
          defaultValue: true,
        });

        if (wrap) {
          logInfo(
            `${chalk.yellow('[EXPERIMENTAL]')} Running React setup wizard...`
          );
          await this.handleSetupReactCommand(options);
        }

        // Configure gt.config.json
        await this.handleInitCommand();

        endCommand(
          "Done! Take advantage of all of General Translation's features by signing up for a free account! https://generaltranslation.com/signup"
        );
      });
  }

  protected setupConfigureCommand(): void {
    program
      .command('configure')
      .description(
        'Configure your project for General Translation. This will create a gt.config.json file in your codebase.'
      )
      .action(async () => {
        displayHeader('Configuring project...');

        logInfo(
          'Welcome! This tool will help you configure your gt.config.json file. See the docs: https://generaltranslation.com/docs/cli/reference/config for more information.'
        );

        // Configure gt.config.json
        await this.handleInitCommand();

        endCommand(
          'Done! Make sure you have an API key and project ID to use General Translation. Get them on the dashboard: https://generaltranslation.com/dashboard'
        );
      });
  }

  protected setupSetupCommand(): void {
    program
      .command('setup')
      .description(
        'Run the setup to configure your Next.js or React project for General Translation'
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
      .action(async (options: SetupOptions) => {
        displayHeader('Running React setup wizard...');
        await this.handleSetupReactCommand(options);
        endCommand(
          "Done! Take advantage of all of General Translation's features by signing up for a free account! https://generaltranslation.com/signup"
        );
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

  protected async handleSetupReactCommand(
    options: SetupOptions
  ): Promise<void> {
    await handleSetupReactCommand(options);
  }

  // Wizard for configuring gt.config.json
  protected async handleInitCommand(): Promise<void> {
    const { defaultLocale, locales } = await getDesiredLocales();

    const packageJson = getPackageJson();

    const isUsingNext = isPackageInstalled('next', packageJson);
    const isUsingReact = isPackageInstalled('react', packageJson);
    const thirdPartyLibrary = !isUsingNext && !isUsingReact;

    // Ask if using another i18n library
    const isUsingGT = thirdPartyLibrary
      ? await promptConfirm({
          message: `Are you using gt-next or gt-react? ${chalk.gray(
            `(Auto-detected: ${this.library === 'base' ? 'none' : this.library})`
          )}`,
          defaultValue: false,
        })
      : true;

    // Ask where the translations are stored
    const usingCDN = isUsingGT
      ? await promptConfirm({
          message: `Would you like to use the General Translation CDN to store your translations? See ${
            isUsingNext
              ? 'https://generaltranslation.com/docs/next/reference/local-tx'
              : 'https://generaltranslation.com/docs/react/reference/local-tx'
          } for more information.`,
          defaultValue: true,
        })
      : false;

    // Ask where the translations are stored
    const translationsDir =
      isUsingGT && !usingCDN
        ? await promptText({
            message:
              'What is the path to the directory where you would like to locally store your translations?',
            defaultValue: './public/locales',
          })
        : null;

    const message = !isUsingGT
      ? 'What is the format of your language resource files? Select as many as applicable.\nAdditionally, you can translate any other files you have in your project.'
      : '(Optional) Do you have any separate files you would like to translate?\nFor example, extra Markdown files for documentation.';
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
        message: `${FILE_EXT_TO_FORMAT[dataFormat]}: Please enter a space-separated list of glob patterns matching the location of the ${FILE_EXT_TO_FORMAT[dataFormat]} files you would like to translate.\nMake sure to include [locale] in the patterns. See https://generaltranslation.com/docs/cli/reference/config#include for more information.`,
        defaultValue: `./**/*.[locale].${dataFormat}`,
      });

      files[dataFormat] = {
        include: paths.split(' '),
      };
    }

    // Add GT translations if using GT and storing locally
    if (isUsingGT && !usingCDN && translationsDir) {
      files.gt = {
        output: path.join(translationsDir, `[locale].json`),
      };
    }

    let configFilepath = 'gt.config.json';
    if (fs.existsSync('src/gt.config.json')) {
      configFilepath = 'src/gt.config.json';
    }

    // Create gt.config.json
    createOrUpdateConfig(configFilepath, {
      defaultLocale,
      locales,
      files,
    });

    logSuccess(
      `Feel free to edit ${chalk.blue(
        configFilepath
      )} to customize your translation setup. Docs: https://generaltranslation.com/docs/cli/reference/config`
    );
  }
}
