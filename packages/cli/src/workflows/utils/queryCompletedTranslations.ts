import type { GT } from 'generaltranslation';
import type { FileProperties } from '../../types/files.js';

export type QueryCompletedTranslationsClient = Pick<GT, 'queryFileData'>;

export function getFileTranslationKey(
  file: Pick<FileProperties, 'branchId' | 'fileId' | 'versionId' | 'locale'>
): string {
  return `${file.branchId}:${file.fileId}:${file.versionId}:${file.locale}`;
}

export async function queryCompletedTranslationKeys(
  gt: QueryCompletedTranslationsClient,
  fileQueryData: FileProperties[]
): Promise<Set<string>> {
  if (fileQueryData.length === 0) {
    return new Set();
  }

  const fileData = await gt.queryFileData({
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
