import fs from 'node:fs';
import path from 'node:path';
import { logError } from '../../console/logging.js';

const DOWNLOADED_VERSIONS_FILE = 'downloaded-versions.json';

export type DownloadedVersionEntry = {
  versionId: string;
  fileId?: string;
  fileName?: string;
  updatedAt?: string;
};

export type DownloadedVersions = {
  version: number;
  entries: Record<string, DownloadedVersionEntry>;
};

export function getDownloadedVersions(
  configDirectory: string
): DownloadedVersions {
  try {
    const filepath = path.join(configDirectory, DOWNLOADED_VERSIONS_FILE);
    if (!fs.existsSync(filepath)) return { version: 1, entries: {} };
    const raw = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    if (raw && typeof raw === 'object' && raw.version && raw.entries) {
      return raw as DownloadedVersions;
    }
    return { version: 1, entries: {} };
  } catch (error) {
    logError(`An error occurred while getting downloaded versions: ${error}`);
    return { version: 1, entries: {} };
  }
}

export function saveDownloadedVersions(
  configDirectory: string,
  lock: DownloadedVersions
): void {
  try {
    const filepath = path.join(configDirectory, DOWNLOADED_VERSIONS_FILE);
    fs.mkdirSync(configDirectory, { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(lock, null, 2));
  } catch (error) {
    logError(
      `An error occurred while updating ${DOWNLOADED_VERSIONS_FILE}: ${error}`
    );
  }
}
