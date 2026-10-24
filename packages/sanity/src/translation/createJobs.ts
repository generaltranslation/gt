import type { ProjectHandle } from 'generaltranslation';
import { gt, projectFor } from '../adapter/core';
import type { Secrets } from '../types';
import { succeededResults } from '../utils/batchResults';

export async function createJobs(
  uploadResult: Awaited<ReturnType<ProjectHandle['uploadSourceFiles']>>,
  localeIds: string[],
  secrets: Secrets,
  // Discard any translation GT already holds for these files and retranslate
  // from source. Without this, GT reuses unchanged content — including
  // translations captured from the Studio — so a bad translation can never be
  // regenerated.
  force: boolean = false
): Promise<Awaited<ReturnType<ProjectHandle['translateFiles']>>> {
  const enqueueResult = await projectFor(secrets).translateFiles(
    succeededResults(uploadResult),
    {
      sourceLocale: gt.defaultLocale,
      targetLocales: localeIds,
      force,
    }
  );
  return enqueueResult;
}
