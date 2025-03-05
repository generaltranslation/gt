import fs from 'fs';
import {
  displayCreatedConfigFile,
  displayUpdatedConfigFile,
} from '../../console/console';
import { libraryDefaultLocale } from 'generaltranslation/internal';

/**
 * Checks if the config file exists.
 * If yes, make sure make sure projectId is correct
 * If not, creates a new JSON file at the given filepath and writes the provided config object to it.
 * @param {string} configFilepath - The path to the config file.
 * @param {Record<string, any>} configObject - The config object to write if the file does not exist.
 */
export default function createOrUpdateConfig(
  configFilepath: string,
  options: {
    projectId?: string;
    defaultLocale?: string;
    locales?: string[];
    translationsDir?: string;
  }
): string {
  // Filter out empty string values from the config object
  const newContent = {
    ...(options.projectId && { projectId: options.projectId }),
    ...(options.defaultLocale && { defaultLocale: options.defaultLocale }),
    ...(options.translationsDir && {
      translationsDir: options.translationsDir,
    }),
  };
  try {
    // if file exists
    let oldContent: any = {};
    if (fs.existsSync(configFilepath)) {
      oldContent = JSON.parse(fs.readFileSync(configFilepath, 'utf-8'));
    }

    // merge old and new content
    const mergedContent = {
      ...oldContent,
      ...newContent,
    };

    // Add locales to mergedContent if they exist
    if (options.locales) {
      mergedContent.locales = mergedContent.locales
        ? [...new Set([...mergedContent.locales, ...options.locales])]
        : options.locales;
    }

    // write to file
    const mergedJsonContent = JSON.stringify(mergedContent, null, 2);
    fs.writeFileSync(configFilepath, mergedJsonContent, 'utf-8');

    // show update in console
    displayCreatedConfigFile(configFilepath);
  } catch (error) {
    console.error(`An error occurred while updating ${configFilepath}:`, error);
  }
  return configFilepath;
}
