import { Adapter, Secrets } from 'sanity-translations-tab';
import { gt } from './core';

// note: this function is used to get the status of a current translation task
export const getTranslationTask: Adapter['getTranslationTask'] = async (
  documentId: string,
  secrets: Secrets | null
) => {
  if (!documentId || !secrets) {
    return {
      taskId: documentId,
      documentId: documentId,
      locales: [],
    };
  }
  const { fileId, versionId } = JSON.parse(documentId);
  const task = await gt.querySourceFile({
    fileId,
    versionId,
  });

  return {
    taskId: documentId, // same as documentId since we are using the fileId and versionId to uniquely identify the task
    documentId: documentId,
    locales: task.translations.map((translation) => ({
      localeId: translation.locale,
      progress: translation.completedAt ? 100 : 0,
    })),
  };
};
