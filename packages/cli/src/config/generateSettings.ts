import { displayProjectId, logErrorAndExit } from '../console/logging.js';
import {
  type GTConfigFile,
  loadConfig,
  parseConfig,
  withJsonExtension,
} from '../fs/config/loadConfig.js';
import { FilesOptions, Settings } from '../types/index.js';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { resolveFiles } from '../fs/config/parseFilesConfig.js';
import { validateSettings } from './validateSettings.js';
import {
  DEFAULT_GIT_REMOTE_NAME,
  GT_DASHBOARD_URL,
} from '../utils/constants.js';
import { resolveProjectId } from '../fs/utils.js';
import { createUserTokenProvider } from '../auth/oauth.js';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import chalk from 'chalk';
import { resolveConfig } from './resolveConfig.js';
import { GTConfigFileSchema } from './schema.js';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { configureCustomMapping } from '../utils/api.js';
import { resolveApiBaseUrl } from '../utils/apiBaseUrl.js';
import { generatePreset } from './optionPresets.js';
import { GT_PARSING_FLAGS_DEFAULT } from './defaults.js';
import { normalizeFilesOptions } from '../formats/files/transformFormat.js';
import { logger } from '../console/logger.js';

export const DEFAULT_SRC_PATTERNS = [
  'src/**/*.{js,jsx,ts,tsx}',
  'app/**/*.{js,jsx,ts,tsx}',
  'pages/**/*.{js,jsx,ts,tsx}',
  'components/**/*.{js,jsx,ts,tsx}',
];

export const DEFAULT_PYTHON_SRC_PATTERNS = ['**/*.py'];
export const DEFAULT_PYTHON_SRC_EXCLUDES = [
  'venv/**',
  '.venv/**',
  '__pycache__/**',
  '**/migrations/**',
  '**/tests/**',
  '**/test_*.py',
  '**/*_test.py',
];

type GenerateSettingsInput = Partial<Omit<Settings, 'tag'>> & {
  config?: string;
  projectId?: string;
  locales?: string[];
  options?: Settings['options'];
  files?: unknown;
  publish?: boolean;
  omitConfigIds?: boolean;
  saveLocal?: boolean;
  tag?: string | boolean;
  message?: string;
  branch?: string;
  enableBranching?: boolean;
  disableBranchDetection?: boolean;
  remoteName?: string;
  experimentalLocalizeStaticImports?: boolean;
  experimentalLocalizeStaticUrls?: boolean;
  experimentalLocalizeRelativeAssets?: boolean;
  experimentalHideDefaultLocale?: boolean;
  experimentalFlattenJsonFiles?: boolean;
  experimentalClearLocaleDirs?: boolean;
  clearLocaleDirsExclude?: string[];
  [key: string]: unknown;
};

/**
 * Generates settings from any
 * @param flags - The CLI flags to generate settings from
 * @param cwd - The current working directory
 * @param options - Additional options
 * @param options.requireConfig - If true, exit with an error when no config file is found
 * @param options.resolvedConfig - Config content to validate instead of the file, e.g. what setup is about to write
 * @returns The generated settings
 */
