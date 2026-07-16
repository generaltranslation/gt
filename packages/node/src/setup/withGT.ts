import { getAsyncConditionStore } from '../async-i18n-cache/singleton-operations';
import type { AsyncConditionStoreRunParams } from '../async-i18n-cache/AsyncConditionStore';

export type WithGTOptions = AsyncConditionStoreRunParams;

/**
 * This function wraps entry points to provide GT context
 */
export function withGT<T>(conditions: string | WithGTOptions, fn: () => T): T {
  return getAsyncConditionStore().run<T>(conditions, fn);
}
