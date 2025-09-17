import type { Adapter, Secrets } from '../types';
import { gt, overrideConfig } from './core';

// note: downloads the translation for a given task and locale
export const getTranslation: Adapter['getTranslation'] = async (
  taskId: string,
  localeId: string,
  secrets: Secrets | null
) => {
  if (!secrets) {
    return '';
  }
  overrideConfig(secrets);
  const text = await gt.downloadTranslatedFile({
    fileId: taskId,
    locale: localeId,
  });
  return text;
};
