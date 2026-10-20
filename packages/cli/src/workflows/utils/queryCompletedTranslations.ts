import type { FileProperties } from '../../types/files.js';
import type { ApiClient } from '../../utils/api.js';

export type QueryCompletedTranslationsClient = Pick<ApiClient, 'queryFiles'>;

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

  const { results } = await api.queryFiles(
    fileQueryData.map((file) => ({
      fileId: file.fileId,
      versionId: file.versionId,
      branchId: file.branchId,
      locale: file.locale,
    }))
  );

  // Results follow the selector order
  return new Set(
    fileQueryData
      .filter(
        (_, index) =>
          results[index]?.status === 'found' && !!results[index].completedAt
      )
      .map(getFileTranslationKey)
  );
}
