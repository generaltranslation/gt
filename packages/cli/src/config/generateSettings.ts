import {
  displayProjectId,
  logErrorAndExit,
  warnApiKeyInConfig,
} from '../console/logging.js';
import { loadConfig } from '../fs/config/loadConfig.js';
import { Settings, SupportedFrameworks } from '../types/index.js';
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

export const DEFAULT_SRC_PATTERNS = [
  'src/**/*.{js,jsx,ts,tsx}',
  'app/**/*.{js,jsx,ts,tsx}',
  'pages/**/*.{js,jsx,ts,tsx}',
  'components/**/*.{js,jsx,ts,tsx}',
];

/**
 * Generates settings from any
 * @param options - The options to generate settings from
 * @param cwd - The current working directory
 * @returns The generated settings
 */
export async function generateSettings(
  options: any,
  cwd: string = process.cwd()
): Promise<Settings> {
  // Load config file
  let gtConfig: Record<string, any> = {};

  if (options.config && !options.config.endsWith('.json')) {
    options.config = `${options.config}.json`;
  }
  if (options.config) {
    gtConfig = loadConfig(options.config);
  } else {
    const config = resolveConfig(cwd);
    if (config) {
      gtConfig = config.config;
      options.config = config.path;
    } else {
      gtConfig = {};
    }
  }

  // Warn if apiKey is present in gt.config.json
  if (gtConfig.apiKey) {
    warnApiKeyInConfig(options.config);
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

  // merge options
  const mergedOptions = { ...gtConfig, ...options };

  // merge locales
  mergedOptions.locales = Array.from(
    new Set([...(gtConfig.locales || []), ...(options.locales || [])])
  );

  // Add apiKey if not provided
  mergedOptions.apiKey = mergedOptions.apiKey || process.env.GT_API_KEY;

  // Add projectId if not provided
  mergedOptions.projectId = mergedOptions.projectId || resolveProjectId();

  // Add baseUrl if not provided
  mergedOptions.baseUrl = mergedOptions.baseUrl || defaultBaseUrl;

  // Add dashboardUrl if not provided
  mergedOptions.dashboardUrl = mergedOptions.dashboardUrl || GT_DASHBOARD_URL;

  // Add defaultLocale if not provided
  mergedOptions.defaultLocale =
    mergedOptions.defaultLocale || libraryDefaultLocale;

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

  // Populate src if not provided
  mergedOptions.src = mergedOptions.src || DEFAULT_SRC_PATTERNS;

  // Resolve all glob patterns in the files object
  mergedOptions.files = mergedOptions.files
    ? resolveFiles(mergedOptions.files, mergedOptions.defaultLocale, cwd)
    : undefined;

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
  validateSettings(mergedOptions);

  // Set up GT instance
  gt.setConfig({
    projectId: mergedOptions.projectId,
    apiKey: mergedOptions.apiKey,
    baseUrl: mergedOptions.baseUrl,
    sourceLocale: mergedOptions.defaultLocale,
  });

  return mergedOptions;
}
