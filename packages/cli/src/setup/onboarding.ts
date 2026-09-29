import fs from 'node:fs';
import { Command, Option, type CommanderError } from 'commander';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import findFilepath from '../fs/findFilepath.js';
import { withJsonExtension } from '../fs/config/loadConfig.js';
import { logger } from '../console/logger.js';
import {
  displayHeader,
  getLastExitError,
  logErrorAndExit,
  stripAnsi,
} from '../console/logging.js';
import {
  SUPPORTED_REACT_FRAMEWORKS,
  type FrameworkObject,
  type SupportedReactFrameworks,
} from '../types/index.js';
import { DEFAULT_TRANSLATIONS_DIR } from '../utils/constants.js';
import { getBuildToolSetup } from './buildTools/index.js';
import {
  getFrameworkDisplayName,
  getReactFrameworkLibrary,
} from './frameworkUtils.js';
import {
  SETUP_FILE_FORMATS,
  type SetupFileFormat,
} from '../formats/files/supportedFiles.js';
import {
  getPackageManager,
  NoPackageManagerError,
  packageManagers,
  type PackageManager,
} from '../utils/packageManager.js';
import { installPackage } from '../utils/installPackage.js';

/** Answers accepted by `gt configure` (and the gt-vue `gt init`). */
export type ConfigureOptions = {
  config: string;
  src?: string[];
  interactive?: boolean;
  json?: boolean;
  defaults?: boolean;
  defaultLocale?: string;
  locales?: string[];
  storage?: 'local' | 'cdn';
  translationsDir?: string;
  fileFormats?: Array<SetupFileFormat | 'none'>;
  filePatterns?: string[];
  liveTranslations?: boolean;
  devCredentials?: boolean;
  projectId?: string;
  createProject?: boolean;
  orgId?: string;
  projectName?: string;
  packageManager?: string;
};

/** Answers accepted by the React-aware `gt init`. */
export type InitOptions = ConfigureOptions & {
  locadex?: boolean;
  reactSetup?: boolean;
  framework?: SupportedReactFrameworks;
  format?: boolean;
};

/** Flags for every configuration question; values prefill interactive runs. */
export function attachConfigureFlags(
  command: Command,
  sourceHelp: string
): Command {
  return reportJsonArgumentErrors(command)
    .option('--src <paths...>', sourceHelp)
    .option(
      '-c, --config <path>',
      'Filepath to config file, by default gt.config.json',
      findFilepath(['gt.config.json'])
    )
    .option(
      '--no-interactive',
      'Never prompt; fail listing the options still needed. Automatic when stdin or stdout is not a terminal'
    )
    .option(
      '--json',
      'Write JSON events (sign-in, handoff, result) to stdout and all other output to stderr; implies --no-interactive'
    )
    .option(
      '--defaults',
      'Accept the recommended value for every local choice that no flag or gt.config.json answers; never creates projects or keys'
    )
    .option('--no-defaults', 'Do not offer the recommended defaults')
    .option('--default-locale <locale>', 'Default locale, e.g. en')
    .option(
      '--locales <locales...>',
      'Locales to translate into, e.g. fr es; replaces the configured list'
    )
    .addOption(
      new Option(
        '--storage <storage>',
        'Where GT translations are stored for GT runtimes'
      ).choices(['local', 'cdn'])
    )
    .option(
      '--translations-dir <path>',
      'Directory for local GT translation files'
    )
    .addOption(
      new Option(
        '--file-formats <formats...>',
        'Additional file formats to translate, or none'
      ).choices([...SETUP_FILE_FORMATS, 'none'])
    )
    .option(
      '--file-patterns <patterns...>',
      'Glob patterns as <format>=<glob> including [locale], e.g. json=./locales/[locale]/*.json; selects the format'
    )
    .option(
      '--live-translations',
      'Local Vite storage: set up live development translations (creates a development key)'
    )
    .option('--no-live-translations', 'Skip live development translations')
    .option(
      '--dev-credentials',
      'Save a project ID and a new development key to .env.local'
    )
    .option('--no-dev-credentials', 'Do not create development credentials')
    .option(
      '--project-id <id>',
      'Existing project for the development credentials'
    )
    .option(
      '--create-project',
      'Create a new project for the development credentials'
    )
    .option('--org-id <id>', 'Organization that owns --create-project')
    .option('--project-name <name>', 'Name for --create-project')
    .addOption(
      new Option(
        '--package-manager <id>',
        'Package manager for installs when it cannot be detected'
      ).choices(packageManagers.map((packageManager) => packageManager.id))
    );
}

let commandBeforeOnboarding: string | undefined;

