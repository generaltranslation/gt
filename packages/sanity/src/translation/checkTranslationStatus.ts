import { isTransientApiError } from '@generaltranslation/api';
import type { Secrets } from '../types/types';
import { projectFor } from '../adapter/core';
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
    const { results } = await projectFor(secrets).queryFiles(currentQueryData);

    // Results follow the selector order; keep the completed translations.
    return currentQueryData.flatMap((file, index) => {
      const { status, completedAt } = results[index];
      return status === 'found' && completedAt
        ? [{ ...file, completedAt }]
        : [];
    });
  } catch (error) {
    // Only a failure that may clear reads as "nothing ready yet"; others surface.
    if (!isTransientApiError(error)) throw error;
    console.error('Error checking translation status', error);
    return [];
  }
}

/** When GT completed the result it currently holds for each file, by status key. Files without a completed result are left out. */
export async function getCompletedResults(
  fileQueryData: FileProperties[],
  secrets: Secrets
): Promise<Map<string, string>> {
  const { results } = await projectFor(secrets).queryFiles(fileQueryData);
  const completed = new Map<string, string>();
  // Results follow the selector order.
  fileQueryData.forEach((file, index) => {
    const { status, completedAt } = results[index];
    if (status !== 'found' || !completedAt) return;
    completed.set(
      createTranslationStatusKey(
        file.branchId,
        file.fileId,
        file.versionId,
        file.locale
      ),
      completedAt
    );
  });
  return completed;
}

export function isCompletedAfter(
  completedAt: string | null | undefined,
  supersededAt: string
): boolean {
  return !!completedAt && Date.parse(completedAt) > Date.parse(supersededAt);
}
