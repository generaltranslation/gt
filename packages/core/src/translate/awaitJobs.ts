import { TranslationRequestConfig } from '../types';
import { _checkJobStatus, JobStatus } from './checkJobStatus';

export type AwaitJobsOptions = {
  /** Polling interval in seconds. Defaults to 5. */
  pollingIntervalSeconds?: number;
  /** Timeout in seconds. Defaults to 600 (10 minutes). If reached, resolves with whatever status is current. */
  timeoutSeconds?: number;
};

export type JobResult = {
  jobId: string;
  status: JobStatus;
  error?: { message: string };
};

export type AwaitJobsResult = {
  /** Whether all jobs completed (none still in progress). */
  complete: boolean;
  jobs: JobResult[];
};

/**
 * @internal
 * Polls job statuses until all jobs are finished or the timeout is reached.
 * @param jobIds - Job IDs to poll.
 * @param options - Polling configuration.
 * @param config - API credentials and configuration.
 * @returns The final status of all jobs.
 */
export async function _awaitJobIds(
  jobIds: string[],
  options: AwaitJobsOptions | undefined,
  config: TranslationRequestConfig
): Promise<AwaitJobsResult> {
  const pollingInterval = (options?.pollingIntervalSeconds ?? 5) * 1000;
  const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  const timeout =
    options?.timeoutSeconds !== undefined
      ? options.timeoutSeconds * 1000
      : DEFAULT_TIMEOUT_MS;

  if (jobIds.length === 0) {
    return { complete: true, jobs: [] };
  }

  const startTime = Date.now();
  const finalStatuses = new Map<string, JobResult>(
    jobIds.map((id) => [id, { jobId: id, status: 'unknown' as JobStatus }])
  );
  const pendingJobIds = new Set(jobIds);

  while (pendingJobIds.size > 0) {
    const statuses = await _checkJobStatus(Array.from(pendingJobIds), config);
    const returnedJobIds = new Set(statuses.map(({ jobId }) => jobId));

    for (const job of statuses) {
      if (
        job.status === 'completed' ||
        job.status === 'failed' ||
        job.status === 'unknown'
      ) {
        finalStatuses.set(job.jobId, {
          jobId: job.jobId,
          status: job.status,
          ...(job.error ? { error: job.error } : {}),
        });
        pendingJobIds.delete(job.jobId);
      } else {
        finalStatuses.set(job.jobId, {
          jobId: job.jobId,
          status: job.status,
        });
      }
    }

    for (const jobId of Array.from(pendingJobIds)) {
      if (!returnedJobIds.has(jobId)) {
        finalStatuses.set(jobId, { jobId, status: 'unknown' });
        pendingJobIds.delete(jobId);
      }
    }

    if (pendingJobIds.size === 0) break;

    if (Date.now() - startTime >= timeout) break;

    await new Promise((resolve) => setTimeout(resolve, pollingInterval));
  }

  return {
    complete: pendingJobIds.size === 0,
    jobs: Array.from(finalStatuses.values()),
  };
}
