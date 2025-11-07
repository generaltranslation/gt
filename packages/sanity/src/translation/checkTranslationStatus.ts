import type { Secrets } from '../types';
import { gt, overrideConfig } from '../adapter/core';
import { FileProperties } from '../adapter/types';

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
    const currentQueryData = fileQueryData.filter(
      (item) =>
        !downloadStatus.downloaded.has(`${item.fileId}:${item.locale}`) &&
        !downloadStatus.failed.has(`${item.fileId}:${item.locale}`) &&
        !downloadStatus.skipped.has(`${item.fileId}:${item.locale}`)
    );

    // If all files have been downloaded, we're done
    if (currentQueryData.length === 0) {
      return true;
    }
    // Check for translations
    const responseData = await gt.queryFileData({
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
