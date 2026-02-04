import fs from 'node:fs';
import { displayUpdatedConfigFile } from '../../console/logging.js';
import { logger } from '../../console/logger.js';

/**
 * Options for updating the config file.
 *
 * Since these are all string values, we can use null to mark them for removal
 */
type UpdateConfigOptions = {
  projectId?: string | null;
  _versionId?: string | null;
  _branchId?: string | null;
  stageTranslations?: boolean | null;
};

/**
 * Update the config file version id, locales, and projectId (if necessary)
 * @param {string} configFilepath - The path to the config file.
 * @param {UpdateConfigOptions} options - The options to update the config file with.
 * @returns {Promise<void>} - A promise that resolves when the config file is updated.
 *
 * Hint: Mark a field as null to remove it from the config file.
 */
export default async function updateConfig(
  configFilepath: string,
  options: UpdateConfigOptions
): Promise<void> {
  // Filter out empty string values from the config object
  const { projectId, _versionId, _branchId, stageTranslations } = options;
  const newContent = {
    ...(projectId && { projectId }),
    ...(_versionId && { _versionId }),
    ...(_branchId && { _branchId }),
    // Omit when false
    ...(stageTranslations && { stageTranslations }),
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

    // Apply null filter to remove values that were marked for removal
    const filteredContent = applyNullFilter(mergedContent, options);

    // write to file
    const jsonContent = JSON.stringify(filteredContent, null, 2);
    await fs.promises.writeFile(configFilepath, jsonContent, 'utf-8');

    // show update in console
    displayUpdatedConfigFile(configFilepath);
  } catch (error) {
    logger.error(
      `An error occurred while updating ${configFilepath}: ${error}`
    );
  }
}

// --- Helper functions --- //

/**
 * Remove values from object if they were marked for removal
 */
function applyNullFilter<T extends Record<string, unknown>>(
  obj: T,
  filter: Partial<Record<keyof T, unknown>>
): T {
  const result = { ...obj };
  for (const key of Object.keys(filter)) {
    if (filter[key] === null) {
      delete result[key];
    }
  }
  return result;
}
