import type { Secrets } from '../types/types';
import type { QueryJobsResponse } from '@generaltranslation/api';
import { projectFor } from '../adapter/core';
import { createTranslationStatusKey } from '../utils/documentIds';
import type { createJobs } from './createJobs';

/** Forced runs still in progress, watched so one that fails stops being pending. */
export type ForcedJobs = {
  /** Job id of each run, by status key. */
  running: Map<string, string>;
};

export function createForcedJobs(): ForcedJobs {
  return { running: new Map() };
}

/** Records the jobs of a run over `enqueuedKeys`, replacing earlier ones. */
export function trackEnqueuedJobs(
  forcedJobs: ForcedJobs,
  enqueuedKeys: Iterable<string>,
  enqueueResult: Awaited<ReturnType<typeof createJobs>> | undefined,
  force: boolean
) {
  for (const key of enqueuedKeys) forcedJobs.running.delete(key);
  if (!force) return;
  for (const { id, subject } of enqueueResult?.jobs ?? []) {
    if (subject.type !== 'file_translation') continue;
    forcedJobs.running.set(
      createTranslationStatusKey(
        subject.branchId,
        subject.fileId,
        subject.versionId,
        subject.locale
      ),
      id
    );
  }
}

type JobStatuses = Map<string, QueryJobsResponse['results'][number]['status']>;

/** Asks for the status of the running jobs, by job id. Changes nothing. */
export async function fetchForcedJobStatuses(
  forcedJobs: ForcedJobs,
  secrets: Secrets
): Promise<JobStatuses> {
  const jobIds = [...forcedJobs.running.values()];
  if (jobIds.length === 0) return new Map();
  try {
    const { results } = await projectFor(secrets).queryJobs(jobIds);
    return new Map(results.map((job) => [job.id, job.status]));
  } catch (error) {
    // Still unknown: keep waiting and ask again on the next refresh.
    console.error('Error checking translation job status', error);
    return new Map();
  }
}

/**
 * Settles the running jobs that `statuses` reports finished. Returns the keys
 * whose job ended without a result.
 */
export function settleForcedJobs(
  forcedJobs: ForcedJobs,
  statuses: JobStatuses
): string[] {
  const newlyFailed: string[] = [];
  for (const [key, jobId] of forcedJobs.running) {
    const status = statuses.get(jobId);
    if (status === 'completed') {
      forcedJobs.running.delete(key);
    } else if (status === 'failed' || status === 'not_found') {
      forcedJobs.running.delete(key);
      newlyFailed.push(key);
    }
  }
  return newlyFailed;
}
