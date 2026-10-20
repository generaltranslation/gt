import type { Adapter, GTFile, GTSerializedDocument, Secrets } from '../types';
import { getTranslationTask } from './getTranslationTask';
import { api, gt, overrideConfig } from './core';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import {
  failedResultsDiagnostic,
  succeededResults,
} from '../utils/batchResults';
import { syncProjectDefaultLocale } from './syncProjectDefaultLocale';

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
          locale: gt.sourceLocale || libraryDefaultLocale,
          versionId: documentInfo.versionId || undefined,
        },
      },
    ],
    {
      sourceLocale: gt.sourceLocale || libraryDefaultLocale,
    }
  );
  if (uploadResult.summary.failed > 0) {
    throw new Error(
      failedResultsDiagnostic(
        'The document could not be uploaded to General Translation',
        uploadResult,
        'Error'
      )
    );
  }
  await syncProjectDefaultLocale(gt.sourceLocale || libraryDefaultLocale);
  await api.translateFiles(succeededResults(uploadResult), {
    sourceLocale: gt.sourceLocale || libraryDefaultLocale,
    targetLocales: localeIds,
  });
  const task = await getTranslationTask(documentInfo, secrets);
  return task;
};
