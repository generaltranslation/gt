import { use } from '../utils/use';
import { getAsyncConditionStore } from '../condition-store/AsyncConditionStore';

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

/**
 * Whether this render has a request to take the locale from: false when
 * Next.js renders a page statically with the default getLocale.
 */
export function hasRequestLocale(): Promise<boolean> {
  return getAsyncConditionStore().hasRequestLocale();
}

export function useLocale() {
  return use(getLocale());
}
