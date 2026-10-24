import type { FileProperties } from '../../types/files.js';
import type { ProjectHandle } from 'generaltranslation';

export type QueryCompletedTranslationsClient = Pick<
  ProjectHandle,
  'queryFiles'
>;

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

  const { results } = await api.queryFiles(fileQueryData);

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
