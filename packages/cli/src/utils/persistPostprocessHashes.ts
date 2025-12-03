import * as fs from 'node:fs';
import {
  ensureNestedObject,
  getDownloadedVersions,
  saveDownloadedVersions,
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

  const downloadedVersions = getDownloadedVersions(settings.configDirectory);
  let lockUpdated = false;

  for (const filePath of includeFiles) {
    const meta = downloadedMeta.get(filePath);
    if (!meta) continue;
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    const hash = hashStringSync(content);

    ensureNestedObject(downloadedVersions.entries, [
      meta.branchId,
      meta.fileId,
      meta.versionId,
      meta.locale,
    ]);

    const existing =
      downloadedVersions.entries[meta.branchId][meta.fileId][meta.versionId][
        meta.locale
      ] || {};

    if (existing.postProcessHash !== hash) {
      downloadedVersions.entries[meta.branchId][meta.fileId][meta.versionId][
        meta.locale
      ] = {
        ...existing,
        postProcessHash: hash,
      };
      lockUpdated = true;
    }
  }

  if (lockUpdated) {
    saveDownloadedVersions(settings.configDirectory, downloadedVersions);
  }
}
