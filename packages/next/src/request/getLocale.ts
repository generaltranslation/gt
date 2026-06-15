import { use } from '../utils/use';
import { getAsyncConditionStore } from '../condition-store/AsyncCondtionStore';

/**
 * Gets the user's current locale.
 *
 * @returns {Promise<string>} The user's locale, e.g., 'en-US'.
 *
 * @example
 * const locale = await getLocale();
 * console.log(locale); // 'en-US'
 */
export function getLocale(): Promise<string> {
  return getAsyncConditionStore().getLocale();
}

export function useLocale() {
  return use(getLocale());
}
