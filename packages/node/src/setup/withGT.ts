import { getAsyncConditionStore } from '../async-i18n-manager/singleton-operations';

/**
 * This function wraps entry points to provide GT context
 */
export function withGT<T>(locale: string, fn: () => T): T {
  return getAsyncConditionStore().run<T>(locale, fn);
}
