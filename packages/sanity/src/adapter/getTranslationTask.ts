import type { Adapter, GTFile, Secrets } from '../types';
import { gt, overrideConfig } from './core';

// note: this function is used to get the status of a current translation task
export const getTranslationTask: Adapter['getTranslationTask'] = async (
  documentInfo: GTFile,
  secrets: Secrets | null
) => {
  if (!documentInfo.documentId || !secrets) {
    return {
      document: documentInfo,
      locales: [],
    };
  }
  overrideConfig(secrets);
  const task = await gt.querySourceFile({
    fileId: documentInfo.documentId,
    versionId: documentInfo.versionId || undefined,
  });

  return {
    document: {
      documentId: task.sourceFile.fileId,
      versionId: task.sourceFile.versionId,
    },
    locales: task.translations.map((translation) => ({
      localeId: translation.locale,
      progress: translation.completedAt ? 100 : 0,
    })),
  };
};
