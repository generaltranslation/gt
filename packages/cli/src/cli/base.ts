import { Command } from 'commander';
import { createOrUpdateConfig } from '../fs/config/setupConfig.js';
import findFilepath from '../fs/findFilepath.js';
import {
  displayHeader,
  promptText,
  logErrorAndExit,
  promptConfirm,
  promptMultiSelect,
  promptSelect,
} from '../console/logging.js';
import { logger } from '../console/logger.js';
import path from 'node:path';
import fs from 'node:fs';
import {
  FilesOptions,
  Settings,
  ReactFrameworkObject,
  SupportedLibraries,
  SetupOptions,
  TranslateFlags,
  SharedFlags,
} from '../types/index.js';
import { DataFormat } from '../types/data.js';
import { generateSettings } from '../config/generateSettings.js';
import chalk from 'chalk';
import { FILE_EXT_TO_EXT_LABEL } from '../formats/files/supportedFiles.js';
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
import { upload } from '../formats/files/upload.js';
import { attachSharedFlags, attachTranslateFlags } from './flags.js';
import { handleStage } from './commands/stage.js';
import { handleSetupProject } from './commands/setupProject.js';
import {
  handleDownload,
  handleTranslate,
  postProcessTranslations,
} from './commands/translate.js';
import { getDownloaded, clearDownloaded } from '../state/recentDownloads.js';
import updateConfig from '../fs/config/updateConfig.js';
import { createLoadTranslationsFile } from '../fs/createLoadTranslationsFile.js';
import { saveLocalEdits } from '../api/saveLocalEdits.js';
import processSharedStaticAssets from '../utils/sharedStaticAssets.js';
import { setupLocadex } from '../locadex/setupFlow.js';
import { detectFramework } from '../setup/detectFramework.js';
import {
  getFrameworkDisplayName,
  getReactFrameworkLibrary,
} from '../setup/frameworkUtils.js';

