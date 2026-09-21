import type { GTFile, Secrets } from '../types';
import { api, gt, overrideConfig } from '../adapter/core';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { SerializedDocument } from '../serialization/types';
import { resolveFileName } from '../utils/fileNames';

// note: this function is used to create a new translation task
// uploads files & calls the getTranslationTask function
export async function uploadFiles(
  documents: {
    info: GTFile;
    serializedDocument: SerializedDocument;
  }[],
  secrets: Secrets | null
): Promise<Awaited<ReturnType<typeof api.uploadSourceFiles>>> {
  overrideConfig(secrets);
  const uploadResult = await api.uploadSourceFiles(
    documents.map(({ info, serializedDocument }) => ({
      source: {
        content: serializedDocument.content,
        fileName: resolveFileName(info),
        fileId: info.documentId,
        fileFormat: 'HTML',
        locale: gt.sourceLocale || libraryDefaultLocale,
        versionId: info.versionId || undefined,
      },
    })),
    {
      sourceLocale: gt.sourceLocale || libraryDefaultLocale,
    }
  );
  return uploadResult;
}
