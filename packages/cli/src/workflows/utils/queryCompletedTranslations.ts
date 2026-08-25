import type { FileProperties } from '../../types/files.js';
import type { ApiClient } from '../../utils/api.js';

export type QueryCompletedTranslationsClient = Pick<ApiClient, 'queryFileData'>;

export function getFileTranslationKey(
  file: Pick<FileProperties, 'branchId' | 'fileId' | 'versionId' | 'locale'>
): string {
  return `${file.branchId}:${file.fileId}:${file.versionId}:${file.locale}`;
}

export async function queryCompletedTranslationKeys(
  api: QueryCompletedTranslationsClient,
  fileQueryData: FileProperties[]
): Promise<Set<string>> {
  if (fileQueryData.length === 0) {
    return new Set();
  }

  const fileData = await api.queryFileData({
    translatedFiles: fileQueryData.map((file) => ({
      fileId: file.fileId,
      versionId: file.versionId,
      branchId: file.branchId,
      locale: file.locale,
    })),
  });

  return new Set(
    (fileData.translatedFiles || [])
      .filter((file) => !!file.completedAt)
      .map(getFileTranslationKey)
  );
}
