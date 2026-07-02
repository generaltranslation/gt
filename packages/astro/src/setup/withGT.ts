import { getAsyncConditionStore } from '../condition-store/singleton-operations';

/**
 * Runs a callback with the given locale, outside of the middleware request
 * scope (e.g. in getStaticPaths or standalone scripts).
 */
export function withGT<T>(locale: string, fn: () => T): T {
  return getAsyncConditionStore().run<T>(locale, fn);
}
