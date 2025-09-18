import type { Adapter, GTFile, Secrets } from '../types';
import { gt, overrideConfig } from './core';

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
  const text = await gt.downloadTranslatedFile({
    fileId: documentInfo.documentId,
    versionId: documentInfo.versionId || undefined,
    locale: localeId,
  });
  return text;
};
