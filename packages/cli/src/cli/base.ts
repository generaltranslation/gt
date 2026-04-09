import { Command } from 'commander';
import {
  DEFAULT_TRANSLATIONS_DIR,
  DEFAULT_VITE_TRANSLATIONS_DIR,
} from '../utils/constants.js';
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
import { upload } from './commands/upload.js';
import { attachSharedFlags, attachTranslateFlags } from './flags.js';
import { handleStage } from './commands/stage.js';
import { handleSetupProject } from './commands/setupProject.js';
import { handleDownload } from './commands/download.js';
import {
  handleTranslate,
  postProcessTranslations,
} from './commands/translate.js';
import {
  getNeedsPostprocessing,
  clearDownloaded,
} from '../state/recentDownloads.js';
import { clearWarnings } from '../state/translateWarnings.js';
import { displayTranslateSummary } from '../console/displayTranslateSummary.js';
import updateConfig from '../fs/config/updateConfig.js';
import { createLoadTranslationsFile } from '../fs/createLoadTranslationsFile.js';
import { saveLocalEdits } from '../api/saveLocalEdits.js';
import processSharedStaticAssets, {
  mirrorAssetsToLocales,
} from '../utils/sharedStaticAssets.js';
import { setupLocadex } from '../locadex/setupFlow.js';
import { detectFramework } from '../setup/detectFramework.js';
import {
  getFrameworkDisplayName,
  getReactFrameworkLibrary,
} from '../setup/frameworkUtils.js';
import { INLINE_LIBRARIES } from '../types/libraries.js';
import { handleEnqueue } from './commands/enqueue.js';

export type UploadOptions = {
  config?: string;
  apiKey?: string;
  projectId?: string;
  defaultLocale?: string;
};

