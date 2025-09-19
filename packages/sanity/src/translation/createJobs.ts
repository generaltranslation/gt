import { libraryDefaultLocale } from 'generaltranslation/internal';
import { gt, overrideConfig } from '../adapter/core';
import type { Secrets } from '../types';

export async function createJobs(
  uploadResult: Awaited<ReturnType<typeof gt.uploadSourceFiles>>,
  localeIds: string[],
  secrets: Secrets
): Promise<Awaited<ReturnType<typeof gt.enqueueFiles>>> {
  overrideConfig(secrets);
  const enqueueResult = await gt.enqueueFiles(uploadResult.uploadedFiles, {
    sourceLocale: gt.sourceLocale || libraryDefaultLocale,
    targetLocales: localeIds,
  });
  return enqueueResult;
}
