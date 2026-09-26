import { Command, InvalidArgumentError, Option } from 'commander';
import { ProjectApiKeyPermission } from 'generaltranslation/api';
import {
  DEFAULT_TRANSLATIONS_DIR,
  DEFAULT_VITE_TRANSLATIONS_DIR,
} from '../utils/constants.js';
import {
  createOrUpdateConfig,
  mergeSetupConfig,
  type SetupConfigUpdate,
} from '../fs/config/setupConfig.js';
import findFilepath from '../fs/findFilepath.js';
import {
  displayHeader,
  promptText,
  logErrorAndExit,
  exitSync,
  promptConfirm,
  promptMultiSelect,
  promptSelect,
  promptGlobPatterns,
} from '../console/logging.js';
import { logger } from '../console/logger.js';
import { lottieTranslateError } from '../console/index.js';
import { parseGlobPatterns } from '../console/promptParsing.js';
import path from 'node:path';
import fs from 'node:fs';
import YAML from 'yaml';
import {
  FilesOptions,
  FrameworkObject,
  Settings,
  SupportedFrameworks,
  SupportedLibraries,
  SupportedReactFrameworks,
  TranslateFlags,
  SharedFlags,
} from '../types/index.js';
import { generateSettings } from '../config/generateSettings.js';
import chalk from 'chalk';
import { FILE_EXT_TO_EXT_LABEL } from '../formats/files/supportedFiles.js';
import {
  executeReactSetup,
  resolveReactSetup,
  type ReactSetupPlan,
} from '../setup/wizard.js';
import {
  isPackageInstalled,
  searchForPackageJson,
} from '../utils/packageJson.js';
import { getDesiredLocales } from '../setup/userInput.js';
import {
  areCredentialsSet,
  getDevelopmentEnvNames,
  inspectCredentialsEnvFile,
} from '../utils/credentials.js';
import {
  checkDevelopmentProjectInputs,
  provisionDevelopmentCredentials,
  resolveDevelopmentProject,
} from '../setup/developmentCredentials.js';
import {
  asRecord,
  attachConfigureFlags,
  attachInitFlags,
  installWithProgress,
  OnboardingError,
  parseFilePatterns,
  readSetupConfig,
  resolvePackageManager,
  runOnboarding,
  SETUP_FILE_FORMATS,
  SETUP_REACT_FRAMEWORKS,
  validateSetupPattern,
  type ConfigureOptions,
  type InitOptions,
  type OnboardingSession,
  type SetupFileFormat,
} from '../setup/onboarding.js';
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
import { resolveProjectId } from '../fs/utils.js';
import {
  hasValidCredentials,
  hasValidServiceLocales,
} from './commands/utils/validation.js';
import processSharedStaticAssets, {
  mirrorAssetsToLocales,
} from '../utils/sharedStaticAssets.js';
import { setupLocadex } from '../locadex/setupFlow.js';
import { detectFramework } from '../setup/detectFramework.js';
import {
  getFrameworkDisplayName,
  getReactFrameworkLibrary,
} from '../setup/frameworkUtils.js';
import { INLINE_LIBRARIES, Libraries } from '../types/libraries.js';
import { handleEnqueue } from './commands/enqueue.js';
import { splitMintlifyLanguageRefs } from '../utils/splitMintlifyLanguageRefs.js';
import { runMergeDriver } from '../git/mergeDrivers.js';
import { setupGitMergeDrivers } from '../git/setupMergeDrivers.js';
import { warnReactPackageCompatibility } from '../utils/reactPackageCompatibility.js';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
import {
  hasLogin,
  login,
  logout,
  whoAmI,
  type DeviceCode,
} from '../auth/oauth.js';
import { UserAuthError } from '../auth/errors.js';
import { resolveConfig } from '../config/resolveConfig.js';
import {
  inspectViteSPA,
  setupViteSPA,
  writeViteLoader,
} from '../setup/setupViteSPA.js';
import { manifestDirectlyDeclaresGTVue } from '@generaltranslation/vue-extractor/integration';
import { api } from '../utils/api.js';
import { handleApiCommand, type ApiCommandOptions } from './commands/api.js';

const ID_COMPATIBILITY_WARNING_COMMANDS = new Set([
  'download',
  'enqueue',
  'generate',
  'setup',
  'stage',
  'translate',
  'validate',
]);
const workspaceRootSetupError = createDiagnosticMessage({
  source: 'gt',
  severity: 'Error',
  whatHappened: 'The setup wizard cannot run from a monorepo workspace root',
  why: 'GT must be configured in the specific app you want to localize',
  fix: "Change to that app's directory and rerun `npx gt@latest`",
});
function createProjectCommandError(
  whatHappened: string,
  error: unknown
): string {
  return createDiagnosticMessage({
    source: 'gt',
    severity: 'Error',
    whatHappened,
    details: formatDiagnosticErrorDetails(error),
  });
}

const emptyApiKeyNameError = createDiagnosticMessage({
  whatHappened: 'The key name cannot be empty',
  fix: 'Pass a non-empty value with --name',
});

function parseApiKeyName(value: string): string {
  const name = value.trim();
  if (!name) throw new InvalidArgumentError(emptyApiKeyNameError);
  return name;
}

const electronSetupError = createDiagnosticMessage({
  source: 'gt',
  severity: 'Error',
  whatHappened:
    'The automatic setup wizard is not ready for Electron applications',
  docsUrl: 'https://generaltranslation.com/docs/react',
});

/** .env.local never reaches production; the runtime key there is set on the host. */
function productionRuntimeKeyGuidance(dashboardUrl: string): string {
  return `${chalk.dim('For runtime translation in production, create an API key in the dashboard')} ${chalk.cyan(dashboardUrl)} ${chalk.dim('and set GT_API_KEY and GT_PROJECT_ID in your hosting environment.')}`;
}

