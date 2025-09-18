import type { Adapter, GTFile, GTSerializedDocument, Secrets } from '../types';
import { getTranslationTask } from './getTranslationTask';
import { gt, overrideConfig } from './core';
import { libraryDefaultLocale } from 'generaltranslation/internal';

// note: this function is used to create a new translation task
// uploads files & calls the getTranslationTask function
export const createTask: Adapter['createTask'] = async (
  documentInfo: GTFile,
  serializedDocument: GTSerializedDocument,
  localeIds: string[],
  secrets: Secrets | null,
  workflowUid?: string,
  callbackUrl?: string
) => {
  const fileName = `sanity-${documentInfo.documentId}`;
  overrideConfig(secrets);
  const uploadResult = await gt.uploadSourceFiles(
    [
      {
        source: {
          content: serializedDocument.content,
          fileName,
          fileId: documentInfo.documentId,
          fileFormat: 'HTML',
          locale: gt.sourceLocale || libraryDefaultLocale,
          versionId: documentInfo.versionId || undefined,
        },
      },
    ],
    {
      sourceLocale: gt.sourceLocale || libraryDefaultLocale,
    }
  );
  const enqueueResult = await gt.enqueueFiles(uploadResult.uploadedFiles, {
    sourceLocale: gt.sourceLocale || libraryDefaultLocale,
    targetLocales: localeIds,
  });
  const task = await getTranslationTask(documentInfo, secrets);
  return task;
};
