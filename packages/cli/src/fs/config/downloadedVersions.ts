import fs from 'node:fs';
import path from 'node:path';
import { logError } from '../../console/logging.js';

// New lock file name, use old name for deletion of legacy lock file
const GT_LOCK_FILE = 'gt-lock.json';
const LEGACY_DOWNLOADED_VERSIONS_FILE = 'downloaded-versions.json';

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
    // Clean up legacy lock files inside the config directory
    const rootPath = path.join(process.cwd(), GT_LOCK_FILE);
    const legacyPath = path.join(
      configDirectory,
      LEGACY_DOWNLOADED_VERSIONS_FILE
    );

    try {
      if (fs.existsSync(legacyPath)) {
        fs.unlinkSync(legacyPath);
      }
    } catch {}

    const filepath = fs.existsSync(rootPath) ? rootPath : null;
    if (!filepath) return { version: 1, entries: {} };
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
    // Write the lock file to the repo root
    const filepath = path.join(process.cwd(), GT_LOCK_FILE);
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(lock, null, 2));
  } catch (error) {
    logError(`An error occurred while updating ${GT_LOCK_FILE}: ${error}`);
  }
}