function reportExitBeforeOnboarding(code: number): void {
  if (code === 0 || commandBeforeOnboarding === undefined) return;
  fs.writeSync(
    process.stdout.fd,
    `${JSON.stringify({
      type: 'result',
      command: commandBeforeOnboarding,
      outcome: 'failed',
      completedSteps: [],
      error: stripAnsi(
        getLastExitError() ?? 'Setup exited before it started; see stderr'
      ),
    } satisfies OnboardingEvent)}\n`
  );
}

/**
 * Pre-action hooks, such as the monorepo version check, can exit before
 * runOnboarding installs its own result reporting; `--json` callers still
 * get a result. runOnboarding takes over once it starts.
 */
export function reportJsonExitsBeforeOnboarding(command: string): void {
  commandBeforeOnboarding = command;
  process.once('exit', reportExitBeforeOnboarding);
}

/**
 * Argument errors happen before the action runs, so `--json` callers would
 * otherwise get no result. Commander prints the error to stderr, then calls
 * this exit hook; returning lets it exit with the same code as before. The
 * hook replaces an exit override inherited from the program.
 */
function reportJsonArgumentErrors(command: Command): Command {
  return command.exitOverride((error: CommanderError) => {
    if (error.exitCode === 0) return; // help and version output
    // An option after the failing argument is not parsed yet.
    const json =
      command.opts().json === true || process.argv.includes('--json');
    if (!json) return;
    fs.writeSync(
      process.stdout.fd,
      `${JSON.stringify({
        type: 'result',
        command: command.name(),
        outcome: 'failed',
        completedSteps: [],
        error: stripAnsi(error.message),
      } satisfies OnboardingEvent)}\n`
    );
  });
}

/** Configuration flags plus the React application setup and Locadex choices. */
export function attachInitFlags(command: Command, sourceHelp: string) {
  return attachConfigureFlags(command, sourceHelp)
    .option(
      '--locadex',
      'Mintlify and Next.js App Router: hand setup to the Locadex AI agent through GitHub instead'
    )
    .option('--no-locadex', 'Set up this project locally')
    .option(
      '--react-setup',
      'React projects: install the GT library and add GTProvider or initializeGTSPA'
    )
    .option('--no-react-setup', 'Do not modify application source')
    .addOption(
      new Option(
        '--framework <framework>',
        'React framework for --react-setup; overrides detection'
      ).choices(SUPPORTED_REACT_FRAMEWORKS)
    )
    .option(
      '--format',
      'Next.js App Router: format files changed by setup with the detected formatter'
    )
    .option('--no-format', 'Leave files changed by setup unformatted');
}

export type OnboardingEvent =
  | {
      type: 'authorization_required';
      verificationUri: string;
      verificationUriComplete?: string;
      userCode: string;
    }
  | { type: 'handoff'; url: string; reason: 'locadex' }
  | {
      type: 'result';
      command: string;
      outcome: 'success' | 'needs_human_action' | 'failed';
      completedSteps: string[];
      url?: string;
      /** Manual steps setup could not do, for needs_human_action. */
      actions?: string[];
      missingOptions?: string[];
      error?: string;
    };

/** Needs-input and validation failures, raised before setup changes files. */
export class OnboardingError extends Error {
  constructor(
    message: string,
    readonly missingOptions: string[] = []
  ) {
    super(message);
    this.name = 'OnboardingError';
  }
}

