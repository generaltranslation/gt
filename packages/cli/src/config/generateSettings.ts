import { isValidLocale } from 'generaltranslation';
import { displayProjectId } from '../console/console';
import { warnApiKeyInConfig } from '../console/warnings';
import loadConfig from '../fs/config/loadConfig';
import { Settings } from '../types';
import {
  defaultBaseUrl,
  libraryDefaultLocale,
} from 'generaltranslation/internal';
import fs from 'fs';
import createOrUpdateConfig from '../fs/config/setupConfig';
import { resolveFiles } from '../fs/config/parseFilesConfig';
/**
 * Generates settings from any
 * @param options - The options to generate settings from
 * @returns The generated settings
 */
export function generateSettings(options: any): Settings {
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
  mergedOptions.projectId =
    mergedOptions.projectId || process.env.GT_PROJECT_ID;

  // Add baseUrl if not provided
  mergedOptions.baseUrl = mergedOptions.baseUrl || defaultBaseUrl;

  // Add defaultLocale if not provided
  mergedOptions.defaultLocale =
    mergedOptions.defaultLocale || libraryDefaultLocale;

  // Add locales if not provided
  mergedOptions.locales = mergedOptions.locales || [];

  // Add default config file name if not provided
  mergedOptions.config = mergedOptions.config || 'gt.config.json';

  // Display projectId if present
  if (mergedOptions.projectId) displayProjectId(mergedOptions.projectId);

  // Check locales
  if (
    mergedOptions.defaultLocale &&
    !isValidLocale(mergedOptions.defaultLocale)
  ) {
    console.error(
      `defaultLocale: ${mergedOptions.defaultLocale} is not a valid locale!`
    );
    process.exit(1);
  }

  for (const locale of mergedOptions.locales) {
    if (!isValidLocale(locale)) {
      console.error(
        `Provided locales: "${mergedOptions?.locales?.join()}", ${locale} is not a valid locale!`
      );
      process.exit(1);
    }
  }

  // Resolve all glob patterns in the files object
  mergedOptions.files = resolveFiles(
    mergedOptions.files || {},
    mergedOptions.defaultLocale
  );

  // if there's no existing config file, creates one
  // does not include the API key to avoid exposing it
  if (!fs.existsSync(mergedOptions.config)) {
    createOrUpdateConfig(mergedOptions.config, {
      projectId: mergedOptions.projectId as string,
      defaultLocale: mergedOptions.defaultLocale as string,
      locales:
        mergedOptions.locales?.length > 0 ? mergedOptions.locales : undefined,
    });
  }
  return mergedOptions;
}
