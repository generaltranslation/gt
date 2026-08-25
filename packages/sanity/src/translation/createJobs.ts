import { libraryDefaultLocale } from 'generaltranslation/internal';
import { api, gt, overrideConfig } from '../adapter/core';
import type { Secrets } from '../types';

export async function createJobs(
  uploadResult: Awaited<ReturnType<typeof api.uploadSourceFiles>>,
  localeIds: string[],
  secrets: Secrets,
  // Discard any translation GT already holds for these files and retranslate
  // from source. Without this, GT reuses unchanged content — including
  // translations captured from the Studio — so a bad translation can never be
  // regenerated.
  force: boolean = false
): Promise<Awaited<ReturnType<typeof api.enqueueFiles>>> {
  overrideConfig(secrets);
  const enqueueResult = await api.enqueueFiles(uploadResult.uploadedFiles, {
    sourceLocale: gt.sourceLocale || libraryDefaultLocale,
    targetLocales: localeIds,
    force,
  });
  return enqueueResult;
}