function isInteractiveTerminal(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

/**
 * One setup run: how unanswered questions are resolved, which options are
 * still missing, and which steps already changed the project.
 */
export class OnboardingSession {
  readonly interactive: boolean;
  readonly json: boolean;
  defaults = false;
  readonly completedSteps: string[] = [];
  /** Manual steps left for a person; they make the outcome needs_human_action. */
  readonly humanActions: string[] = [];
  private readonly missing = new Set<string>();
  private readonly invalid: string[] = [];
  private reported = false;

  constructor(
    readonly command: string,
    options: Pick<ConfigureOptions, 'json' | 'interactive'>
  ) {
    this.json = options.json === true;
    this.interactive =
      options.interactive !== false && !this.json && isInteractiveTerminal();
  }

  /**
   * Explicit flag, then existing config, then the recommended value when
   * defaults were accepted, then a prompt. Noninteractive runs use the
   * fallback of an optional question, or record the option as missing.
   */
  async answer<T>(
    option: string,
    {
      explicit,
      configured,
      recommended,
      fallback,
      ask,
    }: {
      explicit?: T;
      configured?: T;
      recommended?: T;
      fallback?: T;
      ask: () => Promise<T>;
    }
  ): Promise<T | undefined> {
    if (explicit !== undefined) return explicit;
    if (configured !== undefined) return configured;
    if (this.defaults && recommended !== undefined) return recommended;
    if (this.interactive) return ask();
    if (fallback !== undefined) return fallback;
    this.require(option);
    return undefined;
  }

  require(option: string): void {
    this.missing.add(option);
  }

  reject(problem: string): void {
    this.invalid.push(problem);
  }

  /** Stops before any change when an answer is missing or invalid. */
  assertResolved(): void {
    if (this.missing.size === 0 && this.invalid.length === 0) return;
    const missingOptions = [...this.missing];
    throw new OnboardingError(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened:
          missingOptions.length > 0
            ? `Setup needs these options: ${missingOptions.join(', ')}`
            : 'Setup received invalid options',
        reassurance: 'No project files were changed',
        details: this.invalid,
        fix: 'Pass the options (see --help), add --defaults to accept the recommended local choices, or rerun in an interactive terminal',
      }),
      missingOptions
    );
  }

  step(name: string): void {
    this.completedSteps.push(name);
  }

  emit(event: OnboardingEvent): void {
    if (!this.json) return;
    if (event.type === 'result') this.reported = true;
    // Synchronous so events survive an immediate process.exit.
    fs.writeSync(process.stdout.fd, `${JSON.stringify(event)}\n`);
  }

  /** A result for exits that bypass runOnboarding (e.g. settings validation). */
  reportUnexpectedExit(code: number): void {
    if (this.reported || code === 0) return;
    this.emit({
      type: 'result',
      command: this.command,
      outcome: 'failed',
      completedSteps: this.completedSteps,
      error: stripAnsi(
        getLastExitError() ?? 'Setup exited before it finished; see stderr'
      ),
    });
  }
}

export type OnboardingOutcome =
  | { outcome: 'success' }
  | { outcome: 'needs_human_action'; url: string };

function partialSetupWarning(session: OnboardingSession): string {
  return createDiagnosticMessage({
    source: 'gt',
    severity: 'Warning',
    whatHappened: `Setup stopped after these steps: ${session.completedSteps.join(', ')}`,
    why: 'the error below happened before the remaining steps ran',
    fix: `Review those changes, fix the error, then rerun \`gt ${session.command}\`; it reuses the saved configuration and credentials`,
  });
}

/**
 * Runs one setup command: selects prompt and output modes, then reports the
 * outcome. Failures exit nonzero with the steps that already ran.
 */
