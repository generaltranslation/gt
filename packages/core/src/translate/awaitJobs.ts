import type { JobStatus } from './checkJobStatus';

export type AwaitJobsOptions = {
  /** Polling interval in seconds. Defaults to 5. */
  pollingIntervalSeconds?: number;
  /** Timeout in seconds. Defaults to 600 (10 minutes). */
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
