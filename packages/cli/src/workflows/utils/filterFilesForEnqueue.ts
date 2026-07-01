import type { GT } from 'generaltranslation';
import type { FileReference } from 'generaltranslation/types';
import type { FileProperties } from '../../types/files.js';
import { logger } from '../../console/logger.js';
import {
  getFileTranslationKey,
  queryCompletedTranslationKeys,
} from './queryCompletedTranslations.js';

type FilterFilesForEnqueueClient = Pick<GT, 'queryFileData'>;

export type EnqueueFilterResult = {
  filesToEnqueue: FileReference[];
  skippedFiles: FileReference[];
};

export async function filterFilesForEnqueue({
  gt,
  files,
  locales,
  force,
}: {
  gt: FilterFilesForEnqueueClient;
  files: FileReference[];
  locales: string[];
  force?: boolean;
}): Promise<EnqueueFilterResult> {
  if (force || files.length === 0 || locales.length === 0) {
    return { filesToEnqueue: files, skippedFiles: [] };
  }

  const fileQueryData: FileProperties[] = files.flatMap((file) =>
    locales.map((locale) => ({
      branchId: file.branchId,
      fileId: file.fileId,
      versionId: file.versionId,
      fileName: file.fileName,
      locale,
    }))
  );

  let completedKeys: Set<string>;
  try {
    completedKeys = await queryCompletedTranslationKeys(gt, fileQueryData);
  } catch {
    return { filesToEnqueue: files, skippedFiles: [] };
  }

  const filesToEnqueue: FileReference[] = [];
  const skippedFiles: FileReference[] = [];

  for (const file of files) {
    const hasEveryLocale = locales.every((locale) =>
      completedKeys.has(
        getFileTranslationKey({
          branchId: file.branchId,
          fileId: file.fileId,
          versionId: file.versionId,
          locale,
        })
      )
    );

    if (hasEveryLocale) {
      skippedFiles.push(file);
    } else {
      filesToEnqueue.push(file);
    }
  }

  if (skippedFiles.length > 0) {
    logger.info(
      `Skipped enqueue for ${skippedFiles.length} already translated file${skippedFiles.length === 1 ? '' : 's'}`
    );
  }

  return { filesToEnqueue, skippedFiles };
}