async function loginInteractively(
  baseUrl: string | undefined,
  useBrowser = true,
  onDeviceCode?: (deviceCode: DeviceCode) => void
): Promise<void> {
  await login({
    baseUrl,
    noBrowser: !useBrowser,
    onDeviceCode: (deviceCode) => {
      const { userCode, verificationUri, verificationUriComplete } = deviceCode;
      onDeviceCode?.(deviceCode);
      logger.message(
        `Visit:\n\n${chalk.cyan(verificationUriComplete ?? verificationUri)}\n\n${verificationUriComplete ? '' : `Then enter the code ${chalk.bold(userCode)}.\n`}Waiting for authentication...`
      );
    },
    onAuthorizationUrl: (url) => {
      logger.message(
        `Opening your browser to sign in. If it does not open, visit:\n${chalk.cyan(url)}`
      );
    },
  });
}

/**
 * Interactive setup keeps the browser login with its device fallback;
 * noninteractive setup always shows a device code (and emits it as a JSON
 * event) and waits for a person to approve it, without opening a browser.
 */
async function signInForSetup(
  session: OnboardingSession,
  baseUrl: string | undefined
): Promise<void> {
  try {
    await loginInteractively(baseUrl, session.interactive, (deviceCode) =>
      session.emit({ type: 'authorization_required', ...deviceCode })
    );
  } catch (error) {
    throw new OnboardingError(createUserAuthError('Sign in failed', error));
  }
  logger.message('You are now signed in.');
}

function createUserAuthError(whatHappened: string, error: unknown): string {
  if (error instanceof UserAuthError) return error.message;
  return createDiagnosticMessage({
    source: 'gt',
    severity: 'Error',
    whatHappened,
    details: formatDiagnosticErrorDetails(error),
    fix: 'Run `gt login` and try again',
  });
}

/**
 * Whether workspace package patterns name packages besides the root itself.
 * A single app may list only '.' (or nothing, keeping pnpm settings there).
 */
function listsChildPackages(patterns: unknown): boolean {
  if (patterns === undefined || patterns === null) return false;
  if (!Array.isArray(patterns)) return true;
  return patterns.some(
    (pattern) =>
      typeof pattern !== 'string' || !/^(?:\.\/?|!.*)$/.test(pattern.trim())
  );
}

function isMonorepoRoot(packageJson: Record<string, unknown> | null): boolean {
  const pnpmWorkspace = path.join(process.cwd(), 'pnpm-workspace.yaml');
  if (fs.existsSync(pnpmWorkspace)) {
    let packages: unknown;
    try {
      packages = asRecord(
        YAML.parse(fs.readFileSync(pnpmWorkspace, 'utf8'))
      )?.packages;
    } catch {
      return true; // Unreadable: keep refusing, as for any workspace file.
    }
    if (listsChildPackages(packages)) return true;
  }
  const workspaces = packageJson?.workspaces;
  return listsChildPackages(
    Array.isArray(workspaces) ? workspaces : asRecord(workspaces)?.packages
  );
}

async function exitIfUnsupportedSetupTarget(): Promise<void> {
  const packageJson = await searchForPackageJson();
  if (packageJson && isPackageInstalled('electron', packageJson, false, true)) {
    throw new OnboardingError(electronSetupError);
  }
  if (isMonorepoRoot(packageJson)) {
    throw new OnboardingError(workspaceRootSetupError);
  }
}

const VITE_LOADER_FILE = 'src/loadTranslations.ts';

const INIT_SOURCE_HELP =
  "Space-separated list of glob patterns containing the app's source code, by default 'src/**/*.{js,jsx,ts,tsx}' 'app/**/*.{js,jsx,ts,tsx}' 'pages/**/*.{js,jsx,ts,tsx}' 'components/**/*.{js,jsx,ts,tsx}'";

function setupConfigPath(
  options: Pick<ConfigureOptions, 'config'>,
  isVite: boolean
): string {
  return (
    options.config ||
    (!isVite && fs.existsSync('src/gt.config.json')
      ? 'src/gt.config.json'
      : 'gt.config.json')
  );
}

function getConfiguredFramework(
  config: Record<string, unknown>
): SupportedReactFrameworks | 'mintlify' | undefined {
  const framework = config.framework;
  return typeof framework === 'string' &&
    [...SETUP_REACT_FRAMEWORKS, 'mintlify'].includes(
      framework as SupportedReactFrameworks
    )
    ? (framework as SupportedReactFrameworks | 'mintlify')
    : undefined;
}

/** JSON mode keeps the banner off stdout. */
function displaySetupHeader(session: OnboardingSession, message: string) {
  if (session.json) logger.startCommand(message);
  else displayHeader(message);
}

function describeDefaults(framework: FrameworkObject | undefined): string {
  const translationsDir =
    framework?.name === 'vite'
      ? DEFAULT_VITE_TRANSLATIONS_DIR
      : DEFAULT_TRANSLATIONS_DIR;
  if (framework?.type !== 'react') {
    return `Files saved locally in ${translationsDir}`;
  }
  const library = getReactFrameworkLibrary(framework);
  const setup = framework.name === 'vite' ? 'initializeGTSPA' : 'GTProvider';
  return `${library} & ${setup}, ${getFrameworkDisplayName(framework)}, Files saved locally in ${translationsDir}`;
}

/** Credential failures keep their own diagnostic or get the setup context. */
async function withCredentialsError<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof OnboardingError) throw error;
    throw new Error(
      error instanceof UserAuthError
        ? error.message
        : createProjectCommandError(
            'Failed to set up the development credentials',
            error
          )
    );
  }
}

export type UploadOptions = {
  config?: string;
  apiKey?: string;
  projectId?: string;
  defaultLocale?: string;
};

export type GitSetupOptions = {
  config?: string;
  dryRun?: boolean;
  omitConfigIds?: boolean;
  driverCommand?: string;
};

type LocalTranslationGuidanceOptions = {
  generatedLoader: boolean;
  runtimeSetup: InlineRuntimeSetup;
  translationsDir: string;
};

