import type { Secrets } from '../types';
import { api, overrideConfig } from '../adapter/core';
import { createTranslationStatusKey } from '../utils/documentIds';
import type { createJobs } from './createJobs';

/**
 * Forced runs whose own result has not arrived, by status key. The status
 * query goes on reporting the translation a forced run replaces as completed,
 * so these keys are ready only once their job is.
 */
export type ForcedJobs = {
  /** Job id of each run still in progress. */
  running: Map<string, string>;
  /** Runs that ended without a result: what is stored is still the old one. */
  failed: Set<string>;
};

export function createForcedJobs(): ForcedJobs {
  return { running: new Map(), failed: new Set() };
}

export function isAwaitingForcedJob(forcedJobs: ForcedJobs, key: string) {
  return forcedJobs.running.has(key) || forcedJobs.failed.has(key);
}

/** Records the jobs of a run over `enqueuedKeys`, replacing earlier ones. */
export function trackEnqueuedJobs(
  forcedJobs: ForcedJobs,
  enqueuedKeys: Iterable<string>,
  enqueueResult: Awaited<ReturnType<typeof createJobs>> | undefined,
  force: boolean
) {
  for (const key of enqueuedKeys) {
    forcedJobs.running.delete(key);
    forcedJobs.failed.delete(key);
  }
  if (!force) return;
  for (const [jobId, job] of Object.entries(enqueueResult?.jobData ?? {})) {
    forcedJobs.running.set(
      createTranslationStatusKey(
        job.branchId,
        job.fileId,
        job.versionId,
        api.resolveAliasLocale(job.targetLocale)
      ),
      jobId
    );
  }
}

type JobStatuses = Map<
  string,
  Awaited<ReturnType<typeof api.checkJobStatus>>[number]['status']
>;

/** Asks for the status of the running jobs, by job id. Changes nothing. */
export async function fetchForcedJobStatuses(
  forcedJobs: ForcedJobs,
  secrets: Secrets
): Promise<JobStatuses> {
  const jobIds = [...forcedJobs.running.values()];
  if (jobIds.length === 0) return new Map();
  overrideConfig(secrets);
  try {
    const statuses = await api.checkJobStatus(jobIds);
    return new Map(statuses.map((job) => [job.jobId, job.status]));
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
    } else if (status === 'failed' || status === 'unknown') {
      forcedJobs.running.delete(key);
      forcedJobs.failed.add(key);
      newlyFailed.push(key);
    }
  }
  return newlyFailed;
}
