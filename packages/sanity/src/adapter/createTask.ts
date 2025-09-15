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
  gt.setConfig({
    projectId: secrets?.project,
    apiKey: secrets?.secret,
  });
  const uploadResult = await gt.uploadSourceFiles(
    [
      {
        source: {
          content: serializedDocument.content,
          fileName,
          fileId: serializedDocument.name,
          fileFormat: 'HTML',
          locale: 'en',
        },
      },
    ],
    {
      sourceLocale: 'en',
    }
  );
  const enqueueResult = await gt.enqueueFiles(uploadResult.uploadedFiles, {
    sourceLocale: 'en',
    targetLocales: localeIds,
  });
  const task = await getTranslationTask(serializedDocument.name, secrets);
  return task;
};
