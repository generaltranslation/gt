import type { Client } from '../generated/client';
import { queryJobs } from '../generated/sdk.gen';
import type { QueryJobsResponse } from '../generated/types.gen';
import { createBatches, processBatches } from './batch';
import { API_VERSION } from './client';
// Per-poll cap so a hung connection fails fast instead of eating the whole deadline.
import { DEFAULT_TIMEOUT_MS as MAX_POLL_TIMEOUT_MS } from './transport';

const DEFAULT_POLLING_INTERVAL_SECONDS = 5;
const DEFAULT_TIMEOUT_SECONDS = 600;

export type JobResult = QueryJobsResponse['results'][number];
/** Client-side status for a job not polled before the deadline; the API never returns it. */
export type UnpolledJobResult = { id: string; status: 'unknown' };

export type AwaitJobsOptions = {
  pollingIntervalSeconds?: number;
  timeoutSeconds?: number;
  onPoll?: (statuses: JobResult[]) => void;
};

export type AwaitJobsResult = {
  complete: boolean;
  jobs: Array<JobResult | UnpolledJobResult>;
};

async function queryJobsBatch(
  client: Client,
  projectId: string,
  jobIds: string[],
  signal?: AbortSignal
): Promise<JobResult[]> {
  const result = await queryJobs({
    body: { jobs: jobIds.map((id) => ({ id })) },
    client,
    headers: { 'gt-api-version': API_VERSION },
    path: { projectId },
    signal,
    throwOnError: true,
  });
  return result.data.results;
}

/**
 * Reads job statuses through `queryJobs` in batches the server accepts.
 * Results follow `jobIds` order. Repeated IDs are rejected by the server.
 */
export async function queryJobsInBatches(
  client: Client,
  projectId: string,
  jobIds: readonly string[],
  signal?: AbortSignal
): Promise<JobResult[]> {
  return processBatches(jobIds, (batch) =>
    queryJobsBatch(client, projectId, batch, signal)
  );
}

/** Polls with the pinned `API_VERSION`, whatever the client's `apiVersion`, because `queryJobs` exists only on that version. */
export async function awaitJobs(
  client: Client,
  projectId: string,
  jobIds: readonly string[],
  options: AwaitJobsOptions = {}
): Promise<AwaitJobsResult> {
  if (jobIds.length === 0) return { complete: true, jobs: [] };

  const pollingInterval =
    (options.pollingIntervalSeconds ?? DEFAULT_POLLING_INTERVAL_SECONDS) *
    1_000;
  const timeout = (options.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS) * 1_000;
  const deadline = Date.now() + timeout;
  const finalStatuses = new Map<string, JobResult | UnpolledJobResult>(
    jobIds.map((id) => [id, { id, status: 'unknown' }])
  );
  const pendingJobIds = new Set(jobIds);
  const recordStatuses = (statuses: JobResult[]) => {
    for (const job of statuses) {
      finalStatuses.set(job.id, job);
      if (
        job.status === 'completed' ||
        job.status === 'failed' ||
        job.status === 'not_found'
      ) {
        pendingJobIds.delete(job.id);
      }
    }
  };

  while (pendingJobIds.size > 0 && Date.now() < deadline) {
    const signal = AbortSignal.timeout(
      Math.min(deadline - Date.now(), MAX_POLL_TIMEOUT_MS)
    );
    const loads = await Promise.allSettled(
      createBatches([...pendingJobIds]).map((batch) =>
        // A batch that settles after the deadline keeps its jobs' last known statuses; other errors throw.
        queryJobsBatch(client, projectId, batch, signal).then(
          (statuses) => (Date.now() >= deadline ? [] : statuses),
          (error: unknown) => {
            if (signal.aborted && Date.now() >= deadline) return [];
            throw error;
          }
        )
      )
    );
    const statuses = loads.flatMap((load) => {
      if (load.status === 'rejected') throw load.reason;
      return load.value;
    });
    if (Date.now() >= deadline) {
      options.onPoll?.(statuses);
      recordStatuses(statuses);
      break;
    }

    const returnedJobIds = new Set(statuses.map(({ id }) => id));
    const missingJobIds = [...pendingJobIds].filter(
      (id) => !returnedJobIds.has(id)
    );
    if (missingJobIds.length > 0) {
      throw new Error(
        `Job status response has no result for job IDs: ${missingJobIds.join(', ')}`
      );
    }

    options.onPoll?.(statuses);
    recordStatuses(statuses);

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