type InlineRuntimeSetup = {
  hasOtherInlineRuntime: boolean;
  hasVueRuntime: boolean;
  ranReactSetup: boolean;
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
    this.program.option(
      '--suppress-id-compatibility-warning',
      'Suppress the React package ID compatibility warning'
    );
    this.program.option(
      '-q, --quiet',
      'Suppress informational output; only warnings and errors are shown'
    );
    // Select console routing for this command before anything else logs:
    // root hooks run before subclass hooks (version checks) and the action's
    // settings resolution. `gt api-key create` prints the new secret on
    // stdout, so its diagnostics go to stderr, as do setup commands writing
    // JSON events; every other command gets the historical default back
    // (main() routes startup output to stderr).
    this.program.hook('preAction', (_thisCommand, actionCommand) => {
      logger.setConsoleOutput(
        actionCommand.parent?.name() === 'api-key' || actionCommand.opts().json
          ? 'stderr'
          : 'stdout'
      );
    });
    // Apply --quiet before any other hook or command action runs so the
    // singleton logger is muted for the rest of the invocation. The flag is a
    // global root option, so commander resolves it in any position and for
    // nested commands (e.g. `gt git setup --quiet`).
    this.program.hook('preAction', () => {
      logger.setQuiet(Boolean(this.program.opts().quiet));
    });
    this.program.hook('preAction', async (thisCommand, actionCommand) => {
      // Nested commands (e.g. `gt git setup`) can share leaf names with
      // translation commands; only direct children of the root qualify
      if (actionCommand.parent !== thisCommand) return;
      if (!ID_COMPATIBILITY_WARNING_COMMANDS.has(actionCommand.name())) return;
      await warnReactPackageCompatibility(
        Boolean(this.program.opts().suppressIdCompatibilityWarning)
      );
    });

    this.setupInitCommand();
    this.setupConfigureCommand();
    this.setupUploadCommand();
    this.setupUserAuthCommands();
    this.setupSendDiffsCommand();
    this.setupApiCommand();
    this.setupProjectCommands();
    this.setupApiKeyCommands();
    this.setupGitCommand();
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
        const settings = await generateSettings(initOptions, undefined, {
          requireConfig: true,
        });
        if (!hasValidCredentials(settings) || !hasValidServiceLocales(settings))
          return exitSync(1);
        await saveLocalEdits(settings);
        logger.endCommand('Saved local edits');
      });
  }

  protected setupApiCommand(): void {
    attachSharedFlags(
      this.program
        .command('api [endpoint]')
        .description('Make an authenticated request to the GT API')
        .option('-X, --method <method>', 'HTTP method', 'GET')
        .option('--input <file>', 'Request body file, or - for standard input')
        .option(
          '-H, --header <header>',
          'Request header in "Key: Value" format',
          (header, headers: string[] | undefined) => [
            ...(headers ?? []),
            header,
          ]
        )
        .option('-i, --include', 'Include response status and headers')
        .option('--spec', 'Print the bundled OpenAPI specification')
    ).action((endpoint, options: ApiCommandOptions) =>
      handleApiCommand(endpoint, options)
    );
  }

  protected setupProjectCommands(): void {
    const projectCommand = this.program
      .command('project')
      .description('Manage General Translation projects');

    attachSharedFlags(
      projectCommand
        .command('create')
        .description(
          'Create a General Translation project using an organization API key'
        )
        .requiredOption('--org-id <orgId>', 'Organization ID')
        .requiredOption('--name <name>', 'Project name')
        .requiredOption('--default-locale <locale>', 'Project default locale')
        .option('--cdn-enabled', 'Enable CDN delivery', false)
    ).action(async (options) => {
      try {
        const settings = await generateSettings(options);
        // Project creation happens before a project ID exists.
        if (!hasValidServiceLocales(settings)) return exitSync(1);
        const { project } = await api.createProject(options.orgId, {
          name: options.name,
          defaultLocale: options.defaultLocale,
          cdnEnabled: options.cdnEnabled,
        });
        logger.info(`Created ${project.name} (${project.id})`);
      } catch (error) {
        return logErrorAndExit(
          createProjectCommandError('Failed to create the project', error)
        );
      }
    });

    attachSharedFlags(
      projectCommand
        .command('status')
        .description('Check the status of a project setup job')
        .argument('<job-id>', 'Setup job ID')
    ).action(async (jobId, options) => {
      try {
        const settings = await generateSettings(options);
        if (!hasValidCredentials(settings)) return exitSync(1);
        const [status] = await api.checkJobStatus([jobId]);
        logger.info(status?.status ?? 'unknown');
      } catch (error) {
        return logErrorAndExit(
          createProjectCommandError(
            'Failed to check the project setup status',
            error
          )
        );
      }
    });
  }

  protected setupApiKeyCommands(): void {
    const apiKeyCommand = this.program
      .command('api-key')
      .description('Manage API keys for the configured project');

    attachSharedFlags(
      apiKeyCommand
        .command('create')
        .description(
          'Create a project API key with the requested permissions and print it once'
        )
        .requiredOption('--name <name>', 'Key name', parseApiKeyName)
        // Validated before any request; the server grants the requested set
        // all-or-nothing, so omitting permissions would delegate everything.
        .addOption(
          new Option('--permission <permissions...>', 'Permissions to grant')
            .choices(Object.values(ProjectApiKeyPermission))
            .makeOptionMandatory()
        )
    ).action(
      async (
        options: SharedFlags & {
          name: string;
          permission: ProjectApiKeyPermission[];
        }
      ) => {
        try {
          const settings = await generateSettings(options);
          if (!hasValidCredentials(settings)) return exitSync(1);
          const { apiKey } = await api.createProjectApiKey(settings.projectId, {
            name: options.name,
            permissions: options.permission,
          });
          // Raw stdout: the secret is shown once and never reaches the log file.
          process.stdout.write(`${apiKey.key}\n`);
        } catch (error) {
          return logErrorAndExit(
            error instanceof UserAuthError
              ? error.message
              : createProjectCommandError('Failed to create the API key', error)
          );
        }
      }
    );
  }

  protected setupGitCommand(): void {
    const gitCommand = this.program
      .command('git')
      .description('Configure Git integrations for General Translation');

    gitCommand
      .command('setup')
      .description('Set up GT merge drivers for generated translation files')
      .option(
        '-c, --config <path>',
        'Filepath to config file, by default gt.config.json',
        findFilepath(['gt.config.json'])
      )
      .option('--dry-run', 'Print changes without writing files', false)
      .option(
        '--omit-config-ids',
        'Persist omitConfigIds and remove generated config IDs'
      )
      .option(
        '--driver-command <command>',
        'Command Git should use to invoke gt, e.g. "pnpm exec gt"'
      )
      .action(async (options: GitSetupOptions) => {
        displayHeader('Setting up GT Git merge drivers...');
        const settings = await generateSettings(options, undefined, {
          requireConfig: true,
        });
        const omitConfigIds = await this.resolveGitSetupOmitConfigIds(
          options,
          settings
        );
        const result = await setupGitMergeDrivers(settings, {
          dryRun: options.dryRun,
          omitConfigIds,
          driverCommand: options.driverCommand,
        });

        for (const line of result.addedAttributes) {
          logger.step(
            `${options.dryRun ? 'Would add' : 'Added'} ${chalk.cyan(
              line
            )} to ${chalk.cyan(result.gitattributesPath)}`
          );
        }
        if (result.addedAttributes.length === 0) {
          logger.info(`${chalk.cyan('.gitattributes')} is already configured.`);
        }

        for (const args of result.gitConfigCommands) {
          logger.step(
            `${options.dryRun ? 'Would run' : 'Configured'} ${chalk.cyan(
              `git config --local ${args.join(' ')}`
            )}`
          );
        }

        if (result.updatedConfig) {
          logger.step(
            `${options.dryRun ? 'Would persist' : 'Persisted'} ${chalk.cyan(
              'omitConfigIds: true'
            )} in ${chalk.cyan(settings.config)}`
          );
        } else if (options.dryRun && !settings.omitConfigIds) {
          logger.info(
            `Run without ${chalk.cyan('--dry-run')} to be prompted to persist ${chalk.cyan(
              'omitConfigIds: true'
            )}, or pass ${chalk.cyan('--omit-config-ids')}.`
          );
        }

        for (const warning of result.warnings) {
          logger.warn(chalk.yellow(warning));
        }

        logger.endCommand(
          options.dryRun
            ? 'Dry run complete.'
            : 'GT Git merge drivers configured.'
        );
      });

    gitCommand
      .command('merge-driver', { hidden: true })
      .argument('<driver>', 'Merge driver name')
      .argument('<base>', 'Common ancestor file')
      .argument('<ours>', 'Current branch file')
      .argument('<theirs>', 'Incoming branch file')
      .argument('[path]', 'Merged path')
      .action((driver: string, base: string, ours: string, theirs: string) => {
        if (driver !== 'gt-lock' && driver !== 'gtjson') {
          logger.error(`Unknown GT merge driver: ${driver}`);
          exitSync(1);
        }
        const result = runMergeDriver(driver, base, ours, theirs);
        if (!result.ok) {
          logger.error(result.reason);
          exitSync(1);
        }
      });
  }

  protected async resolveGitSetupOmitConfigIds(
    options: GitSetupOptions,
    settings: Settings
  ): Promise<boolean> {
    if (options.omitConfigIds) return true;
    // Already opted in: persist again so stale config IDs still get removed
    if (settings.omitConfigIds) return true;
    if (options.dryRun || !process.stdin.isTTY || !process.stdout.isTTY) {
      return false;
    }
    return promptConfirm({
      message:
        'Also set omitConfigIds: true to reduce gt.config.json merge conflicts?',
      defaultValue: true,
    });
  }

  protected async handleSetupProject(
    initOptions: TranslateFlags
  ): Promise<void> {
    const settings = await generateSettings(initOptions, undefined, {
      requireConfig: true,
    });

    // Preprocess shared static assets if configured (move + rewrite sources)
    await processSharedStaticAssets(settings);

    await handleSetupProject(initOptions, settings, this.library);
  }

  protected async handleStage(initOptions: TranslateFlags): Promise<void> {
    const settings = await generateSettings(initOptions, undefined, {
      requireConfig: true,
    });

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
    const settings = await generateSettings(initOptions, undefined, {
      requireConfig: true,
    });
    await handleEnqueue(initOptions, settings, this.library);
  }

  /**
   * Downloads translations that were originally staged
   * @param initOptions - The options for the command
   * @returns The results of the command
   */
  protected async handleDownload(initOptions: TranslateFlags): Promise<void> {
    const settings = await generateSettings(initOptions, undefined, {
      requireConfig: true,
    });
    await handleDownload(initOptions, settings, this.library);
  }

  protected async handleTranslate(initOptions: TranslateFlags): Promise<void> {
    const settings = await generateSettings(initOptions, undefined, {
      requireConfig: true,
    });

    // Preprocess shared static assets if configured (move + rewrite sources)
    await processSharedStaticAssets(settings);

    if (!settings.stageTranslations) {
      // Lottie translations finish asynchronously server-side (layout
      // refinement runs after the translation job completes), so the immediate
      // translate flow would try to download them before they're ready. Only
      // the stage + download flow supports them.
      if (settings.files?.resolvedPaths.lottie?.length) {
        return logErrorAndExit(lottieTranslateError);
      }
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
          results.publishMap,
          results.inlineLibrary
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
    // Split Mintlify language entries into $ref files to keep docs.json small
    await splitMintlifyLanguageRefs(settings);
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
      const settings = await generateSettings(initOptions, undefined, {
        requireConfig: true,
      });

      const options = { ...initOptions, ...settings };

      await this.handleUploadCommand(options);
      logger.endCommand('Done!');
    });
  }

  protected setupUserAuthCommands(): void {
    this.program
      .command('login')
      .description('Sign in to your General Translation account')
      .option(
        '--no-browser',
        'Do not open a browser; show a sign-in URL to use on any device instead'
      )
      .action(async (options: { browser: boolean }) => {
        displayHeader('Signing in to General Translation...');
        try {
          // Tokens are bound to one API resource, so log in to the configured one.
          const baseUrl = resolveConfig(process.cwd())?.config.baseUrl;
          await loginInteractively(
            typeof baseUrl === 'string' ? baseUrl : undefined,
            options.browser
          );
          logger.endCommand('You are now signed in.');
        } catch (error) {
          logErrorAndExit(createUserAuthError('Sign in failed', error));
        }
      });

    this.program
      .command('logout')
      .description('Sign out of your General Translation account')
      .action(async () => {
        try {
          await logout();
          logger.endCommand('Signed out successfully.');
        } catch (error) {
          logErrorAndExit(createUserAuthError('Sign out failed', error));
        }
      });

    this.program
      .command('whoami')
      .description('Show the signed-in General Translation account')
      .action(async () => {
        try {
          const user = await whoAmI();
          logger.message(user.email ?? user.name ?? user.sub);
        } catch (error) {
          logErrorAndExit(
            createUserAuthError('Could not load your account', error)
          );
        }
      });
  }

  protected setupInitCommand(): void {
    attachInitFlags(
      this.program
        .command('init')
        .description(
          'Run the setup wizard to configure your project for General Translation. Flags answer its questions; unanswered ones are asked, or listed as missing with --no-interactive'
        ),
      INIT_SOURCE_HELP
    ).action((options: InitOptions) => this.handleInitWizard(options));
  }

  protected async handleInitWizard(options: InitOptions): Promise<void> {
    await runOnboarding('init', options, async (session) => {
      await exitIfUnsupportedSetupTarget();
      displaySetupHeader(session, 'Running setup wizard...');

      const detected = await detectFramework();
      const reactDetected = detected.type === 'react' ? detected : undefined;
      if (options.framework && !reactDetected) {
        session.reject(
          '--framework applies only to projects detected as React applications'
        );
      }
      // One config file for the whole run, even if the framework changes.
      const configFilepath = setupConfigPath(options, detected.name === 'vite');
      const configured = getConfiguredFramework(
        readSetupConfig(configFilepath)
      );
      const configuredReact =
        configured !== 'mintlify' ? configured : undefined;
      // Explicit --defaults / --no-defaults also answer the Locadex gate.
      if (options.defaults !== undefined) session.defaults = options.defaults;
      const gateFramework = options.framework ?? configured ?? detected.name;
      if (gateFramework === 'mintlify' || gateFramework === 'next-app') {
        const useLocadex = await session.answer('--locadex', {
          explicit: options.locadex,
          recommended: false,
          ask: () =>
            promptConfirm({
              message:
                gateFramework === 'mintlify'
                  ? `Mintlify project detected. Would you like to connect to GitHub so that the Locadex AI Agent can translate your project automatically?`
                  : `Next.js App Router detected. Would you like to connect to GitHub so that the Locadex AI Agent can set up your project automatically?`,
              defaultValue: false,
            }),
        });
        if (useLocadex) {
          session.assertResolved();
          const url = await setupLocadex(
            await generateSettings({ config: options.config }),
            { openBrowser: session.interactive }
          );
          session.emit({ type: 'handoff', url, reason: 'locadex' });
          logger.endCommand(
            'Once installed, Locadex will open a PR to your repository. See the docs for more information: https://generaltranslation.com/docs/locadex'
          );
          return { outcome: 'needs_human_action', url };
        }
      } else if (options.locadex) {
        session.reject(
          '--locadex applies only to Mintlify and Next.js App Router projects'
        );
      }

      const shownFramework = reactDetected && {
        ...reactDetected,
        name: options.framework ?? configuredReact ?? reactDetected.name,
      };
      session.defaults =
        options.defaults ??
        (session.interactive
          ? await promptConfirm({
              message: `Would you like to use the recommended General Translation defaults? ${chalk.dim(`(${describeDefaults(shownFramework)})`)}`,
              defaultValue: true,
            })
          : false);

      const reactSetup = reactDetected
        ? await resolveReactSetup(
            session,
            options,
            reactDetected,
            configuredReact
          )
        : undefined;
      // flag > gt.config.json > detection, used for every later step.
      const framework =
        reactSetup?.framework ??
        options.framework ??
        configured ??
        detected.name;
      await this.handleInitCommand(session, options, {
        configFilepath,
        isVite: framework === 'vite',
        framework,
        saveFramework: Boolean(reactSetup || options.framework),
        reactSetup,
        keepAppSource: !reactSetup,
      });

      logger.endCommand(
        'Done! Check out our docs for more information on how to use General Translation: https://generaltranslation.com/docs'
      );
      return { outcome: 'success' };
    });
  }

  protected setupConfigureCommand(): void {
    attachConfigureFlags(
      this.program
        .command('configure')
        .description(
          'Configure your project for General Translation. This will create a gt.config.json file in your codebase. Flags answer its questions; unanswered ones are asked, or listed as missing with --no-interactive'
        ),
      INIT_SOURCE_HELP
    ).action((options: ConfigureOptions) =>
      this.handleConfigureCommand(options)
    );
  }

  protected async handleConfigureCommand(
    options: ConfigureOptions,
    command: string = 'configure'
  ): Promise<void> {
    await runOnboarding(command, options, async (session) => {
      await exitIfUnsupportedSetupTarget();
      displaySetupHeader(session, 'Configuring project...');

      logger.info(
        'Welcome! This tool will help you configure your gt.config.json file. See the docs: https://generaltranslation.com/docs/cli/reference/config for more information.'
      );

      // Configure only offers the defaults when asked with --defaults.
      session.defaults = options.defaults ?? false;
      const detected = await detectFramework();
      // One config file for the whole run, even if the framework changes.
      const configFilepath = setupConfigPath(options, detected.name === 'vite');
      const framework =
        getConfiguredFramework(readSetupConfig(configFilepath)) ??
        (detected.name === 'vite' ? 'vite' : undefined);
      await this.handleInitCommand(session, options, {
        configFilepath,
        isVite: framework === 'vite',
        framework,
      });

      logger.endCommand(
        'Done! Make sure you have an API key and project ID to use General Translation. Get them on the dashboard: https://generaltranslation.com/dashboard'
      );
      return { outcome: 'success' };
    });
  }

  protected async handleUploadCommand(
    settings: Settings & UploadOptions
  ): Promise<void> {
    if (!settings.files) {
      return;
    }

    // Process all file types at once with a single call
    await upload(settings);
  }

  /** Describes installed runtimes without changing historical package lookup. */
  protected getInlineRuntimeSetup(
    packageJson: Record<string, unknown>,
    ranReactSetup: boolean = false
  ): InlineRuntimeSetup {
    return {
      hasOtherInlineRuntime: INLINE_LIBRARIES.some(
        (lib) =>
          lib !== Libraries.GT_VUE && isPackageInstalled(lib, packageJson)
      ),
      hasVueRuntime: manifestDirectlyDeclaresGTVue(packageJson),
      ranReactSetup,
    };
  }

  /** Returns whether any inline runtime is installed for setup. */
  protected isInlineRuntimeInstalled(
    packageJson: Record<string, unknown>
  ): boolean {
    const { hasOtherInlineRuntime, hasVueRuntime } =
      this.getInlineRuntimeSetup(packageJson);
    return hasOtherInlineRuntime || hasVueRuntime;
  }

  /** Returns whether every installed runtime can consume CDN translations. */
  protected supportsCDNStorage(runtimeSetup: InlineRuntimeSetup): boolean {
    return !runtimeSetup.hasVueRuntime;
  }

  /** Returns whether setup should generate a local runtime loader. */
  protected shouldGenerateLocalTranslationLoader(
    isVite: boolean,
    runtimeSetup: InlineRuntimeSetup
  ): boolean {
    if (isVite) return false;
    if (!runtimeSetup.hasVueRuntime) return true;
    return runtimeSetup.hasOtherInlineRuntime || runtimeSetup.ranReactSetup;
  }

  /** Returns framework guidance after selecting local translation storage. */
  protected getLocalTranslationGuidance({
    generatedLoader,
    runtimeSetup,
    translationsDir,
  }: LocalTranslationGuidanceOptions): string | undefined {
    const guidance: string[] = [];
    if (generatedLoader) {
      guidance.push(`Created ${chalk.cyan('loadTranslations.js')} file for local translations.
Make sure to add this function to your app configuration.
See https://generaltranslation.com/en/docs/next/guides/local-tx`);
    }
    if (runtimeSetup.hasVueRuntime) {
      guidance.push(`GT will write local translation files to ${translationsDir}.
Configure createGT({ loadTranslations }) to load files from that directory.
See https://www.npmjs.com/package/gt-vue`);
    }
    return guidance.length > 0 ? guidance.join('\n') : undefined;
  }

  /**
   * Resolves every configuration answer and validates the resulting config,
   * checks the project and signs in before the first change, then applies
   * the React setup, gt.config.json, installs and development credentials.
   */
  protected async handleInitCommand(
    session: OnboardingSession,
    options: ConfigureOptions,
    setup: {
      /** Chosen once by the entry point from the detected framework. */
      configFilepath: string;
      isVite: boolean;
      /** Resolved framework; drives storage, env names and Vite setup. */
      framework?: SupportedFrameworks;
      /** Write the framework even when it is not Vite. */
      saveFramework?: boolean;
      reactSetup?: ReactSetupPlan;
      /** Init without the React setup never changes application source. */
      keepAppSource?: boolean;
    }
  ): Promise<void> {
    const { configFilepath, isVite, reactSetup } = setup;
    const cwd = process.cwd();
    const existingConfig = readSetupConfig(configFilepath);
    const { defaultLocale, locales } = await getDesiredLocales(
      session,
      existingConfig,
      options
    );

    const packageJson =
      reactSetup?.packageJson ?? (await searchForPackageJson());
    const runtimeSetup: InlineRuntimeSetup = packageJson
      ? this.getInlineRuntimeSetup(packageJson, Boolean(reactSetup))
      : {
          hasOtherInlineRuntime: false,
          hasVueRuntime: false,
          ranReactSetup: false,
        };
    const isUsingGT =
      runtimeSetup.ranReactSetup ||
      runtimeSetup.hasOtherInlineRuntime ||
      runtimeSetup.hasVueRuntime;
    const supportsCDN = this.supportsCDNStorage(runtimeSetup);
    const existingFiles = asRecord(existingConfig.files) ?? {};
    const existingGtOutput = asRecord(existingFiles.gt)?.output;
    const configuredOutput =
      typeof existingGtOutput === 'string' ? existingGtOutput : undefined;
    const configuredStorage = configuredOutput
      ? 'local'
      : existingConfig.publish === true
        ? 'cdn'
        : undefined;

    if (isUsingGT && !supportsCDN && options.storage === 'cdn') {
      session.reject(
        'gt-vue cannot load translations from the CDN; use --storage local'
      );
    }
    // Where GT translations are stored
    const storage = !isUsingGT
      ? undefined
      : !supportsCDN
        ? 'local'
        : await session.answer<'local' | 'cdn'>('--storage', {
            explicit: options.storage,
            configured: configuredStorage,
            recommended: 'local',
            ask: () =>
              promptSelect<'local' | 'cdn'>({
                message: `Would you like to save translation files locally or use the General Translation CDN to store them?`,
                options: [
                  { value: 'local', label: 'Save locally' },
                  { value: 'cdn', label: 'Use CDN' },
                ],
                defaultValue: 'local',
              }),
          });

    const defaultTranslationsDir = isVite
      ? DEFAULT_VITE_TRANSLATIONS_DIR
      : DEFAULT_TRANSLATIONS_DIR;
    const configuredTranslationsDir = configuredOutput?.match(
      /^(.+)[\\/]\[locale\]\.json$/
    )?.[1];
    const translationsDir =
      storage === 'local'
        ? await session.answer('--translations-dir', {
            explicit: options.translationsDir?.trim() || undefined,
            configured: configuredTranslationsDir,
            recommended: defaultTranslationsDir,
            ask: async () =>
              (
                await promptText({
                  message:
                    'What is the path to the directory where you would like to store your translation files?',
                  defaultValue: defaultTranslationsDir,
                })
              ).trim() || defaultTranslationsDir,
          })
        : undefined;

    const filePatterns = parseFilePatterns(session, options.filePatterns);
    const selectedFormats = options.fileFormats?.filter(
      (format): format is SetupFileFormat => format !== 'none'
    );
    if (
      options.fileFormats?.includes('none') &&
      (selectedFormats?.length ?? 0) > 0
    ) {
      session.reject('--file-formats none cannot be combined with formats');
    }
    const configuredFormats = SETUP_FILE_FORMATS.filter(
      (format) => format in existingFiles
    );
    const fileFormats = await session.answer<SetupFileFormat[]>(
      '--file-formats',
      {
        explicit:
          selectedFormats ??
          (filePatterns.size > 0 ? [...filePatterns.keys()] : undefined),
        configured:
          configuredFormats.length > 0 ? configuredFormats : undefined,
        // GT projects need no other files; others must choose a format.
        recommended: isUsingGT ? [] : undefined,
        ask: () =>
          promptMultiSelect({
            message: !isUsingGT
              ? 'What is the format of your language resource files? Select as many as applicable.\nAdditionally, you can translate any other files you have in your project.'
              : `Do you have any additional files in this project to translate? For example, Markdown files for docs. ${chalk.dim(
                  '(To continue without selecting press Enter)'
                )}`,
            options: SETUP_FILE_FORMATS.map((format) => ({
              value: format,
              label: FILE_EXT_TO_EXT_LABEL[format],
            })),
            required: !isUsingGT,
          }),
      }
    );
    if (fileFormats && fileFormats.length === 0 && !isUsingGT) {
      session.reject(
        'No GT runtime is installed, so select at least one file format to translate'
      );
    }
    for (const format of filePatterns.keys()) {
      if (fileFormats && !fileFormats.includes(format)) {
        session.reject(
          `--file-patterns ${format}= needs ${format} in --file-formats`
        );
      }
    }

    const files: FilesOptions = {};
    for (const fileExtension of fileFormats ?? []) {
      const existingFormat = asRecord(existingFiles[fileExtension]);
      const configuredInclude = Array.isArray(existingFormat?.include)
        ? (existingFormat.include as string[])
        : undefined;
      const include = await session.answer(
        `--file-patterns ${fileExtension}=<glob>`,
        {
          explicit: filePatterns.get(fileExtension),
          configured: configuredInclude,
          recommended: [`./**/[locale]/*.${fileExtension}`],
          ask: async () =>
            parseGlobPatterns(
              await promptGlobPatterns({
                label: FILE_EXT_TO_EXT_LABEL[fileExtension],
                message: `${chalk.cyan(FILE_EXT_TO_EXT_LABEL[fileExtension])}: Enter a space-separated list of glob patterns matching the location of the ${FILE_EXT_TO_EXT_LABEL[fileExtension]} files you would like to translate.\nMake sure to include [locale] in the patterns.\nSee https://generaltranslation.com/docs/cli/reference/config#include for more information.`,
                defaultValue: `./**/[locale]/*.${fileExtension}`,
                validate: (value) =>
                  parseGlobPatterns(value)
                    .map(validateSetupPattern)
                    .find((problem) => problem !== true) ?? true,
              })
            ),
        }
      );
      // Configured patterns stay untouched; new ones keep other entry options.
      if (include && include !== configuredInclude) {
        files[fileExtension] = { ...existingFormat, include };
      }
    }
    if (translationsDir && translationsDir !== configuredTranslationsDir) {
      files.gt = { output: path.join(translationsDir, `[locale].json`) };
    }

    // The effective project: an explicit ID replaces a configured one.
    const projectId =
      options.projectId ||
      (typeof existingConfig.projectId === 'string'
        ? existingConfig.projectId
        : undefined);
    const configUpdate: SetupConfigUpdate = {
      defaultLocale,
      locales,
      src: options.src,
      files: Object.keys(files).length > 0 ? files : undefined,
      framework:
        (setup.saveFramework && setup.framework) ||
        (isVite ? 'vite' : undefined),
      publish: storage === 'cdn',
      // Selecting local storage drops stale CDN intent; a config that
      // already combines local files with publishing keeps it.
      clearPublish:
        storage === 'local' &&
        (options.storage === 'local' ||
          configuredStorage !== 'local' ||
          !supportsCDN),
      // An explicit switch to the CDN stops later runs inferring local files.
      clearGtOutput: storage === 'cdn' && configuredOutput !== undefined,
      // An explicit format list replaces the configured selection.
      removeFiles: selectedFormats
        ? configuredFormats.filter(
            (format) => !selectedFormats.includes(format)
          )
        : undefined,
    };
    session.assertResolved();

    // Validate what will be written, and use it for every later step.
    const { projectId: _writtenProjectId, ...effectiveConfig } =
      mergeSetupConfig(existingConfig, configUpdate);
    const settings = await generateSettings(
      { config: configFilepath, ...(projectId && { projectId }) },
      cwd,
      { resolvedConfig: effectiveConfig }
    );
    const envFramework = setup.framework ?? settings.framework;
    // Runtime credentials only count for the project this setup uses; the
    // framework's project variable is the one paired with its dev key.
    const runtimeProjectId =
      process.env[getDevelopmentEnvNames(envFramework).projectId] ??
      resolveProjectId();
    const runtimeProjectMatches =
      runtimeProjectId === undefined || runtimeProjectId === settings.projectId;
    const credentialsSet =
      runtimeProjectMatches && areCredentialsSet(settings, envFramework);
    const localVite = isVite && storage === 'local';
    const provision =
      !credentialsSet &&
      (localVite
        ? await session.answer('--live-translations', {
            explicit: options.liveTranslations ?? options.devCredentials,
            recommended: false,
            ask: () =>
              promptConfirm({
                message:
                  'Would you like to set up live development translations? This requires signing in or an API key.',
                defaultValue: false,
              }),
          })
        : await session.answer('--dev-credentials', {
            explicit: options.devCredentials,
            // Creating a key is never a default.
            ask: () =>
              promptConfirm({
                message:
                  'Would you like to set up a project ID and hot-reload key in .env.local?',
                defaultValue: true,
              }),
          })) === true;
    if (!runtimeProjectMatches && !provision) {
      session.reject(
        `The runtime credentials in the environment belong to project ${runtimeProjectId}, not ${settings.projectId}; pass --dev-credentials to replace them in .env.local`
      );
    }
    // An explicit ID is saved to gt.config.json when it replaces a
    // configured one or no new credentials will record it in .env.local.
    if (options.projectId && (existingConfig.projectId || !provision)) {
      configUpdate.projectId = options.projectId;
    }
    if (provision) {
      checkDevelopmentProjectInputs(session, settings, options);
      await withCredentialsError(() =>
        inspectCredentialsEnvFile(cwd, { framework: envFramework })
      );
    }

    if (reactSetup && isVite) await inspectViteSPA(cwd);
    const installGT =
      packageJson !== null &&
      !isPackageInstalled('gt', packageJson, true, true) &&
      !(isUsingGT && isVite);
    const packageManager =
      reactSetup?.install || installGT
        ? await resolvePackageManager(session, options.packageManager)
        : undefined;

    session.assertResolved();

    // Only creating credentials talks to GT, as the signed-in user unless an
    // API key is set. A development key in .env.local never stands in.
    if (
      provision &&
      !settings.apiKey &&
      !(await hasLogin({ baseUrl: settings.baseUrl }))
    ) {
      await signInForSetup(session, settings.baseUrl);
    }
    const project = provision
      ? await withCredentialsError(() =>
          resolveDevelopmentProject(session, settings, options, cwd)
        )
      : undefined;
    session.assertResolved();

    // ----- Changes start here ----- //
    const resolvedLocales = locales as string[];

    if (reactSetup) {
      logger.info(`${chalk.yellow('[EXPERIMENTAL]')} Configuring project...`);
      if (reactSetup.install && packageManager) {
        await installWithProgress(
          session,
          reactSetup.install,
          packageManager,
          false
        );
      }
      await executeReactSetup(session, reactSetup, options);
      logger.endCommand(
        `Done! Since this wizard is experimental, please review the changes and make modifications as needed.
\nNext step: start internationalizing! See the docs for more information: https://generaltranslation.com/docs/react/tutorials/quickstart`
      );
      logger.startCommand('Setting up project config...');
    }

    // A loader left unchanged may not read the newly chosen directory.
    const reportLoaderUpdate = (loaderFile: string, custom = true) => {
      if (translationsDir === configuredTranslationsDir) return;
      const action = `Update ${custom ? 'your custom ' : ''}${loaderFile} to load translations from ${translationsDir}`;
      session.humanActions.push(action);
      logger.warn(
        createDiagnosticMessage({
          source: 'gt',
          severity: 'Warning',
          whatHappened: custom
            ? `Your custom ${loaderFile} was left unchanged, but translations now go to ${translationsDir}`
            : `${loaderFile} was left unchanged because the React setup was skipped, but translations now go to ${translationsDir}`,
          fix: action,
        })
      );
    };
    const translationFilesError = (error: unknown) =>
      new Error(
        createDiagnosticMessage({
          source: 'gt',
          severity: 'Error',
          whatHappened: `Could not create the translation files in ${translationsDir}`,
          details: formatDiagnosticErrorDetails(error),
          fix: 'Choose another --translations-dir or fix the path, then rerun the command',
        })
      );

    if (storage === 'local' && translationsDir) {
      // Without the React setup, configure keeps an existing Vite loader in
      // sync; init leaves application source to the person.
      if (
        isVite &&
        !reactSetup &&
        translationsDir !== configuredTranslationsDir
      ) {
        if (setup.keepAppSource) {
          if (fs.existsSync(path.join(cwd, VITE_LOADER_FILE))) {
            reportLoaderUpdate(VITE_LOADER_FILE, false);
          }
        } else {
          const loader = await writeViteLoader({
            appDirectory: cwd,
            defaultLocale: settings.defaultLocale,
            locales: resolvedLocales,
            translationsDir,
            previousTranslationsDir: configuredTranslationsDir,
            create: false,
          }).catch((error: unknown) => {
            throw translationFilesError(error);
          });
          if (loader === 'written') {
            session.step(`updated ${VITE_LOADER_FILE}`);
          }
          if (loader === 'custom') reportLoaderUpdate(VITE_LOADER_FILE);
        }
      }
      const generatedLoader = this.shouldGenerateLocalTranslationLoader(
        isVite,
        runtimeSetup
      );
      const loader = generatedLoader
        ? await createLoadTranslationsFile(
            cwd,
            translationsDir,
            resolvedLocales,
            configuredTranslationsDir
          ).catch((error: unknown) => {
            throw translationFilesError(error);
          })
        : undefined;
      if (loader === 'created' || loader === 'updated') {
        session.step(`${loader} loadTranslations.js`);
      }
      if (loader === 'custom') reportLoaderUpdate('loadTranslations.js');
      const guidance = this.getLocalTranslationGuidance({
        generatedLoader: generatedLoader && loader !== 'custom',
        runtimeSetup,
        translationsDir,
      });
      if (guidance) logger.message(guidance);
    }

    await createOrUpdateConfig(configFilepath, configUpdate);
    session.step(`updated ${configFilepath}`);

    logger.success(
      `Edit ${chalk.cyan(
        configFilepath
      )} to customize your translation setup. Docs: https://generaltranslation.com/docs/cli/reference/config`
    );

    if (reactSetup && isVite) {
      const result = await setupViteSPA({
        appDirectory: cwd,
        configFilepath,
        defaultLocale: settings.defaultLocale,
        locales: resolvedLocales,
        translationsDir: storage === 'local' ? translationsDir : undefined,
        previousTranslationsDir: configuredTranslationsDir,
      });
      if (result.manualAction) {
        session.humanActions.push(result.manualAction);
        logger.warn(
          createDiagnosticMessage({
            source: 'gt',
            severity: 'Warning',
            whatHappened: 'The existing Vite setup needs a manual review',
            fix: result.manualAction,
          })
        );
      } else {
        session.step('configured initializeGTSPA');
        if (result.loader === 'custom') reportLoaderUpdate(VITE_LOADER_FILE);
      }
    }

    if (installGT && packageManager) {
      await installWithProgress(session, 'gt', packageManager, true);
    }

    if (project) {
      await withCredentialsError(() =>
        provisionDevelopmentCredentials(
          session,
          project,
          settings,
          envFramework,
          cwd
        )
      );
      logger.message(productionRuntimeKeyGuidance(settings.dashboardUrl));
    }
  }
}
