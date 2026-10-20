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
    const { results } = await api.queryFiles(currentQueryData);

    // Results follow the selector order; keep the completed translations.
    const readyTranslations = currentQueryData.filter((_, index) => {
      const result = results[index];
      return result.status === 'found' && result.completedAt;
    });

    return readyTranslations;
  } catch (error) {
    console.error('Error checking translation status', error);
    return [];
  }
}
