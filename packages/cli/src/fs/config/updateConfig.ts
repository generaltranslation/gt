import fs from 'node:fs';
import { displayUpdatedConfigFile } from '../../console/logging.js';
import { logError } from '../../console/logging.js';

/**
 * Update the config file version id, locales, and projectId (if necessary)
 * @param {Record<string, any>} configObject - The config object to write if the file does not exist.
 */
export default async function updateConfig({
  configFilepath,
  projectId,
  _versionId,
  locales,
  stageTranslations,
}: {
  configFilepath: string;
  projectId?: string;
  _versionId?: string;
  locales?: string[];
  stageTranslations?: boolean;
}): Promise<void> {
  // Filter out empty string values from the config object
  const newContent = {
    ...(projectId && { projectId }),
    ...(_versionId && { _versionId }),
    ...(stageTranslations && { stageTranslations }),
    // ...(locales && { locales }), // Don't override locales
  };
  try {
    // if file exists
    let oldContent: any = {};
    if (fs.existsSync(configFilepath)) {
      oldContent = JSON.parse(
        await fs.promises.readFile(configFilepath, 'utf-8')
      );
    }

    // merge old and new content
    const mergedContent = {
      ...oldContent,
      ...newContent,
    };

    // write to file
    const mergedJsonContent = JSON.stringify(mergedContent, null, 2);
    await fs.promises.writeFile(configFilepath, mergedJsonContent, 'utf-8');

    // show update in console
    displayUpdatedConfigFile(configFilepath);
  } catch (error) {
    logError(`An error occurred while updating ${configFilepath}: ${error}`);
  }
}
