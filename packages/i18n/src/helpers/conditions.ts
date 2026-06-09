import { getWritableConditionStore } from '../condition-store/singleton-operations';

/**
 * Get whether i18n is enabled for the current request
 * @returns Whether i18n is enabled (defaults to true when the condition store does not track it)
 *
 * @example
 * const enableI18n = getEnableI18n();
 * console.log(enableI18n); // true
 */
export function getEnableI18n(): boolean {
  return getWritableConditionStore().getEnableI18n?.() ?? true;
}
