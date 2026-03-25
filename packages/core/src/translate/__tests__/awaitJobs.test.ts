import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import _awaitJobs from '../awaitJobs';
import { _checkJobStatus } from '../checkJobStatus';
import { TranslationRequestConfig } from '../../types';
import { EnqueueFilesResult } from '../../types-dir/api/enqueueFiles';

vi.mock('../checkJobStatus');

const mockConfig: TranslationRequestConfig = {
  baseUrl: 'https://api.test.com',
  projectId: 'test-project',
  apiKey: 'test-api-key',
};

function makeEnqueueResult(jobIds: string[]): EnqueueFilesResult {
  const jobData: EnqueueFilesResult['jobData'] = {};
  for (const jobId of jobIds) {
    jobData[jobId] = {
      sourceFileId: 'src-1',
      fileId: 'file-1',
      versionId: 'v-1',
      branchId: 'branch-1',
      targetLocale: 'es',
      projectId: 'test-project',
      force: false,
    };
  }
  return { jobData, locales: ['es'], message: 'ok' };
}

describe.sequential('_awaitJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return immediately for empty jobData', async () => {
    const result = await _awaitJobs(
      { jobData: {}, locales: [], message: 'ok' },
      undefined,
      mockConfig
    );
    expect(result).toEqual({ complete: true, jobs: [] });
    expect(_checkJobStatus).not.toHaveBeenCalled();
  });

  it('should resolve when all jobs complete on first poll', async () => {
    vi.mocked(_checkJobStatus).mockResolvedValueOnce([
      { jobId: 'job-1', status: 'completed' },
      { jobId: 'job-2', status: 'completed' },
    ]);

    // Use real timers — first poll resolves immediately with 'completed'
    const result = await _awaitJobs(
      makeEnqueueResult(['job-1', 'job-2']),
      { pollingIntervalSeconds: 0.01 },
      mockConfig
    );

    expect(result.complete).toBe(true);
    expect(result.jobs).toHaveLength(2);
    expect(result.jobs.every((j) => j.status === 'completed')).toBe(true);
    expect(_checkJobStatus).toHaveBeenCalledTimes(1);
  });

  it('should poll until jobs complete', async () => {
    vi.mocked(_checkJobStatus)
      .mockResolvedValueOnce([{ jobId: 'job-1', status: 'processing' }])
      .mockResolvedValueOnce([{ jobId: 'job-1', status: 'completed' }]);

    const result = await _awaitJobs(
      makeEnqueueResult(['job-1']),
      { pollingIntervalSeconds: 0.01 },
      mockConfig
    );

    expect(result.complete).toBe(true);
    expect(result.jobs).toEqual([{ jobId: 'job-1', status: 'completed' }]);
    expect(_checkJobStatus).toHaveBeenCalledTimes(2);
  });

  it('should handle failed jobs as terminal', async () => {
    vi.mocked(_checkJobStatus).mockResolvedValueOnce([
      {
        jobId: 'job-1',
        status: 'failed',
        error: { message: 'Translation failed' },
      },
    ]);

    const result = await _awaitJobs(
      makeEnqueueResult(['job-1']),
      { pollingIntervalSeconds: 0.01 },
      mockConfig
    );

    expect(result.complete).toBe(true);
    expect(result.jobs).toEqual([
      {
        jobId: 'job-1',
        status: 'failed',
        error: { message: 'Translation failed' },
      },
    ]);
  });

  it('should handle unknown jobs as terminal', async () => {
    vi.mocked(_checkJobStatus).mockResolvedValueOnce([
      { jobId: 'job-1', status: 'unknown' },
    ]);

    const result = await _awaitJobs(
      makeEnqueueResult(['job-1']),
      { pollingIntervalSeconds: 0.01 },
      mockConfig
    );

    expect(result.complete).toBe(true);
    expect(result.jobs).toEqual([{ jobId: 'job-1', status: 'unknown' }]);
  });

  it('should stop polling completed jobs and continue polling pending ones', async () => {
    vi.mocked(_checkJobStatus)
      .mockResolvedValueOnce([
        { jobId: 'job-1', status: 'completed' },
        { jobId: 'job-2', status: 'processing' },
      ])
      .mockResolvedValueOnce([{ jobId: 'job-2', status: 'completed' }]);

    const result = await _awaitJobs(
      makeEnqueueResult(['job-1', 'job-2']),
      { pollingIntervalSeconds: 0.01 },
      mockConfig
    );

    expect(result.complete).toBe(true);
    expect(result.jobs).toHaveLength(2);
    // Second call should only include job-2
    expect(vi.mocked(_checkJobStatus).mock.calls[1][0]).toEqual(['job-2']);
  });

  it('should respect timeout and return incomplete', async () => {
    vi.useFakeTimers();

    // Always return 'processing' so the timeout fires
    vi.mocked(_checkJobStatus).mockResolvedValue([
      { jobId: 'job-1', status: 'processing' },
    ]);

    const promise = _awaitJobs(
      makeEnqueueResult(['job-1']),
      { pollingIntervalSeconds: 1, timeoutSeconds: 3 },
      mockConfig
    );

    await vi.advanceTimersByTimeAsync(3001);
    const result = await promise;

    expect(result.complete).toBe(false);
    expect(result.jobs).toEqual([{ jobId: 'job-1', status: 'processing' }]);

    vi.useRealTimers();
  });

  it('should use default polling interval of 5 seconds', async () => {
    // Verify via fake timers that polling waits 5s between polls
    vi.useFakeTimers();

    vi.mocked(_checkJobStatus)
      .mockResolvedValueOnce([{ jobId: 'job-1', status: 'processing' }])
      .mockResolvedValueOnce([{ jobId: 'job-1', status: 'completed' }]);

    const promise = _awaitJobs(
      makeEnqueueResult(['job-1']),
      undefined, // uses default 5s interval
      mockConfig
    );

    // Flush first poll
    await vi.advanceTimersByTimeAsync(0);
    expect(_checkJobStatus).toHaveBeenCalledTimes(1);

    // 4s: still waiting
    await vi.advanceTimersByTimeAsync(4000);
    expect(_checkJobStatus).toHaveBeenCalledTimes(1);

    // 5s: second poll
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;

    expect(result.complete).toBe(true);
    expect(_checkJobStatus).toHaveBeenCalledTimes(2);
  });

  it('should propagate API errors', async () => {
    vi.mocked(_checkJobStatus).mockRejectedValueOnce(
      new Error('Network error')
    );

    // Attach .catch immediately to prevent unhandled rejection
    const promise = _awaitJobs(
      makeEnqueueResult(['job-1']),
      { pollingIntervalSeconds: 0.01 },
      mockConfig
    ).catch((err: Error) => err);

    const result = await promise;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('Network error');
  });
});
