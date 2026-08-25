import type { Adapter, GTFile, Secrets } from '../types';
import { api, overrideConfig } from './core';

// note: downloads the translation for a given task and locale
export const getTranslation: Adapter['getTranslation'] = async (
  documentInfo: GTFile,
  localeId: string,
  secrets: Secrets | null
) => {
  if (!secrets) {
    return '';
  }
  overrideConfig(secrets);
  const text = await api.downloadFile({
    fileId: documentInfo.documentId,
    versionId: documentInfo.versionId || undefined,
    locale: localeId,
  });
  return text;
};
