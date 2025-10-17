import {
  displayProjectId,
  logErrorAndExit,
  warnApiKeyInConfig,
} from '../console/logging.js';
import { loadConfig } from '../fs/config/loadConfig.js';
import {
  AdditionalOptions,
  FilesOptions,
  Settings,
  SupportedFrameworks,
  TranslateFlags,
} from '../types/index.js';
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
 * Input options accepted by generateSettings
 */
export type GenerateSettingsInput = Partial<TranslateFlags> & {
  options?: AdditionalOptions;
  experimentalClearLocaleDirs?: boolean;
  clearLocaleDirsExclude?: string[];
};

/**
 * Generates Settings from CLI options and config
 * @param options - The options to generate settings from
 * @param cwd - The current working directory
 * @returns The generated settings
 */
export async function generateSettings(
  options: GenerateSettingsInput,
  cwd: string = process.cwd()
): Promise<Settings> {
  // Load config file
  type GTConfigFile = {
    projectId?: string;
    defaultLocale?: string;
    locales?: string[];
    files?: FilesOptions;
    framework?: SupportedFrameworks;
    baseUrl?: string;
    publish?: boolean;
    options?: AdditionalOptions;
    apiKey?: string;
  };
  let gtConfig: GTConfigFile = {};

  if (options.config && !options.config.endsWith('.json')) {
    options.config = `${options.config}.json`;
  }
  if (options.config) {
    gtConfig = (loadConfig(options.config) as GTConfigFile) || {};
  } else {
    const config = resolveConfig(cwd);
    if (config) {
      gtConfig = (config.config as GTConfigFile) || {};
      options.config = config.path;
    } else {
      gtConfig = {};
    }
  }

  // Warn if apiKey is present in gt.config.json
  if (gtConfig.apiKey) {
    warnApiKeyInConfig(options.config as string);
    process.exit(1);
  }
  const projectIdEnv = resolveProjectId();
  // Resolve mismatched projectIds
  if (
    gtConfig.projectId &&
    options.projectId &&
    gtConfig.projectId !== options.projectId
  ) {
    logErrorAndExit(
      `Project ID mismatch between ${chalk.green(gtConfig.projectId)} and ${chalk.green(options.projectId)}! Please use the same projectId in all configs.`
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
    options.options?.docsUrlPattern &&
    !options.options?.docsUrlPattern.includes('[locale]')
  ) {
    logErrorAndExit(
      'Failed to localize static urls: URL pattern must include "[locale]" to denote the location of the locale'
    );
  }

  if (
    options.options?.docsImportPattern &&
    !options.options?.docsImportPattern.includes('[locale]')
  ) {
    logErrorAndExit(
      'Failed to localize static imports: Import pattern must include "[locale]" to denote the location of the locale'
    );
  }

  if (options.options?.copyFiles) {
    for (const file of options.options.copyFiles) {
      if (!file.includes('[locale]')) {
        logErrorAndExit(
          'Failed to copy files: File path must include "[locale]" to denote the location of the locale'
        );
      }
    }
  }

  // merge options
  type PartialSettingsWritable = Partial<
    Omit<Settings, 'files' | 'configDirectory' | 'dashboardUrl'>
  > & {
    files?: FilesOptions | Settings['files'];
    configDirectory?: string;
    dashboardUrl?: string;
  };
  const mergedOptions: PartialSettingsWritable = { ...gtConfig, ...options };

  // Add defaultLocale if not provided
  mergedOptions.defaultLocale =
    mergedOptions.defaultLocale || libraryDefaultLocale;

  // merge locales
  mergedOptions.locales = Array.from(
    new Set([...(gtConfig.locales || []), ...(options.locales || [])])
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
  mergedOptions.publish = (gtConfig.publish || options.publish) ?? false;

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
    : undefined;

  mergedOptions.options = {
    ...(mergedOptions.options || {}),
    experimentalLocalizeStaticImports:
      gtConfig.options?.experimentalLocalizeStaticImports ||
      options.experimentalLocalizeStaticImports,
    experimentalLocalizeStaticUrls:
      gtConfig.options?.experimentalLocalizeStaticUrls ||
      options.experimentalLocalizeStaticUrls,
    experimentalHideDefaultLocale:
      gtConfig.options?.experimentalHideDefaultLocale ||
      options.experimentalHideDefaultLocale,
    experimentalFlattenJsonFiles:
      gtConfig.options?.experimentalFlattenJsonFiles ||
      options.experimentalFlattenJsonFiles,
    experimentalClearLocaleDirs:
      gtConfig.options?.experimentalClearLocaleDirs ||
      options.experimentalClearLocaleDirs,
    clearLocaleDirsExclude:
      gtConfig.options?.clearLocaleDirsExclude ||
      options.clearLocaleDirsExclude,
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

  validateSettings(mergedOptions as Settings);

  // Set up GT instance
  gt.setConfig({
    projectId: mergedOptions.projectId,
    apiKey: mergedOptions.apiKey,
    baseUrl: mergedOptions.baseUrl,
    sourceLocale: mergedOptions.defaultLocale,
    customMapping: mergedOptions.customMapping,
  });

  return mergedOptions as Settings;
}
