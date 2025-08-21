import fs from 'node:fs';
import { displayUpdatedVersionsFile } from '../../console/logging.js';
import { logError } from '../../console/logging.js';
import path from 'node:path';

const STAGED_VERSIONS_FILE = 'staged-versions.json';
type StagedVersionData = Record<
  string,
  { fileName: string; versionId: string }
>;
// Update the versions.json file with the new version ids
// of the translations that were sent to the API
export async function updateVersions({
  configDirectory,
  versionData,
}: {
  configDirectory: string;
  versionData: StagedVersionData;
}): Promise<void> {
  const versionFilepath = path.join(configDirectory, STAGED_VERSIONS_FILE);
  try {
    fs.mkdirSync(configDirectory, { recursive: true });
    fs.writeFileSync(versionFilepath, JSON.stringify(versionData, null, 2));

    // show update in console
    displayUpdatedVersionsFile(versionFilepath);
  } catch (error) {
    logError(`An error occurred while updating ${versionFilepath}: ${error}`);
  }
}

export async function getStagedVersions(
  configDirectory: string
): Promise<StagedVersionData> {
  try {
    const versionFilepath = path.join(configDirectory, STAGED_VERSIONS_FILE);
    const versionData = JSON.parse(fs.readFileSync(versionFilepath, 'utf8'));
    return versionData;
  } catch (error) {
    logError(`An error occurred while getting staged versions: ${error}`);
    return {};
  }
}
