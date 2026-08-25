import type { GetTranslationJobInfoResponse } from './generated/types.gen';
// Per-poll cap so a hung connection fails fast instead of eating the whole deadline.
import { DEFAULT_TIMEOUT_MS as MAX_POLL_TIMEOUT_MS } from './transport';

export type JobResult = GetTranslationJobInfoResponse[number];
export type GetJobStatuses = (
  jobIds: string[],
  signal: AbortSignal
) => Promise<GetTranslationJobInfoResponse>;

export type AwaitJobsOptions = {
  pollingIntervalSeconds?: number;
  timeoutSeconds?: number;
};

export type AwaitJobsResult = {
  complete: boolean;
  jobs: JobResult[];
};

export async function awaitJobs(
  jobIds: readonly string[],
  getJobStatuses: GetJobStatuses,
  options: AwaitJobsOptions = {}
): Promise<AwaitJobsResult> {
  if (jobIds.length === 0) return { complete: true, jobs: [] };

  const pollingInterval = (options.pollingIntervalSeconds ?? 5) * 1_000;
  const timeout = (options.timeoutSeconds ?? 600) * 1_000;
  const deadline = Date.now() + timeout;
  const finalStatuses = new Map<string, JobResult>(
    jobIds.map((jobId) => [jobId, { jobId, status: 'unknown' }])
  );
  const pendingJobIds = new Set(jobIds);

  while (pendingJobIds.size > 0 && Date.now() < deadline) {
    let statuses: GetTranslationJobInfoResponse;
    try {
      statuses = await getJobStatuses(
        [...pendingJobIds],
        AbortSignal.timeout(
          Math.min(deadline - Date.now(), MAX_POLL_TIMEOUT_MS)
        )
      );
    } catch (error) {
      if (Date.now() >= deadline) break;
      throw error;
    }
    if (Date.now() >= deadline) break;

    const returnedJobIds = new Set(statuses.map(({ jobId }) => jobId));

    for (const job of statuses) {
      finalStatuses.set(job.jobId, job);
      if (
        job.status === 'completed' ||
        job.status === 'failed' ||
        job.status === 'unknown'
      ) {
        pendingJobIds.delete(job.jobId);
      }
    }

    for (const jobId of pendingJobIds) {
      if (!returnedJobIds.has(jobId)) {
        finalStatuses.set(jobId, { jobId, status: 'unknown' });
        pendingJobIds.delete(jobId);
      }
    }

    if (pendingJobIds.size > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(pollingInterval, deadline - Date.now()))
      );
    }
  }

  return {
    complete: pendingJobIds.size === 0,
    jobs: [...finalStatuses.values()],
  };
}
