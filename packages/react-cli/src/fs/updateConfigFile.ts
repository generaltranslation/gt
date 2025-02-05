import fs from 'fs';
import { displayCreatingNewConfigFile } from '../console/console';

const INCLUDED_KEYS = [
  'projectId',
  'defaultLocale',
  '_versionId',
  'enableTimeout',
  'timeout',
];

/**
 * Checks if the config file exists. If not, creates a new JSON file at the given filepath and writes the provided config object to it.
 * If it does exist, add the version id
 * @param {string} configFilepath - The path to the config file.
 * @param {Record<string, any>} configObject - The config object to write if the file does not exist.
 */
export default function updateConfigFile(
  configFilepath: string,
  configObject: Record<string, any>
): void {
  // Filter out empty string values from the config object
  const filteredConfigObject = Object.fromEntries(
    Object.entries(configObject)
      .filter(([key, value]) => INCLUDED_KEYS.includes(key) && value !== '')
      .map(([key, value]) => {
        if (key === 'timeout') {
          return [key, parseInt(value, 10)];
        }
        return [key, value];
      })
  );
  try {
    // if file does not exist
    if (!fs.existsSync(configFilepath)) {
      // Convert the config object to a JSON string
      const jsonContent = JSON.stringify(filteredConfigObject, null, 2);
      // Write the JSON string to the file, creating a new file if it doesn't exist
      fs.writeFileSync(configFilepath, jsonContent, 'utf-8');
      // console.log
      displayCreatingNewConfigFile(configFilepath);
    } else {
      // if the file exists
      const oldContent = JSON.parse(fs.readFileSync(configFilepath, 'utf-8'));
      const newJsonContent = {
        ...oldContent,
        ...filteredConfigObject,
      };
      // Convert the config object to a JSON string
      const jsonContent = JSON.stringify(newJsonContent, null, 2);
      // Write the JSON string to the file, creating a new file if it doesn't exist
      fs.writeFileSync(configFilepath, jsonContent, 'utf-8');
      // console.log
      displayCreatingNewConfigFile(configFilepath);
    }
  } catch (error) {
    console.error(`An error occurred while updating ${configFilepath}:`, error);
  }
}
