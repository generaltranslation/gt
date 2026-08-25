import type { Client } from './generated/client';
import { getTranslationJobInfo } from './generated/sdk.gen';
import type { GetTranslationJobInfoResponse } from './generated/types.gen';

const DEFAULT_POLLING_INTERVAL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1_000;

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

export function createJobStatusLoader(client: Client): GetJobStatuses {
  return async (jobIds, signal) => {
    const result = await getTranslationJobInfo({
      body: { jobIds },
      client,
      signal,
      throwOnError: true,
    });
    return result.data;
  };
}

export async function awaitJobs(
  jobIds: readonly string[],
  getJobStatuses: GetJobStatuses,
  options: AwaitJobsOptions = {}
): Promise<AwaitJobsResult> {
  if (jobIds.length === 0) return { complete: true, jobs: [] };

  const pollingInterval =
    (options.pollingIntervalSeconds ?? DEFAULT_POLLING_INTERVAL_MS / 1_000) *
    1_000;
  const timeout =
    (options.timeoutSeconds ?? DEFAULT_TIMEOUT_MS / 1_000) * 1_000;
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
        AbortSignal.timeout(deadline - Date.now())
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
