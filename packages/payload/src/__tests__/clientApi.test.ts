// The admin panel's calls to the plugin's endpoints.
import { ApiError, isTransientApiError } from '@generaltranslation/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startRun } from '../client/api';

describe('client api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const startWith = async (status: number, body: object) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(body, { status }))
    );
    return startRun('/api', 'translate', { site: true }, { locales: ['es'] })
      .then(() => undefined)
      .catch((error: unknown) => error);
  };

  it("carries GT's code on a failed request, so a permanent failure is not retried", async () => {
    const error = await startWith(502, {
      error: 'Missing permission',
      code: 'permission_missing',
    });

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      message: 'Missing permission',
      status: 502,
      code: 'permission_missing',
    });
    expect(isTransientApiError(error)).toBe(false);
  });

  it('treats a failure without a code by its status', async () => {
    expect(isTransientApiError(await startWith(502, { error: 'down' }))).toBe(
      true
    );
    expect(
      isTransientApiError(await startWith(401, { error: 'Sign in' }))
    ).toBe(false);
  });
});
