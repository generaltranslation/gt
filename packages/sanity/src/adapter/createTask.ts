import { Adapter, Secrets, SerializedDocument } from 'sanity-translations-tab';
import { getTranslationTask } from './getTranslationTask';

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
  console.log(
    'createTask',
    taskName,
    serializedDocument,
    localeIds,
    secrets,
    workflowUid,
    callbackUrl
  );
  const task = await getTranslationTask(serializedDocument.name, secrets);
  return task;
};
