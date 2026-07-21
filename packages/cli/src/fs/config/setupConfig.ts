import fs from 'node:fs';
import { displayCreatedConfigFile } from '../../console/logging.js';
import { FilesOptions, SupportedFrameworks } from '../../types/index.js';
import { logger } from '../../console/logger.js';
import { GT_CONFIG_SCHEMA_URL } from '../../utils/constants.js';

/**
 * Checks if the config file exists.
 * If yes, make sure make sure projectId is correct
 * If not, creates a new JSON file at the given filepath and writes the provided config object to it.
 * @param {string} configFilepath - The path to the config file.
 * @param {Record<string, any>} configObject - The config object to write if the file does not exist.
 */
export async function createOrUpdateConfig(
  configFilepath: string,
  options: {
    projectId?: string;
    defaultLocale?: string;
    locales?: string[];
    files?: FilesOptions;
    framework?: SupportedFrameworks;
    baseUrl?: string;
    publish?: boolean;
  }
): Promise<string> {
  // Filter out empty string values from the config object
  const newContent = {
    ...(options.projectId && { projectId: options.projectId }),
    ...(options.defaultLocale && { defaultLocale: options.defaultLocale }),
    ...(options.framework && { framework: options.framework }),
    ...(options.baseUrl && { baseUrl: options.baseUrl }),
    ...(options.publish && { publish: options.publish }),
  };
  try {
    // if file exists
    let oldContent: Record<string, unknown> = {};
    if (fs.existsSync(configFilepath)) {
      const parsed = JSON.parse(
        await fs.promises.readFile(configFilepath, 'utf-8')
      );
      oldContent =
        typeof parsed === 'object' && parsed !== null
          ? (parsed as Record<string, unknown>)
          : {};
    }

    // merge old and new content
    const oldFiles =
      typeof oldContent.files === 'object' && oldContent.files !== null
        ? (oldContent.files as Record<string, unknown>)
        : {};
    const mergedFiles = options.files
      ? Object.fromEntries(
          Object.entries(options.files).map(([format, formatOptions]) => [
            format,
            typeof oldFiles[format] === 'object' &&
            oldFiles[format] !== null &&
            typeof formatOptions === 'object' &&
            formatOptions !== null
              ? {
                  ...(oldFiles[format] as Record<string, unknown>),
                  ...formatOptions,
                }
              : formatOptions,
          ])
        )
      : undefined;

    const mergedContent = {
      $schema: GT_CONFIG_SCHEMA_URL,
      ...oldContent,
      ...newContent,
      ...(mergedFiles && { files: { ...oldFiles, ...mergedFiles } }),
    } as Record<string, unknown> & { locales?: string[] };

    // Add locales to mergedContent if they exist
    if (options.locales) {
      mergedContent.locales = mergedContent.locales
        ? [...new Set([...mergedContent.locales, ...options.locales])]
        : options.locales;
    }

    // write to file
    const mergedJsonContent = JSON.stringify(mergedContent, null, 2);
    await fs.promises.writeFile(configFilepath, mergedJsonContent, 'utf-8');

    // show update in console
    displayCreatedConfigFile(configFilepath);
  } catch (error) {
    logger.error(
      `An error occurred while updating ${configFilepath}: ${error}`
    );
  }
  return configFilepath;
}
