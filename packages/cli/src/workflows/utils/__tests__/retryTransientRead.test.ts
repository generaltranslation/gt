import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ErrorCode } from 'generaltranslation/api';
import { retryTransientRead } from '../retryTransientRead.js';

describe('retryTransientRead', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const settle = async <T>(promise: Promise<T>) => {
    const result = promise.then(
      (value) => ({ value }),
      (error: unknown) => ({ error })
    );
    await vi.runAllTimersAsync();
    return result;
  };

  it('reads again after a transient failure', async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('Busy', 429, ErrorCode.RATE_LIMITED))
      .mockRejectedValueOnce(new ApiError('Bad gateway', 502))
      .mockResolvedValueOnce('done');

    expect(await settle(retryTransientRead(read))).toEqual({ value: 'done' });
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('throws a permanent failure at once', async () => {
    const error = new ApiError('Expired key', 401, ErrorCode.API_KEY_INVALID);
    const read = vi.fn().mockRejectedValue(error);

    expect(await settle(retryTransientRead(read))).toEqual({ error });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('throws the last transient failure after three retries', async () => {
    const error = new ApiError('Unavailable', 503, ErrorCode.UNAVAILABLE);
    const read = vi.fn().mockRejectedValue(error);

    expect(await settle(retryTransientRead(read))).toEqual({ error });
    expect(read).toHaveBeenCalledTimes(4);
  });
});