export async function generateSettings(
  flags: GenerateSettingsInput,
  cwd: string = process.cwd(),
  options?: {
    requireConfig?: boolean;
    resolvedConfig?: Record<string, unknown>;
  }
): Promise<Settings> {
  // Load config file
  let gtConfig: GTConfigFile = {};

  if (flags.config) {
    flags.config = withJsonExtension(flags.config);
  }
  if (options?.resolvedConfig) {
    gtConfig = parseConfig(
      options.resolvedConfig,
      flags.config ?? 'gt.config.json'
    );
  } else if (flags.config) {
    gtConfig = loadConfig(flags.config);
  } else {
    const config = resolveConfig(cwd);
    if (config) {
      gtConfig = config.config;
      flags.config = config.path;
    } else {
      if (options?.requireConfig) {
        return logErrorAndExit(
          'No gt.config.json file was found. Run `npx gt init` to create one, pass --config, or run this command from your project root.'
        );
      }
      gtConfig = {};
    }
  }

  const unknownKeys = Object.keys(gtConfig).filter(
    (key) => !(key in GTConfigFileSchema.entries)
  );
  if (unknownKeys.length > 0) {
    logger.warn(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Warning',
        whatHappened: `${flags.config ?? 'gt.config.json'} has keys the CLI does not read`,
        reassurance: 'The CLI ignores them',
        details: unknownKeys,
        fix: 'Fix their spelling, or remove them if no other tool reads them',
      })
    );
  }

  const projectIdEnv = resolveProjectId();
  // Resolve mismatched projectIds
  if (
    gtConfig.projectId &&
    flags.projectId &&
    gtConfig.projectId !== flags.projectId
  ) {
    logErrorAndExit(
      `Project ID mismatch: gt.config.json uses ${chalk.green(gtConfig.projectId)}, but the CLI flag uses ${chalk.green(flags.projectId)}. Use the same projectId in all configs.`
    );
  } else if (
    gtConfig.projectId &&
    projectIdEnv &&
    gtConfig.projectId !== projectIdEnv
  ) {
    logErrorAndExit(
      `Project ID mismatch: gt.config.json uses ${chalk.green(gtConfig.projectId)}, but GT_PROJECT_ID uses ${chalk.green(projectIdEnv)}. Use the same projectId in all configs.`
    );
  }

  const docsUrlPatterns = flags.options?.docsUrlPattern;
  if (
    docsUrlPatterns &&
    (Array.isArray(docsUrlPatterns) ? docsUrlPatterns : [docsUrlPatterns]).some(
      (pattern) => !pattern.includes('[locale]')
    )
  ) {
    logErrorAndExit(
      'Static URLs could not be localized because the URL pattern is missing "[locale]". Add "[locale]" where the locale should appear in the generated URL.'
    );
  }

  if (
    flags.options?.docsImportPattern &&
    !flags.options?.docsImportPattern.includes('[locale]')
  ) {
    logErrorAndExit(
      'Static imports could not be localized because the import pattern is missing "[locale]". Add "[locale]" where the locale should appear in the generated import path.'
    );
  }

  if (flags.options?.copyFiles) {
    for (const file of flags.options.copyFiles) {
      if (!file.includes('[locale]')) {
        logErrorAndExit(
          'Files could not be copied because the file path is missing "[locale]". Add "[locale]" where the locale should appear in the copied path.'
        );
      }
    }
  }

  // merge options
  const mergedOptions: Settings = { ...gtConfig, ...flags } as Settings;

  if (
    !Object.keys(mergedOptions.files ?? {}).some((key) => key !== 'gt') &&
    !['package.json', 'pyproject.toml', 'requirements.txt', 'setup.py'].some(
      (file) => fs.existsSync(path.join(cwd, file))
    )
  ) {
    logger.warn(
      chalk.yellow(
        'No package.json or Python project file found in the current directory. Run this command from the root of your project.'
      )
    );
  }

  // Add defaultLocale if not provided
  mergedOptions.defaultLocale =
    mergedOptions.defaultLocale || libraryDefaultLocale;

  // merge locales
  mergedOptions.locales = Array.from(
    new Set([...(gtConfig.locales || []), ...(flags.locales || [])])
  );
  // Separate defaultLocale from locales
  mergedOptions.locales = mergedOptions.locales.filter(
    (locale) => locale !== mergedOptions.defaultLocale
  );

  // Add projectId if not provided
  mergedOptions.projectId = mergedOptions.projectId || resolveProjectId();

  mergedOptions.baseUrl = resolveApiBaseUrl(mergedOptions.baseUrl);

  // API clients use apiKey when set, otherwise this lazy provider.
  mergedOptions.apiKey = mergedOptions.apiKey || process.env.GT_API_KEY;
  mergedOptions.userTokenProvider = createUserTokenProvider({
    baseUrl: mergedOptions.baseUrl,
  });

  // Add dashboardUrl if not provided
  mergedOptions.dashboardUrl = mergedOptions.dashboardUrl || GT_DASHBOARD_URL;

  // Add locales if not provided
  mergedOptions.locales = mergedOptions.locales || [];

  // Only set config path if one was actually found or explicitly provided.
  // Do not default to a phantom path — that would cause downstream writes
  // (e.g. updateConfig) to silently create a config file.
  if (!mergedOptions.config) {
    mergedOptions.config = '';
  }

  // Display projectId if present
  if (mergedOptions.projectId) {
    displayProjectId(mergedOptions.projectId);
  }

  // Add stageTranslations if not provided
  // For human review, always stage the project
  mergedOptions.stageTranslations = mergedOptions.stageTranslations ?? false;

  // Top-level default for whether translated files require approval before use.
  mergedOptions.requiresReview = mergedOptions.requiresReview ?? false;

  // Add publish — only set if explicitly configured or passed via flag.
  // When neither is set, leave undefined so the publish step knows
  // there is no global publish intent.
  if (flags.publish) {
    mergedOptions.publish = true;
  } else if (gtConfig.publish !== undefined) {
    mergedOptions.publish = gtConfig.publish;
  } else {
    mergedOptions.publish = undefined;
  }

  mergedOptions.omitConfigIds =
    flags.omitConfigIds === true || gtConfig.omitConfigIds === true;

  // Don't default src here — each pipeline (JS/Python) has its own defaults.
  // Only set src if the user explicitly provided it via flags or config.

  // Resolve all glob patterns in the files object
  const compositePatterns = Object.entries(
    mergedOptions.options?.jsonSchema || {}
  )
    .filter(([, schema]) => schema.composite)
    .map(([key]) => key);
  mergedOptions.files = mergedOptions.files
    ? resolveFiles(
        normalizeFilesOptions(mergedOptions.files as FilesOptions),
        mergedOptions.defaultLocale,
        mergedOptions.locales,
        cwd,
        compositePatterns,
        mergedOptions.requiresReview
      )
    : {
        resolvedPaths: {},
        placeholderPaths: {},
        transformPaths: {},
        transformFormats: {},
        publishPaths: new Set<string>(),
        unpublishPaths: new Set<string>(),
        requiresReviewPaths: new Set<string>(),
        parsingFlags: {},
        gtJson: {
          parsingFlags: GT_PARSING_FLAGS_DEFAULT,
        },
      };

  mergedOptions.options = {
    ...mergedOptions.options,
    mintlify: {
      ...mergedOptions.options?.mintlify,
      inferTitleFromFilename:
        gtConfig.options?.mintlify?.inferTitleFromFilename ||
        mergedOptions.options?.mintlify?.inferTitleFromFilename,
    },
    experimentalLocalizeStaticImports:
      gtConfig.options?.experimentalLocalizeStaticImports ||
      flags.experimentalLocalizeStaticImports,
    experimentalLocalizeStaticUrls:
      gtConfig.options?.experimentalLocalizeStaticUrls ||
      flags.experimentalLocalizeStaticUrls,
    experimentalLocalizeRelativeAssets:
      gtConfig.options?.experimentalLocalizeRelativeAssets ||
      flags.experimentalLocalizeRelativeAssets,
    experimentalHideDefaultLocale:
      gtConfig.options?.experimentalHideDefaultLocale ||
      flags.experimentalHideDefaultLocale,
    experimentalFlattenJsonFiles:
      gtConfig.options?.experimentalFlattenJsonFiles ||
      flags.experimentalFlattenJsonFiles,
    experimentalClearLocaleDirs:
      gtConfig.options?.experimentalClearLocaleDirs ||
      flags.experimentalClearLocaleDirs,
    clearLocaleDirsExclude:
      gtConfig.options?.clearLocaleDirsExclude || flags.clearLocaleDirsExclude,
    saveLocal: flags.saveLocal ?? gtConfig.options?.saveLocal ?? false,
  };

  if (
    mergedOptions.omitConfigIds &&
    (mergedOptions.publish === true ||
      mergedOptions.files.gtJson.publish === true)
  ) {
    logger.warn(
      chalk.yellow(
        'Config IDs will be omitted even though CDN publishing is enabled. Remote cache/CDN consumers may load the latest available translations instead of a pinned version.'
      )
    );
  }

  // Add additional options if provided
  if (mergedOptions.options) {
    if (mergedOptions.options.jsonSchema) {
      for (const fileGlob of Object.keys(mergedOptions.options.jsonSchema)) {
        const jsonSchema = mergedOptions.options.jsonSchema[fileGlob];
        if (jsonSchema.preset) {
          mergedOptions.options.jsonSchema[fileGlob] = {
            ...generatePreset(jsonSchema.preset, 'json'),
            ...jsonSchema,
          };
        }
      }
    }
    if (mergedOptions.options.yamlSchema) {
      for (const fileGlob of Object.keys(mergedOptions.options.yamlSchema)) {
        const yamlSchema = mergedOptions.options.yamlSchema[fileGlob];
        if (yamlSchema.preset) {
          mergedOptions.options.yamlSchema[fileGlob] = {
            ...generatePreset(yamlSchema.preset, 'yaml'),
            ...yamlSchema,
          };
        }
      }
    }
  }

  // Add parsing options if not provided
  mergedOptions.parsingOptions = mergedOptions.parsingOptions || {};
  mergedOptions.parsingOptions.conditionNames = mergedOptions.parsingOptions
    .conditionNames || [
    'development',
    'browser',
    'module',
    'import',
    'require',
    'default',
  ];

  // Add branch options if not provided
  const branchOptions = mergedOptions.branchOptions || {};
  // If --branch is set, enable branching
  branchOptions.enabled =
    flags.enableBranching ??
    gtConfig.branchOptions?.enabled ??
    (flags.branch ? true : false);
  branchOptions.currentBranch =
    flags.branch ?? gtConfig.branchOptions?.currentBranch ?? undefined;
  branchOptions.autoDetectBranches = flags.disableBranchDetection
    ? false
    : (gtConfig.branchOptions?.autoDetectBranches ?? true);
  branchOptions.remoteName =
    flags.remoteName ??
    gtConfig.branchOptions?.remoteName ??
    DEFAULT_GIT_REMOTE_NAME;
  mergedOptions.branchOptions = branchOptions;

  // Map -m/--message flag to tagMessage
  if (flags.message) {
    mergedOptions.tagMessage = flags.message;
  }

  // Resolve tag:
  // --tag (bare) or -m without --tag: try git SHA, fall back to random hex
  // --tag <value>: use as-is
  // No flags: no tag
  if (flags.tag === true || (!flags.tag && mergedOptions.tagMessage)) {
    try {
      mergedOptions.tag = execSync('git rev-parse --short HEAD', {
        encoding: 'utf-8',
      }).trim();
      // If no message provided, use git commit message
      if (!mergedOptions.tagMessage) {
        mergedOptions.tagMessage = execSync('git log -1 --format=%s', {
          encoding: 'utf-8',
        }).trim();
      }
    } catch {
      // Not in a git repo or git unavailable — fall back to random hex
      mergedOptions.tag = crypto.randomBytes(4).toString('hex');
    }
  }

  mergedOptions.configDirectory = path.join(cwd, '.gt');

  validateSettings(mergedOptions);

  configureCustomMapping(mergedOptions.customMapping);

  return mergedOptions;
}
