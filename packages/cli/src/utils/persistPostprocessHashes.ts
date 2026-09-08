import * as fs from 'node:fs';
import {
  findOrCreateEntry,
  readLockfile,
  writeLockfile,
} from '../fs/config/downloadedVersions.js';
import { hashStringSync } from './hash.js';
import { fileEncodingSkipReason } from '../console/index.js';
import { logger } from '../console/logger.js';
import { getRelative } from '../fs/findFilepath.js';
import { recordWarning } from '../state/translateWarnings.js';
import { readFileContent } from '../fs/fileContent.js';
import type { DownloadMeta } from '../state/recentDownloads.js';
import type { Settings } from '../types/index.js';

/**
 * Persist postprocessed content hashes for recently downloaded files into gt-lock.json.
 */
export function persistPostProcessHashes(
  settings: Settings,
  includeFiles: Set<string> | undefined,
  downloadedMeta: Map<string, DownloadMeta[]>
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
    const metas = downloadedMeta.get(filePath);
    if (!metas) continue;
    if (!fs.existsSync(filePath)) continue;

    // The hash stands for the file's pipeline content, which is what every
    // other producer and consumer of it compares against.
    let hash: string;
    try {
      hash = hashStringSync(readFileContent(filePath, metas[0].fileFormat));
    } catch (error) {
      // The translation is already written; failing here would lose the whole
      // run's lockfile update over one unreadable file. Skip it and report it
      const relativePath = getRelative(filePath);
      const reason = fileEncodingSkipReason(error);
      logger.warn(`Skipping ${relativePath}: ${reason}`);
      recordWarning('skipped_file', relativePath, reason);
      continue;
    }

    // A file that holds every locale carries the same hash under each locale
    // merged into it this run, so a local edit invalidates all of them.
    for (const meta of metas) {
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
  }

  if (lockUpdated) {
    writeLockfile(data, originalV1);
  }
}

function findDownloadedBranchId(
  includeFiles: Set<string>,
  downloadedMeta: Map<string, DownloadMeta[]>
): string | undefined {
  for (const filePath of includeFiles) {
    const branchId = downloadedMeta.get(filePath)?.[0]?.branchId;
    if (branchId) return branchId;
  }
  return undefined;
}
