import * as fs from 'node:fs';
import {
  findOrCreateEntry,
  readLockfile,
  writeLockfile,
} from '../fs/config/downloadedVersions.js';
import { hashStringSync } from './hash.js';
import type { Settings } from '../types/index.js';

type DownloadMeta = {
  branchId: string;
  fileId: string;
  versionId: string;
  locale: string;
};

/**
 * Persist postprocessed content hashes for recently downloaded files into gt-lock.json.
 */
export function persistPostProcessHashes(
  settings: Settings,
  includeFiles: Set<string> | undefined,
  downloadedMeta: Map<string, DownloadMeta>
): void {
  if (!includeFiles || includeFiles.size === 0 || downloadedMeta.size === 0) {
    return;
  }

  const { data, originalV1 } = readLockfile(settings);
  let lockUpdated = false;

  for (const filePath of includeFiles) {
    const meta = downloadedMeta.get(filePath);
    if (!meta) continue;
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    const hash = hashStringSync(content);

    const entry = findOrCreateEntry(
      data.entries,
      meta.fileId,
      meta.versionId
    );

    const existing = entry.translations[meta.locale] || {};

    if (existing.postProcessHash !== hash) {
      entry.translations[meta.locale] = {
        ...existing,
        postProcessHash: hash,
      };
      lockUpdated = true;
    }
  }

  if (lockUpdated) {
    writeLockfile(data, originalV1);
  }
}
