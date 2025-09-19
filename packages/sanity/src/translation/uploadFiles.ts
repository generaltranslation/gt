import type { GTFile, Secrets } from '../types';
import { gt, overrideConfig } from '../adapter/core';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { SerializedDocument } from 'sanity-naive-html-serializer';

// note: this function is used to create a new translation task
// uploads files & calls the getTranslationTask function
export async function uploadFiles(
  documents: {
    info: GTFile;
    serializedDocument: SerializedDocument;
  }[],
  secrets: Secrets | null
): Promise<Awaited<ReturnType<typeof gt.uploadSourceFiles>>> {
  overrideConfig(secrets);
  const uploadResult = await gt.uploadSourceFiles(
    documents.map(({ info, serializedDocument }) => ({
      source: {
        content: serializedDocument.content,
        fileName: `sanity/${info.documentId}`,
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
