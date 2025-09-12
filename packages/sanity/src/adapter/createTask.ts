import { Adapter, Secrets, SerializedDocument } from 'sanity-translations-tab';
import { getTranslationTask } from './getTranslationTask';
import { gt } from './core';

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
  const uploadResult = await gt.uploadSourceFiles(
    [
      {
        source: {
          content: serializedDocument.content,
          fileName,
          fileFormat: 'HTML',
          locale: 'en',
        },
      },
    ],
    {
      sourceLocale: 'en',
    }
  );
  console.log('uploadResult', uploadResult);
  const enqueueResult = await gt.enqueueFiles(uploadResult.uploadedFiles, {
    sourceLocale: 'en',
    targetLocales: localeIds,
  });
  console.log('enqueueResult', enqueueResult);
  const fileId = uploadResult.uploadedFiles[0].fileId;
  const versionId = uploadResult.uploadedFiles[0].versionId;
  const task = await getTranslationTask(
    JSON.stringify({ fileId, versionId }),
    secrets
  );
  console.log('task', task);
  return task;
};