export type UploadOptions = {
  config?: string;
  apiKey?: string;
  projectId?: string;
  defaultLocale?: string;
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
    this.setupUploadCommand();
    this.setupLoginCommand();
    this.setupSendDiffsCommand();
  }
  // Init is never called in a child class
  public init() {
    this.setupSetupProjectCommand();
    this.setupStageCommand();
    this.setupTranslateCommand();
  }
  // Execute is called by the main program
  public execute() {
    // If no command is specified, run 'init'
    if (process.argv.length <= 2) {
      process.argv.push('init');
    }
  }

  protected setupSetupProjectCommand(): void {
    attachTranslateFlags(
      this.program
        .command('setup')
        .description(
          'Upload source files and setup the project for translation'
        )
    ).action(async (initOptions: TranslateFlags) => {
      displayHeader('Uploading source files and setting up project...');
      await this.handleSetupProject(initOptions);
      logger.endCommand('Done!');
    });
  }

  protected setupStageCommand(): void {
    attachTranslateFlags(
      this.program
        .command('stage')
        .description(
          'Submits the project to the General Translation API for translation. Translations created using this command will require human approval.'
        )
    ).action(async (initOptions: TranslateFlags) => {
      displayHeader(
        'Staging project for translation with approval required...'
      );
      await this.handleStage(initOptions);
      logger.endCommand('Done!');
    });
  }
  protected setupTranslateCommand(): void {
    attachTranslateFlags(
      this.program
        .command('translate')
        .description('Translate your project using General Translation')
    ).action(async (initOptions: TranslateFlags) => {
      displayHeader('Starting translation...');
      await this.handleTranslate(initOptions);
      logger.endCommand('Done!');
    });
  }

  protected setupSendDiffsCommand(): void {
    attachSharedFlags(
      this.program
        .command('save-local')
        .description(
          'Save local edits for all configured files by sending diffs (no translation enqueued)'
        )
    ).action(async (initOptions: SharedFlags) => {
      displayHeader('Saving local edits...');
      const settings = await generateSettings(initOptions);
      await saveLocalEdits(settings);
      logger.endCommand('Saved local edits');
    });
  }

  protected async handleSetupProject(
    initOptions: TranslateFlags
  ): Promise<void> {
    const settings = await generateSettings(initOptions);

    // Preprocess shared static assets if configured (move + rewrite sources)
    await processSharedStaticAssets(settings);

    await handleSetupProject(initOptions, settings, this.library);
  }
  protected async handleStage(initOptions: TranslateFlags): Promise<void> {
    const settings = await generateSettings(initOptions);

    // Preprocess shared static assets if configured (move + rewrite sources)
    await processSharedStaticAssets(settings);

    if (!settings.stageTranslations) {
      // Update settings.stageTranslations to true
      settings.stageTranslations = true;
      await updateConfig({
        configFilepath: settings.config,
        stageTranslations: true,
      });
    }
    await handleStage(initOptions, settings, this.library, true);
  }

  protected async handleTranslate(initOptions: TranslateFlags): Promise<void> {
    const settings = await generateSettings(initOptions);

    // Preprocess shared static assets if configured (move + rewrite sources)
    await processSharedStaticAssets(settings);

    if (!settings.stageTranslations) {
      const results = await handleStage(
        initOptions,
        settings,
        this.library,
        false
      );
      if (results) {
        await handleTranslate(
          initOptions,
          settings,
          results.fileVersionData,
          results.jobData,
          results.branchData
        );
      }
    } else {
      await handleDownload(initOptions, settings);
    }
    // Only postprocess files downloaded in this run
    const include = getDownloaded();
    if (include.size > 0) {
      await postProcessTranslations(settings, include);
    }
    clearDownloaded();
  }

  protected setupUploadCommand(): void {
    attachTranslateFlags(
      this.program
        .command('upload')
        .description(
          'Upload source files and translations to the General Translation platform'
        )
    ).action(async (initOptions: UploadOptions) => {
      displayHeader('Starting upload...');
      const settings = await generateSettings(initOptions);

      const options = { ...initOptions, ...settings };

      await this.handleUploadCommand(options);
      logger.endCommand('Done!');
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
        logger.endCommand(
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
        "Space-separated list of glob patterns containing the app's source code, by default 'src/**/*.{js,jsx,ts,tsx}' 'app/**/*.{js,jsx,ts,tsx}' 'pages/**/*.{js,jsx,ts,tsx}' 'components/**/*.{js,jsx,ts,tsx}'"
      )
      .option(
        '-c, --config <path>',
        'Filepath to config file, by default gt.config.json',
        findFilepath(['gt.config.json'])
      )
      .action(async (options: SetupOptions) => {
        const settings = await generateSettings(options);
        displayHeader('Running setup wizard...');

        const framework = await detectFramework();

        const useAgent = await (async () => {
          let useAgentMessage;
          if (framework.name === 'mintlify') {
            useAgentMessage = `Mintlify project detected. Would you like to connect to GitHub so that the Locadex AI Agent can translate your project automatically?`;
          }
          if (framework.name === 'next-app') {
            useAgentMessage = `Next.js App Router detected. Would you like to connect to GitHub so that the Locadex AI Agent can set up your project automatically?`;
          }
          if (useAgentMessage) {
            return await promptConfirm({
              message: useAgentMessage,
              defaultValue: false,
            });
          }
          return false;
        })();

        if (useAgent) {
          await setupLocadex(settings);
          logger.endCommand(
            'Once installed, Locadex will open a PR to your repository. See the docs for more information: https://generaltranslation.com/docs/locadex'
          );
        } else {
          let ranReactSetup = false;

          // so that people can run init in non-js projects
          if (framework.type === 'react') {
            const frameworkDisplayName = getFrameworkDisplayName(framework);
            const library = getReactFrameworkLibrary(framework);

            const wrap = await promptConfirm({
              message: `${frameworkDisplayName} detected. Would you like to install ${library} and add the GTProvider? See the docs for more information: https://generaltranslation.com/docs/react/tutorials/quickstart`,
              defaultValue: true,
            });

            if (wrap) {
              logger.info(
                `${chalk.yellow('[EXPERIMENTAL]')} Configuring project...`
              );
              await this.handleSetupReactCommand(options, framework);
              logger.endCommand(
                `Done! Since this wizard is experimental, please review the changes and make modifications as needed.
\nNext step: start internationalizing! See the docs for more information: https://generaltranslation.com/docs/react/tutorials/quickstart`
              );
              ranReactSetup = true;
            }
          }

          if (ranReactSetup) {
            logger.startCommand('Setting up project config...');
          }
          // Configure gt.config.json
          await this.handleInitCommand(ranReactSetup);

          logger.endCommand(
            'Done! Check out our docs for more information on how to use General Translation: https://generaltranslation.com/docs'
          );
        }
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

        logger.info(
          'Welcome! This tool will help you configure your gt.config.json file. See the docs: https://generaltranslation.com/docs/cli/reference/config for more information.'
        );

        // Configure gt.config.json
        await this.handleInitCommand(false);

        logger.endCommand(
          'Done! Make sure you have an API key and project ID to use General Translation. Get them on the dashboard: https://generaltranslation.com/dashboard'
        );
      });
  }

  protected async handleUploadCommand(
    settings: Settings & UploadOptions
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

    if (!settings.files) {
      return;
    }
    const {
      resolvedPaths: sourceFiles,
      placeholderPaths,
      transformPaths,
    } = settings.files;

    // Process all file types at once with a single call
    await upload(
      sourceFiles,
      placeholderPaths,
      transformPaths,
      dataFormat,
      settings
    );
  }

  protected async handleSetupReactCommand(
    options: SetupOptions,
    frameworkObject: ReactFrameworkObject
  ): Promise<void> {
    await handleSetupReactCommand(options, frameworkObject);
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
    const usingCDN = await (async () => {
      if (!isUsingGT) return false;
      const selectedValue = await promptSelect({
        message: `Would you like to save translation files locally or use the General Translation CDN to store them?`,
        options: [
          { value: 'local', label: 'Save locally' },
          { value: 'cdn', label: 'Use CDN' },
        ],
        defaultValue: 'local',
      });
      return selectedValue === 'cdn';
    })();

    // Ask where the translations are stored
    const translationsDir =
      isUsingGT && !usingCDN
        ? await promptText({
            message:
              'What is the path to the directory where you would like to store your translation files?',
            defaultValue: './public/_gt',
          })
        : null;

    // Determine final translations directory with fallback
    const finalTranslationsDir = translationsDir?.trim() || './public/_gt';

    if (isUsingGT && !usingCDN) {
      // Create loadTranslations.js file for local translations
      await createLoadTranslationsFile(
        process.cwd(),
        finalTranslationsDir,
        locales
      );
      logger.message(
        `Created ${chalk.cyan('loadTranslations.js')} file for local translations.
Make sure to add this function to your app configuration.
See https://generaltranslation.com/en/docs/next/guides/local-tx`
      );
    }

    const message = !isUsingGT
      ? 'What is the format of your language resource files? Select as many as applicable.\nAdditionally, you can translate any other files you have in your project.'
      : `Do you have any additional files in this project to translate? For example, Markdown files for docs. ${chalk.dim(
          '(To continue without selecting press Enter)'
        )}`;
    const fileExtensions = await promptMultiSelect({
      message,
      options: [
        { value: 'json', label: FILE_EXT_TO_EXT_LABEL.json },
        { value: 'md', label: FILE_EXT_TO_EXT_LABEL.md },
        { value: 'mdx', label: FILE_EXT_TO_EXT_LABEL.mdx },
        { value: 'ts', label: FILE_EXT_TO_EXT_LABEL.ts },
        { value: 'js', label: FILE_EXT_TO_EXT_LABEL.js },
        { value: 'yaml', label: FILE_EXT_TO_EXT_LABEL.yaml },
      ],
      required: !isUsingGT,
    });

    const files: FilesOptions = {};
    for (const fileExtension of fileExtensions) {
      const paths = await promptText({
        message: `${chalk.cyan(FILE_EXT_TO_EXT_LABEL[fileExtension])}: Please enter a space-separated list of glob patterns matching the location of the ${FILE_EXT_TO_EXT_LABEL[fileExtension]} files you would like to translate.\nMake sure to include [locale] in the patterns.\nSee https://generaltranslation.com/docs/cli/reference/config#include for more information.`,
        defaultValue: `./**/[locale]/*.${fileExtension}`,
      });

      files[fileExtension] = {
        include: paths.split(' '),
      };
    }

    // Add GT translations if using GT and storing locally
    if (isUsingGT && !usingCDN) {
      files.gt = {
        output: path.join(finalTranslationsDir, `[locale].json`),
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
      publish: isUsingGT && usingCDN,
    });

    logger.success(
      `Edit ${chalk.cyan(
        configFilepath
      )} to customize your translation setup. Docs: https://generaltranslation.com/docs/cli/reference/config`
    );

    // Install gtx-cli if not installed
    const isCLIInstalled = packageJson
      ? isPackageInstalled('gtx-cli', packageJson, true, true)
      : true; // if no package.json, we can't install it

    if (!isCLIInstalled) {
      const packageManager = await getPackageManager();
      const spinner = logger.createSpinner();
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
