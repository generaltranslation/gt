import {
  displayProjectId,
  logErrorAndExit,
  warnApiKeyInConfig,
} from '../console/logging.js';
import { loadConfig } from '../fs/config/loadConfig.js';
import { FilesOptions, Settings, SupportedFrameworks } from '../types/index.js';
import {
  defaultBaseUrl,
  libraryDefaultLocale,
} from 'generaltranslation/internal';
import fs from 'node:fs';
import { createOrUpdateConfig } from '../fs/config/setupConfig.js';
import { resolveFiles } from '../fs/config/parseFilesConfig.js';
import { validateSettings } from './validateSettings.js';
import { GT_DASHBOARD_URL } from '../utils/constants.js';
import { resolveProjectId } from '../fs/utils.js';
import path from 'node:path';
import chalk from 'chalk';
import { resolveConfig } from './resolveConfig.js';
import { gt } from '../utils/gt.js';
import { generatePreset } from './optionPresets.js';

export const DEFAULT_SRC_PATTERNS = [
  'src/**/*.{js,jsx,ts,tsx}',
  'app/**/*.{js,jsx,ts,tsx}',
  'pages/**/*.{js,jsx,ts,tsx}',
  'components/**/*.{js,jsx,ts,tsx}',
];

/**
 * Generates settings from any
 * @param flags - The CLI flags to generate settings from
 * @param cwd - The current working directory
 * @returns The generated settings
 */
export async function generateSettings(
  flags: Record<string, any>,
  cwd: string = process.cwd()
): Promise<Settings> {
  // Load config file
  let gtConfig: Record<string, any> = {};

  if (flags.config && !flags.config.endsWith('.json')) {
    flags.config = `${flags.config}.json`;
  }
  if (flags.config) {
    gtConfig = loadConfig(flags.config);
  } else {
    const config = resolveConfig(cwd);
    if (config) {
      gtConfig = config.config;
      flags.config = config.path;
    } else {
      gtConfig = {};
    }
  }

  // Warn if apiKey is present in gt.config.json
  if (gtConfig.apiKey) {
    warnApiKeyInConfig(flags.config);
    process.exit(1);
  }
  const projectIdEnv = resolveProjectId();
  // Resolve mismatched projectIds
  if (
    gtConfig.projectId &&
    flags.projectId &&
    gtConfig.projectId !== flags.projectId
  ) {
    logErrorAndExit(
      `Project ID mismatch between ${chalk.green(gtConfig.projectId)} and ${chalk.green(flags.projectId)}! Please use the same projectId in all configs.`
    );
  } else if (
    gtConfig.projectId &&
    projectIdEnv &&
    gtConfig.projectId !== projectIdEnv
  ) {
    logErrorAndExit(
      `Project ID mismatch between ${chalk.green(gtConfig.projectId)} and ${chalk.green(projectIdEnv)}! Please use the same projectId in all configs.`
    );
  }

  if (
    flags.options?.docsUrlPattern &&
    !flags.options?.docsUrlPattern.includes('[locale]')
  ) {
    logErrorAndExit(
      'Failed to localize static urls: URL pattern must include "[locale]" to denote the location of the locale'
    );
  }

  if (
    flags.options?.docsImportPattern &&
    !flags.options?.docsImportPattern.includes('[locale]')
  ) {
    logErrorAndExit(
      'Failed to localize static imports: Import pattern must include "[locale]" to denote the location of the locale'
    );
  }

  if (flags.options?.copyFiles) {
    for (const file of flags.options.copyFiles) {
      if (!file.includes('[locale]')) {
        logErrorAndExit(
          'Failed to copy files: File path must include "[locale]" to denote the location of the locale'
        );
      }
    }
  }

  // merge options
  const mergedOptions: Settings = { ...gtConfig, ...flags } as Settings;

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

  // Add apiKey if not provided
  mergedOptions.apiKey = mergedOptions.apiKey || process.env.GT_API_KEY;

  // Add projectId if not provided
  mergedOptions.projectId = mergedOptions.projectId || resolveProjectId();

  // Add baseUrl if not provided
  mergedOptions.baseUrl = mergedOptions.baseUrl || defaultBaseUrl;

  // Add dashboardUrl if not provided
  mergedOptions.dashboardUrl = mergedOptions.dashboardUrl || GT_DASHBOARD_URL;

  // Add locales if not provided
  mergedOptions.locales = mergedOptions.locales || [];

  // Add default config file name if not provided
  mergedOptions.config =
    mergedOptions.config || path.join(cwd, 'gt.config.json');

  // Display projectId if present
  if (mergedOptions.projectId) displayProjectId(mergedOptions.projectId);

  // Add stageTranslations if not provided
  // For human review, always stage the project
  mergedOptions.stageTranslations = mergedOptions.stageTranslations ?? false;

  // Add publish if not provided
  mergedOptions.publish = (gtConfig.publish || flags.publish) ?? false;

  // Populate src if not provided
  mergedOptions.src = mergedOptions.src || DEFAULT_SRC_PATTERNS;

  // Resolve all glob patterns in the files object
  const compositePatterns = [
    ...Object.entries(mergedOptions.options?.jsonSchema || {}),
  ]
    .filter(([, schema]) => schema.composite)
    .map(([key]) => key);
  mergedOptions.files = mergedOptions.files
    ? resolveFiles(
        mergedOptions.files as FilesOptions,
        mergedOptions.defaultLocale,
        mergedOptions.locales,
        cwd,
        compositePatterns
      )
    : { resolvedPaths: {}, placeholderPaths: {}, transformPaths: {} };

  mergedOptions.options = {
    ...(mergedOptions.options || {}),
    experimentalLocalizeStaticImports:
      gtConfig.options?.experimentalLocalizeStaticImports ||
      flags.experimentalLocalizeStaticImports,
    experimentalLocalizeStaticUrls:
      gtConfig.options?.experimentalLocalizeStaticUrls ||
      flags.experimentalLocalizeStaticUrls,
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
  };

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
    .conditionNames || ['browser', 'module', 'import', 'require', 'default'];

  // if there's no existing config file, creates one
  // does not include the API key to avoid exposing it
  if (!fs.existsSync(mergedOptions.config)) {
    await createOrUpdateConfig(mergedOptions.config, {
      projectId: mergedOptions.projectId as string,
      defaultLocale: mergedOptions.defaultLocale as string,
      locales:
        mergedOptions.locales?.length > 0 ? mergedOptions.locales : undefined,
      framework: mergedOptions.framework as SupportedFrameworks,
    });
  }

  mergedOptions.configDirectory = path.join(cwd, '.gt');

  validateSettings(mergedOptions);

  // Set up GT instance
  gt.setConfig({
    projectId: mergedOptions.projectId,
    apiKey: mergedOptions.apiKey,
    baseUrl: mergedOptions.baseUrl,
    sourceLocale: mergedOptions.defaultLocale,
    customMapping: mergedOptions.customMapping,
  });

  return mergedOptions;
}
