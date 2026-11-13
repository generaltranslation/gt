import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAsyncConditionStore } = vi.hoisted(() => ({
  getAsyncConditionStore: vi.fn(),
}));

vi.mock('../../condition-store/AsyncConditionStore', () => ({
  getAsyncConditionStore,
}));

async function importWithReactCache(cache: unknown) {
  vi.doMock('react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react')>()),
    cache,
  }));
  return import('../requestMemo');
}

const renderScopedCache = <A, R>(fn: (arg: A) => R) => {
  const memo = new Map<A, R>();
  return (arg: A) => {
    if (!memo.has(arg)) memo.set(arg, fn(arg));
    return memo.get(arg) as R;
  };
};

describe('memoizeForRequest', () => {
  beforeEach(() => {
    vi.resetModules();
    getAsyncConditionStore.mockReset();
    getAsyncConditionStore.mockReturnValue({
      getRegisteredLocale: () => undefined,
    });
  });

  it('loads on every call when React has no cache', async () => {
    const { memoizeForRequest } = await importWithReactCache(undefined);
    const load = vi.fn(async () => 'fr');

    expect(memoizeForRequest('locale', load)).not.toBe(
      memoizeForRequest('locale', load)
    );
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('defers to the loader when the condition store is unavailable', async () => {
    const { memoizeForRequest } = await importWithReactCache(renderScopedCache);
    getAsyncConditionStore.mockImplementation(() => {
      throw new Error('GT is not initialized');
    });
    const failure = new Error('loader saw the missing store');

    await expect(
      memoizeForRequest('locale', () => Promise.reject(failure))
    ).rejects.toBe(failure);
  });

  it('records a rejection so use() rethrows without suspending', async () => {
    const { memoizeForRequest } = await importWithReactCache(renderScopedCache);
    const failure = new Error('headers() unavailable');

    const promise = memoizeForRequest('locale', () => Promise.reject(failure));
    await expect(promise).rejects.toBe(failure);

    expect(promise).toMatchObject({ status: 'rejected', reason: failure });
    expect(memoizeForRequest('locale', vi.fn())).toBe(promise);
  });
});
