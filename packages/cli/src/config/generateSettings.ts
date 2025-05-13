import { isValidLocale } from 'generaltranslation';
import { displayProjectId } from '../console/console';
import { warnApiKeyInConfig } from '../console/warnings';
import loadConfig from '../fs/config/loadConfig';
import { Settings, SupportedFrameworks } from '../types';
import {
  defaultBaseUrl,
  libraryDefaultLocale,
} from 'generaltranslation/internal';
import fs from 'node:fs';
import createOrUpdateConfig from '../fs/config/setupConfig';
import { resolveFiles } from '../fs/config/parseFilesConfig';
import { findFilepaths } from '../fs/findFilepath';
import { validateSettings } from './validateSettings';
import { GT_DASHBOARD_URL } from '../utils/constants';
import { resolveProjectId } from '../fs/utils';
/**
 * Generates settings from any
 * @param options - The options to generate settings from
 * @returns The generated settings
 */
export async function generateSettings(options: any): Promise<Settings> {
  // Load config file
  let gtConfig: Record<string, any> = {};

  if (options.config && !options.config.endsWith('.json')) {
    options.config = `${options.config}.json`;
  }
  if (options.config) {
    gtConfig = loadConfig(options.config);
  } else if (fs.existsSync('gt.config.json')) {
    options.config = 'gt.config.json';
    gtConfig = loadConfig('gt.config.json');
  } else if (fs.existsSync('src/gt.config.json')) {
    options.config = 'src/gt.config.json';
    gtConfig = loadConfig('src/gt.config.json');
  } else {
    // If neither config exists, use empty config
    gtConfig = {};
  }

  // Warn if apiKey is present in gt.config.json
  if (gtConfig.apiKey) {
    warnApiKeyInConfig(options.config);
    process.exit(1);
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
  mergedOptions.config = mergedOptions.config || 'gt.config.json';

  // Display projectId if present
  if (mergedOptions.projectId) displayProjectId(mergedOptions.projectId);

  // Add stageTranslations if not provided
  // For human review, always stage the project
  mergedOptions.stageTranslations = mergedOptions.stageTranslations ?? false;

  // Populate src if not provided
  mergedOptions.src =
    mergedOptions.src ||
    findFilepaths(['./src', './app', './pages', './components']);

  // Resolve all glob patterns in the files object
  mergedOptions.files = mergedOptions.files
    ? resolveFiles(mergedOptions.files, mergedOptions.defaultLocale)
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
  return mergedOptions;
}
