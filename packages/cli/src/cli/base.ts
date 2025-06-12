import { Command } from 'commander';
import { createOrUpdateConfig } from '../fs/config/setupConfig.js';
import findFilepath, { findFilepaths } from '../fs/findFilepath.js';
import {
  displayHeader,
  promptText,
  logErrorAndExit,
  endCommand,
  promptConfirm,
  promptMultiSelect,
  logSuccess,
  logInfo,
  startCommand,
  createSpinner,
  logMessage,
} from '../console/logging.js';
import path from 'node:path';
import fs from 'node:fs';
import {
  FilesOptions,
  Settings,
  SupportedLibraries,
  SetupOptions,
} from '../types/index.js';
import { DataFormat } from '../types/data.js';
import { generateSettings } from '../config/generateSettings.js';
import chalk from 'chalk';
import { translateFiles } from '../formats/files/translate.js';
import { FILE_EXT_TO_FORMAT } from '../formats/files/supportedFiles.js';
import { handleSetupReactCommand } from '../setup/wizard.js';
import {
  isPackageInstalled,
  searchForPackageJson,
} from '../utils/packageJson.js';
import { getDesiredLocales } from '../setup/userInput.js';
import { installPackage } from '../utils/installPackage.js';
import { getPackageManager } from '../utils/packageManager.js';
import { retrieveCredentials, setCredentials } from '../utils/credentials.js';
import { areCredentialsSet } from '../utils/credentials.js';
import { validateConfigExists } from '../config/validateSettings.js';

export type TranslateOptions = {
  config?: string;
  defaultLocale?: string;
  locales?: string[];
  apiKey?: string;
  projectId?: string;
  dryRun: boolean;
};

export type LoginOptions = {
  keyType?: 'development' | 'production';
};

export class BaseCLI {
  protected library: SupportedLibraries;
  protected additionalModules: SupportedLibraries[];
  protected program: Command;
  // Constructor is shared amongst all CLI class types
  public constructor(
    program: Command,
    library: SupportedLibraries,
    additionalModules?: SupportedLibraries[]
  ) {
    this.program = program;
    this.library = library;
    this.additionalModules = additionalModules || [];
    this.setupInitCommand();
    this.setupConfigureCommand();
    this.setupSetupCommand();
    this.setupLoginCommand();
  }
  // Init is never called in a child class
  public init() {
    this.setupGTCommand();
  }
  // Execute is called by the main program
  public execute() {
    // If no command is specified, run 'init'
    if (process.argv.length <= 2) {
      process.argv.push('init');
    }
  }

  protected setupGTCommand(): void {
    this.program
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
      .option('--project-id <id>', 'Project ID for the translation service')
      .option(
        '--default-language, --default-locale <locale>',
        'Default locale (e.g., en)'
      )
      .option(
        '--new, --locales <locales...>',
        'Space-separated list of locales (e.g., en fr es)'
      )
      .option(
        '--dry-run',
        'Dry run, does not send updates to General Translation API',
        false
      )
      .action(async (initOptions: TranslateOptions) => {
        displayHeader('Starting translation...');
        validateConfigExists();
        const settings = await generateSettings(initOptions);

        const options = { ...initOptions, ...settings };

        await this.handleGenericTranslate(options);
        endCommand('Done!');
      });
  }

  protected setupLoginCommand(): void {
    this.program
      .command('auth')
      .description('Generate a General Translation API key and project ID')
      .option(
        '-c, --config <path>',
        'Filepath to config file, by default gt.config.json',
        findFilepath(['gt.config.json'])
      )
      .option(
        '-t, --key-type <type>',
        'Type of key to generate, production | development'
      )
      .action(async (options: LoginOptions) => {
        displayHeader('Authenticating with General Translation...');
        if (!options.keyType) {
          const packageJson = await searchForPackageJson();
          const isUsingGTNext = packageJson
            ? isPackageInstalled('gt-next', packageJson)
            : false;
          const isUsingGTReact = packageJson
            ? isPackageInstalled('gt-react', packageJson)
            : false;
          if (isUsingGTNext || isUsingGTReact) {
            options.keyType = 'development';
          } else {
            options.keyType = 'production';
          }
        } else {
          if (
            options.keyType !== 'development' &&
            options.keyType !== 'production'
          ) {
            logErrorAndExit(
              'Invalid key type, must be development or production'
            );
          }
        }
        await this.handleLoginCommand(options);
        endCommand(
          `Done! A ${options.keyType} key has been generated and saved to your .env.local file.`
        );
      });
  }

