import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// GTRuntime imports what sends a translation on the first one. These tests
// stand in for the loader: a file that never arrives, and one that fails.

const config = { projectId: 'test-project', apiKey: 'test-api-key' };

async function loadRuntime() {
  const { GTRuntime } = await import('../runtime');
  return new GTRuntime(config);
}

describe('GTRuntime loading the translation client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        Response.json({
          results: [
            {
              status: 'succeeded',
              translation: 'Hola',
              locale: 'es',
              dataFormat: 'STRING',
            },
          ],
        })
      )
    );
  });

  afterEach(() => {
    vi.doUnmock('../translate/runtimeTranslate');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([
    [
      'translate',
      (runtime: Awaited<ReturnType<typeof loadRuntime>>) =>
        runtime.translate('Hello', 'es', 5_000),
    ],
    [
      'translateMany',
      (runtime: Awaited<ReturnType<typeof loadRuntime>>) =>
        runtime.translateMany(['Hello'], 'es', 5_000),
    ],
  ])(
    'rejects %s when the client has not loaded within the timeout',
    async (_name, call) => {
      vi.doMock('../translate/runtimeTranslate', () => new Promise(() => {}));
      const runtime = await loadRuntime();
      vi.useFakeTimers();
      let settled: unknown = 'pending';
      const pending = call(runtime).catch((error: unknown) => {
        settled = error;
      });
      await vi.advanceTimersByTimeAsync(4_999);
      expect(settled).toBe('pending');
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(settled).toBeInstanceOf(Error);
      expect((settled as Error).message).toMatch(
        /The translation client could not be loaded.*timed out after 5000ms/
      );
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it('rejects with the loader error as the cause when the client fails to load, and loads it again on the next call', async () => {
    const loaderError = new Error('Loading chunk 42 failed');
    vi.doMock('../translate/runtimeTranslate', () => {
      throw loaderError;
    });
    const runtime = await loadRuntime();
    const error = await runtime.translate('Hello', 'es', 5_000).then(
      () => undefined,
      (thrown: Error) => thrown
    );
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toMatch(
      /The translation client could not be loaded/
    );
    // The test runner wraps what the factory throws
    const causes: unknown[] = [];
    for (let cause = error?.cause; cause; cause = (cause as Error).cause) {
      causes.push(cause);
    }
    expect(causes).toContain(loaderError);
    expect(fetch).not.toHaveBeenCalled();

    // Each call imports again, so a loader that retries recovers
    vi.doUnmock('../translate/runtimeTranslate');
    await expect(
      runtime.translate('Hello', 'es', 5_000)
    ).resolves.toMatchObject({ success: true, translation: 'Hola' });
  });

  it('does not time out the load of a call without a timeout, or with an infinite one', async () => {
    const runtime = await loadRuntime();
    await expect(runtime.translate('Hello', 'es')).resolves.toMatchObject({
      translation: 'Hola',
    });
    await expect(
      runtime.translate('Hello', 'es', Infinity)
    ).resolves.toMatchObject({ translation: 'Hola' });
  });
});
