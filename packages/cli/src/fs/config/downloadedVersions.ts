import fs from 'node:fs';
import path from 'node:path';
import { logError } from '../../console/logging.js';

const DOWNLOADED_VERSIONS_FILE = 'downloaded-versions.json';

export type DownloadedVersionData = Record<string, string>;

export function getDownloadedVersions(
  configDirectory: string
): DownloadedVersionData {
  try {
    const filepath = path.join(configDirectory, DOWNLOADED_VERSIONS_FILE);
    if (!fs.existsSync(filepath)) return {};
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    return data || {};
  } catch (error) {
    logError(`An error occurred while getting downloaded versions: ${error}`);
    return {};
  }
}

export function saveDownloadedVersions(
  configDirectory: string,
  versionData: DownloadedVersionData
): void {
  try {
    const filepath = path.join(configDirectory, DOWNLOADED_VERSIONS_FILE);
    fs.mkdirSync(configDirectory, { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(versionData, null, 2));
  } catch (error) {
    logError(
      `An error occurred while updating ${DOWNLOADED_VERSIONS_FILE}: ${error}`
    );
  }
}
