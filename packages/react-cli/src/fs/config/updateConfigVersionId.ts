import fs from 'fs';
import { displayUpdatedConfigFile } from '../../console/console';

const INCLUDED_KEYS = ['projectId', 'versionId'];

/**
 * Update the config file version id and projectId (if necessary)
 * @param {Record<string, any>} configObject - The config object to write if the file does not exist.
 */
export default function updateConfigVersionId(
  configFilepath: string,
  projectId?: string,
  _versionId?: string
): void {
  // Filter out empty string values from the config object
  const newContent = {
    ...(projectId && { projectId }),
    ...(_versionId && { _versionId }),
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

    // write to file
    const mergedJsonContent = JSON.stringify(mergedContent, null, 2);
    fs.writeFileSync(configFilepath, mergedJsonContent, 'utf-8');

    // show update in console
    displayUpdatedConfigFile(configFilepath);
  } catch (error) {
    console.error(`An error occurred while updating ${configFilepath}:`, error);
  }
}
