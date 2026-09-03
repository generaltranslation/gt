import * as fs from 'node:fs';
import {
  findOrCreateEntry,
  readLockfile,
  writeLockfile,
} from '../fs/config/downloadedVersions.js';
import { hashStringSync } from './hash.js';
import { readFileContent } from '../fs/fileContent.js';
import type { DownloadMeta } from '../state/recentDownloads.js';
import type { Settings } from '../types/index.js';

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

  const branchId = findDownloadedBranchId(includeFiles, downloadedMeta);
  if (!branchId) return;

  const { data, entryMap, originalV1 } = readLockfile({
    ...settings,
    _branchId: branchId,
  });
  let lockUpdated = false;

  for (const filePath of includeFiles) {
    const meta = downloadedMeta.get(filePath);
    if (!meta) continue;
    if (!fs.existsSync(filePath)) continue;

    // The hash stands for the file's pipeline content, which is what every
    // other producer and consumer of it compares against.
    const hash = hashStringSync(readFileContent(filePath, meta.fileFormat));

    const entry = findOrCreateEntry(
      entryMap,
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

function findDownloadedBranchId(
  includeFiles: Set<string>,
  downloadedMeta: Map<string, DownloadMeta>
): string | undefined {
  for (const filePath of includeFiles) {
    const meta = downloadedMeta.get(filePath);
    if (meta) return meta.branchId;
  }
  return undefined;
}
