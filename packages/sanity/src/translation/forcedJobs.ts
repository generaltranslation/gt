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

/**
 * Asks for the status of the running jobs and settles the finished ones.
 * Returns the keys whose job ended without a result in this call.
 */
export async function settleForcedJobs(
  forcedJobs: ForcedJobs,
  secrets: Secrets
): Promise<string[]> {
  const running = [...forcedJobs.running];
  if (running.length === 0) return [];
  overrideConfig(secrets);
  let statuses: Awaited<ReturnType<typeof api.checkJobStatus>>;
  try {
    statuses = await api.checkJobStatus(running.map(([, jobId]) => jobId));
  } catch (error) {
    // Still unknown: keep waiting and ask again on the next refresh.
    console.error('Error checking translation job status', error);
    return [];
  }
  const statusByJobId = new Map(statuses.map((job) => [job.jobId, job.status]));
  const newlyFailed: string[] = [];
  for (const [key, jobId] of running) {
    // A newer run may have replaced this job while the request was out.
    if (forcedJobs.running.get(key) !== jobId) continue;
    const status = statusByJobId.get(jobId);
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
