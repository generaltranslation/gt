import type { Adapter, Secrets } from '../types';
import type { SerializedDocument } from 'sanity-naive-html-serializer';
import { getTranslationTask } from './getTranslationTask';
import { gt, overrideConfig } from './core';
import { libraryDefaultLocale } from 'generaltranslation/internal';

// note: this function is used to create a new translation task
// uploads files & calls the getTranslationTask function
export const createTask: Adapter['createTask'] = async (
  taskName: string,
  serializedDocument: SerializedDocument,
  localeIds: string[],
  secrets: Secrets | null,
  workflowUid?: string,
  callbackUrl?: string
) => {
  const fileName = `sanity-${serializedDocument.name}`;
  overrideConfig(secrets);
  const uploadResult = await gt.uploadSourceFiles(
    [
      {
        source: {
          content: serializedDocument.content,
          fileName,
          fileId: serializedDocument.name,
          fileFormat: 'HTML',
          locale: gt.sourceLocale || libraryDefaultLocale,
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
  const task = await getTranslationTask(serializedDocument.name, secrets);
  return task;
};
