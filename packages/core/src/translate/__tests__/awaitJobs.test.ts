import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { _awaitJobIds } from '../awaitJobs';
import { _checkJobStatus } from '../checkJobStatus';
import { TranslationRequestConfig } from '../../types';

vi.mock('../checkJobStatus');

const mockConfig: TranslationRequestConfig = {
  baseUrl: 'https://api.test.com',
  projectId: 'test-project',
  apiKey: 'test-api-key',
};

describe.sequential('_awaitJobIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return immediately without job IDs', async () => {
    const result = await _awaitJobIds([], undefined, mockConfig);
    expect(result).toEqual({ complete: true, jobs: [] });
    expect(_checkJobStatus).not.toHaveBeenCalled();
  });

  it('should not poll when the timeout is zero', async () => {
    const result = await _awaitJobIds(
      ['job-1'],
      { timeoutSeconds: 0 },
      mockConfig
    );

    expect(result).toEqual({
      complete: false,
      jobs: [{ jobId: 'job-1', status: 'unknown' }],
    });
    expect(_checkJobStatus).not.toHaveBeenCalled();
  });

  it('should accept job IDs directly', async () => {
    vi.mocked(_checkJobStatus).mockResolvedValueOnce([
      { jobId: 'job-1', status: 'completed' },
    ]);

    const result = await _awaitJobIds(['job-1'], undefined, mockConfig);

    expect(result).toEqual({
      complete: true,
      jobs: [{ jobId: 'job-1', status: 'completed' }],
    });
  });

  it('should treat missing job statuses as unknown', async () => {
    vi.mocked(_checkJobStatus).mockResolvedValueOnce([]);

    const result = await _awaitJobIds(['job-1'], undefined, mockConfig);

    expect(result).toEqual({
      complete: true,
      jobs: [{ jobId: 'job-1', status: 'unknown' }],
    });
  });

  it('should resolve when all jobs complete on first poll', async () => {
    vi.mocked(_checkJobStatus).mockResolvedValueOnce([
      { jobId: 'job-1', status: 'completed' },
      { jobId: 'job-2', status: 'completed' },
    ]);

    // Use real timers — first poll resolves immediately with 'completed'
    const result = await _awaitJobIds(
      ['job-1', 'job-2'],
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

    const result = await _awaitJobIds(
      ['job-1'],
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

    const result = await _awaitJobIds(
      ['job-1'],
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

    const result = await _awaitJobIds(
      ['job-1'],
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

    const result = await _awaitJobIds(
      ['job-1', 'job-2'],
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

    const promise = _awaitJobIds(
      ['job-1'],
      { pollingIntervalSeconds: 1, timeoutSeconds: 3 },
      mockConfig
    );

    await vi.advanceTimersByTimeAsync(3000);
    const result = await promise;

    expect(result.complete).toBe(false);
    expect(result.jobs).toEqual([{ jobId: 'job-1', status: 'processing' }]);
    expect(_checkJobStatus).toHaveBeenCalledTimes(3);
    expect(
      vi
        .mocked(_checkJobStatus)
        .mock.calls.map(([, , requestTimeout]) => requestTimeout)
    ).toEqual([3000, 2000, 1000]);

    vi.useRealTimers();
  });

  it('should clamp the polling interval to the remaining timeout', async () => {
    vi.useFakeTimers();

    vi.mocked(_checkJobStatus).mockResolvedValue([
      { jobId: 'job-1', status: 'processing' },
    ]);

    const promise = _awaitJobIds(
      ['job-1'],
      { pollingIntervalSeconds: 5, timeoutSeconds: 3 },
      mockConfig
    );

    await vi.advanceTimersByTimeAsync(3000);
    const result = await promise;

    expect(result.complete).toBe(false);
    expect(_checkJobStatus).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('should ignore a completion returned at the deadline', async () => {
    vi.useFakeTimers();

    vi.mocked(_checkJobStatus).mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve([{ jobId: 'job-1', status: 'completed' }]),
            3000
          )
        )
    );

    const promise = _awaitJobIds(
      ['job-1'],
      { pollingIntervalSeconds: 1, timeoutSeconds: 3 },
      mockConfig
    );

    await vi.advanceTimersByTimeAsync(3000);
    const result = await promise;

    expect(result).toEqual({
      complete: false,
      jobs: [{ jobId: 'job-1', status: 'unknown' }],
    });
    expect(_checkJobStatus).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('should use default polling interval of 5 seconds', async () => {
    // Verify via fake timers that polling waits 5s between polls
    vi.useFakeTimers();

    vi.mocked(_checkJobStatus)
      .mockResolvedValueOnce([{ jobId: 'job-1', status: 'processing' }])
      .mockResolvedValueOnce([{ jobId: 'job-1', status: 'completed' }]);

    const promise = _awaitJobIds(
      ['job-1'],
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
    const promise = _awaitJobIds(
      ['job-1'],
      { pollingIntervalSeconds: 0.01 },
      mockConfig
    ).catch((err: Error) => err);

    const result = await promise;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('Network error');
  });
});
