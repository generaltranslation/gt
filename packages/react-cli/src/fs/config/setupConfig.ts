import fs from 'fs';
import { displayUpdatedConfigFile } from '../../console/console';
import { libraryDefaultLocale } from 'generaltranslation/internal';

/**
 * Checks if the config file exists.
 * If yes, make sure make sure projectId is correct
 * If not, creates a new JSON file at the given filepath and writes the provided config object to it.
 * @param {string} configFilepath - The path to the config file.
 * @param {Record<string, any>} configObject - The config object to write if the file does not exist.
 */
export default function setupConfig(
  configFilepath: string,
  projectId?: string,
  defaultLocale?: string
): void {
  // Filter out empty string values from the config object
  const newContent = {
    ...(projectId && { projectId }),
    ...(defaultLocale && { defaultLocale }),
  };
  try {
    // if file exists
    let oldContent: any = {};
    if (fs.existsSync(configFilepath)) {
      oldContent = JSON.parse(fs.readFileSync(configFilepath, 'utf-8'));
    }

    // add a default locale if not present
    if (!oldContent.defaultLocale && !newContent.defaultLocale) {
      newContent.defaultLocale = libraryDefaultLocale;
    }

    // merge old and new content
    const mergedContent = {
      ...oldContent,
      ...newContent,
    };

    // write to file
    const mergedJsonContent = JSON.stringify(mergedContent, null, 2);
    fs.writeFileSync(configFilepath, mergedJsonContent, 'utf-8');

    // show update in console
    displayUpdatedConfigFile(configFilepath);
  } catch (error) {
    console.error(`An error occurred while updating ${configFilepath}:`, error);
  }
}
