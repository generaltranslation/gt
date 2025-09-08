import { Adapter, Secrets } from 'sanity-translations-tab';
import { getLocales } from './getLocales';

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

  return {
    taskId: documentId,
    documentId: documentId,
    locales: [],
  };
};
