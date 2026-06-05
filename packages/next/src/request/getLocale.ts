import { getI18NConfig } from '../config-dir/getI18NConfig';
import { use } from '../utils/use';
import { getRequestFunction } from './utils/getRequestFunction';
import { localeStore } from './localeStore';

let getLocaleFunction: () => Promise<string>;

/**
 * Gets the user's current locale.
 *
 * @returns {Promise<string>} The user's locale, e.g., 'en-US'.
 *
 * @example
 * const locale = await getLocale();
 * console.log(locale); // 'en-US'
 */
export async function getLocale(): Promise<string> {
  // If a locale has been registered for this request, return it
  const registeredLocale = localeStore.getStore();
  if (registeredLocale) return registeredLocale;

  // Use the request function to get the locale
  if (getLocaleFunction) return await getLocaleFunction();
  const I18NConfig = getI18NConfig();
  const gt = I18NConfig.getGTClass();

  const requestFunction = getRequestFunction('getLocale');
  getLocaleFunction = async () => {
    const requestLocale = await requestFunction();
    return gt.resolveAliasLocale(
      requestLocale || I18NConfig.getDefaultLocale()
    );
  };

  return getLocaleFunction();
}

export function useLocale() {
  return use(getLocale());
}
