import { Adapter, Secrets } from 'sanity-translations-tab';

// note: downloads the translation for a given task and locale
export const getTranslation: Adapter['getTranslation'] = async (
  taskId: string,
  localeId: string,
  secrets: Secrets | null
) => {
  return '';
};
