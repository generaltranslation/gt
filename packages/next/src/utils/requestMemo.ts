import * as react from 'react';
import { getAsyncConditionStore } from '../condition-store/AsyncConditionStore';

type TrackedPromise<T> = Promise<T> & {
  status?: 'pending' | 'fulfilled' | 'rejected';
  value?: T;
  reason?: unknown;
};

// Read through a non-static key, like `use` in ./use, so React versions without `cache` still bundle.
const reactCache = react['cache'.trim() as 'cache'] as
  | typeof react.cache
  | undefined;

const createRequestMemo = (_registeredLocale: string | undefined) =>
  new Map<string, Promise<unknown>>();

// React's cache is scoped to one server render and calls through outside a render, so route handlers, server actions and React versions without `cache` load on every call as before.
const getRequestMemo = reactCache
  ? reactCache(createRequestMemo)
  : createRequestMemo;

/**
 * Shares one promise per key for the current server render, keyed by the
 * registered locale so a later registerLocale() starts a fresh memo.
 */
export function memoizeForRequest<T>(
  key: string,
  load: () => Promise<T>
): Promise<T> {
  let registeredLocale: string | undefined;
  try {
    registeredLocale = getAsyncConditionStore().getRegisteredLocale();
  } catch {
    // Let the loader report a missing condition store the way it always has.
    return load();
  }
  const memo = getRequestMemo(registeredLocale);
  let promise = memo.get(key) as Promise<T> | undefined;
  if (!promise) {
    promise = trackSettlement(load());
    memo.set(key, promise);
  }
  return promise;
}

/** Records the settled state the way React's use() reads it, so later use() calls never suspend. */
function trackSettlement<T>(promise: Promise<T>): Promise<T> {
  const tracked = promise as TrackedPromise<T>;
  tracked.status = 'pending';
  tracked.then(
    (value) => {
      tracked.status = 'fulfilled';
      tracked.value = value;
    },
    (reason: unknown) => {
      tracked.status = 'rejected';
      tracked.reason = reason;
    }
  );
  return tracked;
}