export async function runOnboarding(
  command: string,
  options: Pick<ConfigureOptions, 'json' | 'interactive'>,
  run: (session: OnboardingSession) => Promise<OnboardingOutcome>
): Promise<void> {
  commandBeforeOnboarding = undefined;
  process.removeListener('exit', reportExitBeforeOnboarding);
  const session = new OnboardingSession(command, options);
  if (session.json) logger.setConsoleOutput('stderr');
  // Per-run modes; console routing is reset per command by BaseCLI.
  const progressWasAnimated = logger.setAnimatedProgress(session.interactive);
  const reportExit = (code: number) => session.reportUnexpectedExit(code);
  process.once('exit', reportExit);
  try {
    const result = await run(session);
    const needsHuman =
      result.outcome === 'needs_human_action' ||
      session.humanActions.length > 0;
    session.emit({
      type: 'result',
      command,
      outcome: needsHuman ? 'needs_human_action' : 'success',
      completedSteps: session.completedSteps,
      ...(result.outcome === 'needs_human_action' && { url: result.url }),
      ...(session.humanActions.length > 0 && {
        actions: session.humanActions,
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : (formatDiagnosticErrorDetails(error) ?? 'Setup failed');
    session.emit({
      type: 'result',
      command,
      outcome: 'failed',
      completedSteps: session.completedSteps,
      error: stripAnsi(message),
      ...(error instanceof OnboardingError &&
        error.missingOptions.length > 0 && {
          missingOptions: error.missingOptions,
        }),
    });
    if (session.completedSteps.length > 0) {
      logger.warn(partialSetupWarning(session));
    }
    return logErrorAndExit(message);
  } finally {
    process.removeListener('exit', reportExit);
    logger.setAnimatedProgress(progressWasAnimated);
  }
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Reads the setup config, failing before any change when it is unusable. */
export function readSetupConfig(
  configFilepath: string
): Record<string, unknown> {
  if (!fs.existsSync(configFilepath)) return {};
  try {
    const config = asRecord(
      JSON.parse(fs.readFileSync(configFilepath, 'utf8'))
    );
    if (config) return config;
    throw new Error('the file does not contain a JSON object');
  } catch (error) {
    throw new OnboardingError(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: `${configFilepath} is not a valid JSON config`,
        reassurance: 'No project files were changed',
        details: formatDiagnosticErrorDetails(error),
        fix: 'Fix or remove the file, then rerun the command',
      })
    );
  }
}

export const INIT_SOURCE_HELP =
  "Space-separated list of glob patterns containing the app's source code, by default 'src/**/*.{js,jsx,ts,tsx}' 'app/**/*.{js,jsx,ts,tsx}' 'pages/**/*.{js,jsx,ts,tsx}' 'components/**/*.{js,jsx,ts,tsx}'";

export function setupConfigPath(
  options: Pick<ConfigureOptions, 'config'>
): string {
  return options.config ? withJsonExtension(options.config) : 'gt.config.json';
}

export function getConfiguredFramework(
  config: Record<string, unknown>
): SupportedReactFrameworks | 'mintlify' | undefined {
  const framework = config.framework;
  return typeof framework === 'string' &&
    [...SUPPORTED_REACT_FRAMEWORKS, 'mintlify'].includes(
      framework as SupportedReactFrameworks
    )
    ? (framework as SupportedReactFrameworks | 'mintlify')
    : undefined;
}

/** JSON mode keeps the banner off stdout. */
export function displaySetupHeader(
  session: OnboardingSession,
  message: string
) {
  if (session.json) logger.startCommand(message);
  else displayHeader(message);
}

export function describeDefaults(
  framework: FrameworkObject | undefined
): string {
  const buildTool = getBuildToolSetup(framework?.name);
  const translationsDir =
    buildTool?.defaultTranslationsDir ?? DEFAULT_TRANSLATIONS_DIR;
  if (framework?.type !== 'react') {
    return `Files saved locally in ${translationsDir}`;
  }
  const library = getReactFrameworkLibrary(framework);
  const setup = buildTool?.initializer ?? 'GTProvider';
  return `${library} & ${setup}, ${getFrameworkDisplayName(framework)}, Files saved locally in ${translationsDir}`;
}

/** Setup patterns name where each locale's files live, so they need [locale]. */
export function validateSetupPattern(pattern: string): true | string {
  return (
    pattern.includes('[locale]') ||
    `"${pattern}" must include [locale], e.g. ./locales/[locale]/*.json`
  );
}

/** Parses `--file-patterns <format>=<glob>` values, grouped by format. */
export function parseFilePatterns(
  session: OnboardingSession,
  values: string[] = []
): Map<SetupFileFormat, string[]> {
  const patterns = new Map<SetupFileFormat, string[]>();
  for (const value of values) {
    const separator = value.indexOf('=');
    const format = value.slice(0, separator) as SetupFileFormat;
    const pattern = value.slice(separator + 1).trim();
    if (separator < 0 || !SETUP_FILE_FORMATS.includes(format) || !pattern) {
      session.reject(
        `--file-patterns "${value}" must look like <format>=<glob> with a format of ${SETUP_FILE_FORMATS.join(', ')}`
      );
      continue;
    }
    const problem = validateSetupPattern(pattern);
    if (problem !== true) {
      session.reject(`--file-patterns "${value}": ${problem}`);
      continue;
    }
    patterns.set(format, [...(patterns.get(format) ?? []), pattern]);
  }
  return patterns;
}

/** Detects the package manager, or asks only when prompts are allowed. */
export async function resolvePackageManager(
  session: OnboardingSession,
  specified?: string
): Promise<PackageManager | undefined> {
  try {
    return await getPackageManager(
      process.cwd(),
      specified,
      !session.interactive
    );
  } catch (error) {
    if (!(error instanceof NoPackageManagerError)) throw error;
    session.require('--package-manager');
    return undefined;
  }
}

export async function installWithProgress(
  session: OnboardingSession,
  packageName: string,
  packageManager: PackageManager,
  asDevDependency: boolean
): Promise<void> {
  const spinner = logger.createSpinner('timer');
  spinner.start(
    `Installing ${packageName}${asDevDependency ? ' as a dev dependency' : ''} with ${packageManager.name}...`
  );
  try {
    await installPackage(packageName, packageManager, asDevDependency);
  } catch (error) {
    spinner.stop(`Could not install ${packageName}.`, 2);
    throw new Error(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: `Failed to install ${packageName}`,
        details: formatDiagnosticErrorDetails(error),
        fix: `Install it with \`${packageManager.name} ${packageManager.installCommand} ${packageName}\`, then rerun the command`,
      })
    );
  }
  spinner.stop(`Installed ${packageName}.`);
  session.step(`installed ${packageName}`);
}
