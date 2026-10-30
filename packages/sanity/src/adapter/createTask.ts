import type { Adapter, GTFile, GTSerializedDocument, Secrets } from '../types';
import { getTranslationTask } from './getTranslationTask';
import { api, gt, overrideConfig } from './core';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { allowsNonDefaultSourceLocales } from '../utils/translationSource';

// note: this function is used to create a new translation task
// uploads files & calls the getTranslationTask function
export const createTask: Adapter['createTask'] = async (
  documentInfo: GTFile,
  serializedDocument: GTSerializedDocument,
  localeIds: string[],
  secrets: Secrets | null,
  _workflowUid?: string,
  _callbackUrl?: string
) => {
  const fileName = `sanity/${documentInfo.documentId}`;
  overrideConfig(secrets);
  const uploadResult = await api.uploadSourceFiles(
    [
      {
        source: {
          content: serializedDocument.content,
          fileName,
          fileId: documentInfo.documentId,
          fileFormat: 'HTML',
          // Per-file locale with a default request-level `sourceLocale`; see
          // uploadFiles and generaltranslation/gt-cloud#5620.
          locale:
            (allowsNonDefaultSourceLocales()
              ? (serializedDocument.sourceLocale ?? documentInfo.sourceLocale)
              : undefined) ??
            (gt.sourceLocale || libraryDefaultLocale),
          versionId: documentInfo.versionId || undefined,
        },
      },
    ],
    {
      sourceLocale: gt.sourceLocale || libraryDefaultLocale,
    }
  );
  await api.enqueueFiles(uploadResult.uploadedFiles, {
    sourceLocale: gt.sourceLocale || libraryDefaultLocale,
    targetLocales: localeIds,
  });
  const task = await getTranslationTask(documentInfo, secrets);
  return task;
};
