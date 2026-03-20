import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('_awaitJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
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

    const result = await _awaitJobs(
      makeEnqueueResult(['job-1', 'job-2']),
      { pollingIntervalSeconds: 1 },
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

    const promise = _awaitJobs(
      makeEnqueueResult(['job-1']),
      { pollingIntervalSeconds: 1 },
      mockConfig
    );

    // First poll returns processing, then we need to advance the timer
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;

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
      undefined,
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
      undefined,
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

    const promise = _awaitJobs(
      makeEnqueueResult(['job-1', 'job-2']),
      { pollingIntervalSeconds: 1 },
      mockConfig
    );

    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;

    expect(result.complete).toBe(true);
    expect(result.jobs).toHaveLength(2);
    // Second call should only include job-2
    expect(vi.mocked(_checkJobStatus).mock.calls[1][0]).toEqual(['job-2']);
  });

  it('should respect timeout and return incomplete', async () => {
    vi.mocked(_checkJobStatus).mockResolvedValue([
      { jobId: 'job-1', status: 'processing' },
    ]);

    const promise = _awaitJobs(
      makeEnqueueResult(['job-1']),
      { pollingIntervalSeconds: 1, timeoutSeconds: 3 },
      mockConfig
    );

    // Advance past the timeout
    await vi.advanceTimersByTimeAsync(5000);

    const result = await promise;

    expect(result.complete).toBe(false);
    expect(result.jobs).toEqual([{ jobId: 'job-1', status: 'processing' }]);
  });

  it('should use default 5s polling interval', async () => {
    vi.mocked(_checkJobStatus)
      .mockResolvedValueOnce([{ jobId: 'job-1', status: 'processing' }])
      .mockResolvedValueOnce([{ jobId: 'job-1', status: 'completed' }]);

    const promise = _awaitJobs(
      makeEnqueueResult(['job-1']),
      undefined,
      mockConfig
    );

    // Advance less than 5s — should not trigger second poll
    await vi.advanceTimersByTimeAsync(4000);
    expect(_checkJobStatus).toHaveBeenCalledTimes(1);

    // Advance to 5s — should trigger second poll
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;

    expect(result.complete).toBe(true);
    expect(_checkJobStatus).toHaveBeenCalledTimes(2);
  });

  it('should propagate API errors', async () => {
    vi.mocked(_checkJobStatus).mockRejectedValueOnce(
      new Error('Network error')
    );

    await expect(
      _awaitJobs(makeEnqueueResult(['job-1']), undefined, mockConfig)
    ).rejects.toThrow('Network error');
  });
});
