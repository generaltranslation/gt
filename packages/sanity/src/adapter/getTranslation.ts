import { Adapter, Secrets } from 'sanity-translations-tab';
import { gt } from './core';

// note: downloads the translation for a given task and locale
export const getTranslation: Adapter['getTranslation'] = async (
  taskId: string,
  localeId: string,
  secrets: Secrets | null
) => {
  if (!secrets) {
    return '';
  }
  gt.setConfig({
    projectId: secrets?.project,
    apiKey: secrets?.secret,
  });
  const text = await gt.downloadTranslatedFile({
    fileId: taskId,
    locale: localeId,
  });
  return text;
};
