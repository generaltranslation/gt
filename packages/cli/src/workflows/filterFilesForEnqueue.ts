import fs from 'node:fs';
import path from 'node:path';
import type { FileReference } from 'generaltranslation/types';
import { createFileMapping } from '../formats/files/fileMapping.js';
import { readLockfileForBranch } from '../fs/config/downloadedVersions.js';
import type { BranchData } from '../types/branch.js';
import type { Settings } from '../types/index.js';

export type EnqueueFilterResult = {
  filesToEnqueue: FileReference[];
  skippedFiles: FileReference[];
};

/**
 * Filters only the enqueue payload. The caller should keep the full file list
 * for download tracking so existing translations can still be restored after a
 * locale directory clear.
 */
export function filterFilesForEnqueue({
  files,
  settings,
  branchData,
  force,
}: {
  files: FileReference[];
  settings: Settings;
  branchData: BranchData;
  force?: boolean;
}): EnqueueFilterResult {
  if (force || files.length === 0 || settings.locales.length === 0) {
    return { filesToEnqueue: files, skippedFiles: [] };
  }

  const { entryMap } = readLockfileForBranch(branchData.currentBranch.id, {
    allowEmptyBranchId: !settings.branchOptions.enabled,
  });
  if (entryMap.size === 0) {
    return { filesToEnqueue: files, skippedFiles: [] };
  }

  const fileMapping = createFileMapping(
    settings.files.resolvedPaths,
    settings.files.placeholderPaths,
    settings.files.transformPaths,
    settings.files.transformFormats,
    settings.locales,
    settings.defaultLocale
  );

  const filesToEnqueue: FileReference[] = [];
  const skippedFiles: FileReference[] = [];

  for (const file of files) {
    const entry = entryMap.get(file.fileId);
    if (!entry || entry.staged || entry.versionId !== file.versionId) {
      filesToEnqueue.push(file);
      continue;
    }

    const hasEveryLocale = settings.locales.every((locale) => {
      const expectedOutputPath = fileMapping[locale]?.[file.fileName];
      if (!expectedOutputPath) return false;

      const translation = entry.translations[locale];
      return (
        !!translation?.updatedAt &&
        translation.fileName === expectedOutputPath &&
        fs.existsSync(path.resolve(expectedOutputPath))
      );
    });

    if (hasEveryLocale) {
      skippedFiles.push(file);
    } else {
      filesToEnqueue.push(file);
    }
  }

  return { filesToEnqueue, skippedFiles };
}
