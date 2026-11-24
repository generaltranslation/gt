import type { Secrets } from '../types';
import { api, overrideConfig } from '../adapter/core';
import { FileProperties } from '../adapter/types';
import {
  createStableTranslationKey,
  createTranslationStatusKey,
} from '../utils/documentIds';

export async function checkTranslationStatus(
  fileQueryData: FileProperties[],
  downloadStatus: {
    downloaded: Set<string>;
    failed: Set<string>;
    skipped: Set<string>;
  },
  secrets: Secrets
) {
  overrideConfig(secrets);
  try {
    // Only query for files that haven't been downloaded yet
    const currentQueryData = fileQueryData.filter((item) => {
      const statusKey = createTranslationStatusKey(
        item.branchId,
        item.fileId,
        item.versionId,
        item.locale
      );
      const stableKey = createStableTranslationKey(
        item.branchId,
        item.fileId,
        item.locale
      );
      return (
        !downloadStatus.downloaded.has(statusKey) &&
        !downloadStatus.downloaded.has(stableKey) &&
        !downloadStatus.failed.has(statusKey) &&
        !downloadStatus.failed.has(stableKey) &&
        !downloadStatus.skipped.has(statusKey) &&
        !downloadStatus.skipped.has(stableKey)
      );
    });

    // If all files have been downloaded, we're done
    if (currentQueryData.length === 0) {
      return true;
    }
    // Check for translations
    const responseData = await api.queryFileData({
      translatedFiles: currentQueryData,
    });

    const translations = responseData.translatedFiles || [];

    // Filter for ready translations
    const readyTranslations = translations.filter(
      (translation) => translation.completedAt
    );

    return readyTranslations;
  } catch (error) {
    console.error('Error checking translation status', error);
    return [];
  }
}

// The file info endpoint rejects a request for more files than this.
const MAX_FILES_PER_QUERY = 100;

/** When GT completed the result it currently holds for each file, by status key. Files without a completed result are left out. */
export async function getCompletedResults(
  fileQueryData: FileProperties[],
  secrets: Secrets
): Promise<Map<string, string>> {
  overrideConfig(secrets);
  const completed = new Map<string, string>();
  for (
    let start = 0;
    start < fileQueryData.length;
    start += MAX_FILES_PER_QUERY
  ) {
    const responseData = await api.queryFileData({
      translatedFiles: fileQueryData.slice(start, start + MAX_FILES_PER_QUERY),
    });
    for (const translation of responseData.translatedFiles || []) {
      if (!translation.completedAt) continue;
      completed.set(
        createTranslationStatusKey(
          translation.branchId,
          translation.fileId,
          translation.versionId,
          translation.locale
        ),
        translation.completedAt
      );
    }
  }
  return completed;
}

export function isCompletedAfter(
  completedAt: string | null | undefined,
  supersededAt: string
): boolean {
  return !!completedAt && Date.parse(completedAt) > Date.parse(supersededAt);
}