  protected setupInitCommand(): void {
    this.program
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
        '-c, --config <path>',
        'Filepath to config file, by default gt.config.json',
        findFilepath(['gt.config.json'])
      )
      .action(async (options: SetupOptions) => {
        displayHeader('Running setup wizard...');

        const packageJson = await searchForPackageJson();

        let ranReactSetup = false;
        // so that people can run init in non-js projects
        if (packageJson && isPackageInstalled('react', packageJson)) {
          const wrap = await promptConfirm({
            message: `Detected that this project is using React. Would you like to run the React setup wizard?\nThis will install gt-react|gt-next as a dependency and internationalize your app.`,
            defaultValue: true,
          });

          if (wrap) {
            logInfo(
              `${chalk.yellow('[EXPERIMENTAL]')} Running React setup wizard...`
            );
            await this.handleSetupReactCommand(options);
            endCommand(
              `Done! Since this wizard is experimental, please review the changes and make modifications as needed.
Certain aspects of your app may still need manual setup.
See the docs for more information: https://generaltranslation.com/docs/react/tutorials/quickstart`
            );
            ranReactSetup = true;
          }
        }
        if (ranReactSetup) {
          startCommand('Setting up project config...');
        }
        // Configure gt.config.json
        await this.handleInitCommand(ranReactSetup);

        endCommand(
          'Done! Check out our docs for more information on how to use General Translation: https://generaltranslation.com/docs'
        );
      });
  }

  protected setupConfigureCommand(): void {
    this.program
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
        await this.handleInitCommand(false);

        endCommand(
          'Done! Make sure you have an API key and project ID to use General Translation. Get them on the dashboard: https://generaltranslation.com/dashboard'
        );
      });
  }

  protected setupSetupCommand(): void {
    this.program
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
        '-c, --config <path>',
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

  protected async handleGenericTranslate(
    settings: Settings & TranslateOptions
  ): Promise<void> {
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

    if (
      !settings.files ||
      (Object.keys(settings.files.placeholderPaths).length === 1 &&
        settings.files.placeholderPaths.gt)
    ) {
      return;
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
  protected async handleInitCommand(ranReactSetup: boolean): Promise<void> {
    const { defaultLocale, locales } = await getDesiredLocales();

    const packageJson = await searchForPackageJson();
    const isUsingGTNext = packageJson
      ? isPackageInstalled('gt-next', packageJson)
      : false;
    const isUsingGTReact = packageJson
      ? isPackageInstalled('gt-react', packageJson)
      : false;

    // Ask if using another i18n library
    const isUsingGT = isUsingGTNext || isUsingGTReact || ranReactSetup;

    // Ask where the translations are stored
    const usingCDN = isUsingGT
      ? await promptConfirm({
          message: `Auto-detected that you're using gt-next or gt-react. Would you like to use the General Translation CDN to store your translations?\nSee ${
            isUsingGTNext
              ? 'https://generaltranslation.com/docs/next/reference/local-tx'
              : 'https://generaltranslation.com/docs/react/reference/local-tx'
          } for more information.\nIf you answer no, we'll configure the CLI tool to download completed translations.`,
          defaultValue: true,
        })
      : false;
    if (isUsingGT && !usingCDN) {
      logMessage(
        `To prevent translations from being published, please disable the project setting on the dashboard: ${chalk.cyan(
          'https://dash.generaltranslation.com/settings/project'
        )}`
      );
    }
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
      : `${chalk.dim(
          '(Optional)'
        )} Do you have any separate files you would like to translate? For example, extra Markdown files for docs.`;
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
        message: `${chalk.cyan(FILE_EXT_TO_FORMAT[dataFormat])}: Please enter a space-separated list of glob patterns matching the location of the ${FILE_EXT_TO_FORMAT[dataFormat]} files you would like to translate.\nMake sure to include [locale] in the patterns.\nSee https://generaltranslation.com/docs/cli/reference/config#include for more information.`,
        defaultValue: `./**/[locale]/*.${dataFormat}`,
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
    await createOrUpdateConfig(configFilepath, {
      defaultLocale,
      locales,
      files: Object.keys(files).length > 0 ? files : undefined,
    });

    logSuccess(
      `Feel free to edit ${chalk.cyan(
        configFilepath
      )} to customize your translation setup. Docs: https://generaltranslation.com/docs/cli/reference/config`
    );

    // Install gtx-cli if not installed
    const isCLIInstalled = packageJson
      ? isPackageInstalled('gtx-cli', packageJson, true, true)
      : true; // if no package.json, we can't install it

    if (!isCLIInstalled) {
      const packageManager = await getPackageManager();
      const spinner = createSpinner();
      spinner.start(
        `Installing gtx-cli as a dev dependency with ${packageManager.name}...`
      );
      await installPackage('gtx-cli', packageManager, true);
      spinner.stop(chalk.green('Installed gtx-cli.'));
    }

    // Set credentials
    if (!areCredentialsSet()) {
      const loginQuestion = await promptConfirm({
        message: `Would you like the wizard to automatically generate a ${
          isUsingGT ? 'development' : 'production'
        } API key and project ID for you?`,
        defaultValue: true,
      });
      if (loginQuestion) {
        const settings = await generateSettings({});
        const keyType = isUsingGT ? 'development' : 'production';
        const credentials = await retrieveCredentials(settings, keyType);
        await setCredentials(credentials, keyType, settings.framework);
      }
    }
  }
  protected async handleLoginCommand(options: LoginOptions): Promise<void> {
    const settings = await generateSettings({});
    const keyType = options.keyType || 'production';
    const credentials = await retrieveCredentials(settings, keyType);
    await setCredentials(credentials, keyType, settings.framework);
  }
}