export type LoginOptions = {
  config?: string;
  keyType?: 'development' | 'production' | 'all';
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

    this.program.option(
      '--skip-version-check',
      'Skip the monorepo GT package version consistency check'
    );

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
    this.setupDownloadCommand();
    this.setupEnqueueCommand();
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

  /**
   * Enqueues translations for a given set of files
   * @param initOptions - The options for the command
   * @returns The results of the command
   */
  protected setupEnqueueCommand(): void {
    attachTranslateFlags(
      this.program
        .command('enqueue')
        .description('Enqueues translations for a given set of files')
    ).action(async (initOptions: TranslateFlags) => {
      displayHeader('Enqueuing translations...');
      await this.handleEnqueue(initOptions);
      logger.endCommand('Done!');
    });
  }

  /**
   * Downloads translations that were originally staged
   * @param initOptions - The options for the command
   * @returns The results of the command
   */
  protected setupDownloadCommand(): void {
    attachTranslateFlags(
      this.program
        .command('download')
        .description('Download translations that were originally staged')
    ).action(async (initOptions: TranslateFlags) => {
      displayHeader('Downloading translations...');
      await this.handleDownload(initOptions);
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
    )
      .option('--publish', 'Publish translations to the CDN', false)
      .action(async (initOptions: SharedFlags) => {
        displayHeader('Saving local edits...');
        const settings = await generateSettings(initOptions, undefined, { requireConfig: true });
        await saveLocalEdits(settings);
        logger.endCommand('Saved local edits');
      });
  }

  protected async handleSetupProject(
    initOptions: TranslateFlags
  ): Promise<void> {
    const settings = await generateSettings(initOptions, undefined, { requireConfig: true });

    // Preprocess shared static assets if configured (move + rewrite sources)
    await processSharedStaticAssets(settings);

    await handleSetupProject(initOptions, settings, this.library);
  }

  protected async handleStage(initOptions: TranslateFlags): Promise<void> {
    const settings = await generateSettings(initOptions, undefined, { requireConfig: true });

    // Preprocess shared static assets if configured (move + rewrite sources)
    await processSharedStaticAssets(settings);

    if (!settings.stageTranslations) {
      // Update settings.stageTranslations to true
      settings.stageTranslations = true;
      await updateConfig(settings.config, {
        stageTranslations: true,
      });
    }
    await handleStage(initOptions, settings, this.library, true);
  }

  /**
   * Enqueues translations for a given set of files
   * @param initOptions - The options for the command
   * @returns The results of the command
   */
  protected async handleEnqueue(initOptions: TranslateFlags): Promise<void> {
    const settings = await generateSettings(initOptions, undefined, { requireConfig: true });
    await handleEnqueue(initOptions, settings, this.library);
  }

  /**
   * Downloads translations that were originally staged
   * @param initOptions - The options for the command
   * @returns The results of the command
   */
  protected async handleDownload(initOptions: TranslateFlags): Promise<void> {
    const settings = await generateSettings(initOptions, undefined, { requireConfig: true });
    await handleDownload(initOptions, settings, this.library);
  }

  protected async handleTranslate(initOptions: TranslateFlags): Promise<void> {
    const settings = await generateSettings(initOptions, undefined, { requireConfig: true });

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
          results.branchData,
          results.publishMap
        );
      }
    } else {
      await handleDownload(initOptions, settings, this.library);
    }
    // Only postprocess files downloaded in this run
    const include = getNeedsPostprocessing();
    if (include.size > 0) {
      await postProcessTranslations(settings, include);
    }
    // Mirror assets after translations are downloaded and locale dirs are populated
    await mirrorAssetsToLocales(settings);
    clearDownloaded();
    displayTranslateSummary();
    clearWarnings();
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
      const settings = await generateSettings(initOptions, undefined, { requireConfig: true });

      const options = { ...initOptions, ...settings };

      await this.handleUploadCommand(options);
      logger.endCommand('Done!');
    });
  }

  protected setupLoginCommand(): void {
    this.program
      .command('auth')
      .description('Generate General Translation API keys and project ID')
      .option(
        '-c, --config <path>',
        'Filepath to config file, by default gt.config.json',
        findFilepath(['gt.config.json'])
      )
      .option(
        '-t, --key-type <type>',
        'Type of key to generate, production | development | all'
      )
      .action(async (options: LoginOptions) => {
        displayHeader('Authenticating with General Translation...');
        if (!options.keyType) {
          options.keyType = await promptSelect<
            'development' | 'production' | 'all'
          >({
            message: 'What type of API key would you like to generate?',
            options: [
              { value: 'development', label: 'Development' },
              { value: 'production', label: 'Production' },
              { value: 'all', label: 'Both' },
            ],
            defaultValue: 'all',
          });
        } else {
          if (
            options.keyType !== 'development' &&
            options.keyType !== 'production' &&
            options.keyType !== 'all'
          ) {
            logErrorAndExit(
              'Invalid key type, must be development, production, or all'
            );
          }
        }
        await this.handleLoginCommand(options);
        logger.endCommand(
          `Done! ${options.keyType} keys have been generated and saved to your .env.local file.`
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
          // Get framework display info for the defaults message
          const frameworkDisplayName =
            framework.type === 'react'
              ? getFrameworkDisplayName(framework)
              : null;
          const library =
            framework.type === 'react'
              ? getReactFrameworkLibrary(framework)
              : null;

          // Build defaults description based on detected framework
          const defaultTranslationsDir =
            framework.name === 'vite'
              ? DEFAULT_VITE_TRANSLATIONS_DIR
              : DEFAULT_TRANSLATIONS_DIR;

          const defaultsDescription =
            framework.type === 'react'
              ? `${library} & GTProvider, ${frameworkDisplayName}, Files saved locally in ${defaultTranslationsDir}`
              : `Files saved locally in ${defaultTranslationsDir}`;

          // Ask if user wants to use defaults
          const useDefaults = await promptConfirm({
            message: `Would you like to use the recommended General Translation defaults? ${chalk.dim(`(${defaultsDescription})`)}`,
            defaultValue: true,
          });

          let ranReactSetup = false;

          // so that people can run init in non-js projects
          if (framework.type === 'react') {
            const wrap = useDefaults
              ? true
              : await promptConfirm({
                  message: `Would you like to install ${library} and add the GTProvider? See the docs for more information: https://generaltranslation.com/docs/react/tutorials/quickstart`,
                  defaultValue: true,
                });

            if (wrap) {
              logger.info(
                `${chalk.yellow('[EXPERIMENTAL]')} Configuring project...`
              );
              await handleSetupReactCommand(options, framework, useDefaults);
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
          await this.handleInitCommand(
            ranReactSetup,
            useDefaults,
            framework.name === 'vite'
          );

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
        const framework = await detectFramework();
        await this.handleInitCommand(false, false, framework.name === 'vite');

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

  // Wizard for configuring gt.config.json
  protected async handleInitCommand(
    ranReactSetup: boolean,
    useDefaults: boolean = false,
    isVite: boolean = false
  ): Promise<void> {
    const { defaultLocale, locales } = await getDesiredLocales(); // Locales should still be asked for even if using defaults

    const packageJson = await searchForPackageJson();

    // Ask if using another i18n library
    const gtInstalled =
      !!packageJson &&
      INLINE_LIBRARIES.some((lib) => isPackageInstalled(lib, packageJson));
    const isUsingGT = ranReactSetup || gtInstalled;

    // Ask where the translations are stored
    const usingCDN = await (async () => {
      if (!isUsingGT) return false;
      if (useDefaults) return false; // Default to local
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

    const defaultTranslationsDir = isVite
      ? DEFAULT_VITE_TRANSLATIONS_DIR
      : DEFAULT_TRANSLATIONS_DIR;

    // Ask where the translations are stored
    const translationsDir =
      isUsingGT && !usingCDN
        ? useDefaults
          ? defaultTranslationsDir
          : await promptText({
              message:
                'What is the path to the directory where you would like to store your translation files?',
              defaultValue: defaultTranslationsDir,
            })
        : null;

    // Determine final translations directory with fallback
    const finalTranslationsDir =
      translationsDir?.trim() || defaultTranslationsDir;

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
    const fileExtensions =
      useDefaults && isUsingGT
        ? [] // Skip for GT projects when using defaults
        : await promptMultiSelect({
            message,
            options: [
              { value: 'json', label: FILE_EXT_TO_EXT_LABEL.json },
              { value: 'md', label: FILE_EXT_TO_EXT_LABEL.md },
              { value: 'mdx', label: FILE_EXT_TO_EXT_LABEL.mdx },
              { value: 'ts', label: FILE_EXT_TO_EXT_LABEL.ts },
              { value: 'js', label: FILE_EXT_TO_EXT_LABEL.js },
              { value: 'yaml', label: FILE_EXT_TO_EXT_LABEL.yaml },
              // TWILIO_CONTENT_JSON not supported in CLI init as its too niche
            ],
            required: !isUsingGT,
          });

    const files: FilesOptions = {};
    for (const fileExtension of fileExtensions) {
      const paths = await promptText({
        message: `${chalk.cyan(FILE_EXT_TO_EXT_LABEL[fileExtension])}: Enter a space-separated list of glob patterns matching the location of the ${FILE_EXT_TO_EXT_LABEL[fileExtension]} files you would like to translate.\nMake sure to include [locale] in the patterns.\nSee https://generaltranslation.com/docs/cli/reference/config#include for more information.`,
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

    // Install gt if not installed
    const isCLIInstalled = packageJson
      ? isPackageInstalled('gt', packageJson, true, true)
      : true; // if no package.json, we can't install it

    if (!isCLIInstalled) {
      const packageManager = await getPackageManager();
      const spinner = logger.createSpinner();
      spinner.start(
        `Installing gt as a dev dependency with ${packageManager.name}...`
      );
      await installPackage('gt', packageManager, true);
      spinner.stop(chalk.green('Installed gt.'));
    }

    // Set credentials
    if (!areCredentialsSet()) {
      const loginQuestion = useDefaults
        ? true
        : await promptConfirm({
            message:
              'Would you like the wizard to automatically generate API keys and a project ID for you?',
            defaultValue: true,
          });
      if (loginQuestion) {
        const settings = await generateSettings({});
        const keyType = useDefaults
          ? 'all'
          : await promptSelect<'development' | 'production' | 'all'>({
              message: 'What type of API key would you like to generate?',
              options: [
                { value: 'development', label: 'Development' },
                { value: 'production', label: 'Production' },
                { value: 'all', label: 'Both' },
              ],
              defaultValue: 'all',
            });
        const credentials = await retrieveCredentials(settings, keyType);
        await setCredentials(credentials, settings.framework);
      }
    }
  }
  protected async handleLoginCommand(options: LoginOptions): Promise<void> {
    const settings = await generateSettings({ config: options.config });
    const keyType = options.keyType || 'all';
    const credentials = await retrieveCredentials(settings, keyType);
    await setCredentials(credentials, settings.framework);
  }
}
