// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@generaltranslation/api';
import type { Secrets } from '../../types';
import { downloadTranslations } from '../downloadTranslations';

const secrets = { secret: 'gtx-api-test', project: 'project-1' } as Secrets;
const file = {
  branchId: 'branch-1',
  fileId: 'doc-1',
  versionId: 'v1',
  locale: 'fr',
};

describe('downloadTranslations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('leaves a rate-limited read to the transport budget and its Retry-After', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ code: 'rate_limited', message: 'Slow down' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '2',
            },
          }
        )
    );
    vi.stubGlobal('fetch', fetch);
    const download = downloadTranslations([file], secrets).catch(
      (error: unknown) => error
    );

    // Each retry waits the 2s the last response asked for.
    await vi.advanceTimersByTimeAsync(5_999);
    expect(fetch).toHaveBeenCalledTimes(3);
    await vi.runAllTimersAsync();

    const error = await download;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429 });
    // The first request and the transport's three retries, nothing more
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});
