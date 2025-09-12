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
  const { fileId, versionId } = JSON.parse(taskId);
  const result = await gt.downloadTranslatedFile({
    fileId,
    versionId,
    locale: localeId,
  });
  const text = Buffer.from(result).toString('utf-8');
  return text;
};
