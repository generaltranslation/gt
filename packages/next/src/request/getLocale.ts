import getI18NConfig from '../config-dir/getI18NConfig';
import use from '../utils/use';
import { legacyGetLocaleFunction } from './utils/legacyGetLocaleFunction';
import { getRequestFunction } from './utils/getRequestFunction';
import { localeStore } from './localeStore';
import { getRootLocale } from './utils/getRootLocale';

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

  if (process.env._GENERALTRANSLATION_ENABLE_SSG === 'false') {
    const useRootLocaleOnly =
      process.env._GENERALTRANSLATION_EXPERIMENTAL_LOCALE_RESOLUTION === 'true';
    const requestFunction = useRootLocaleOnly
      ? undefined
      : getRequestFunction('getLocale');
    // Support new behavior
    getLocaleFunction = async () => {
      const rootLocale = getRootLocale((locale) => gt.isValidLocale(locale));
      const requestLocale =
        rootLocale || (requestFunction ? await requestFunction() : undefined);
      return gt.resolveAliasLocale(
        requestLocale || I18NConfig.getDefaultLocale()
      );
    };
  } else {
    // Support legacy behavior
    getLocaleFunction = legacyGetLocaleFunction(I18NConfig, gt);
  }

  return getLocaleFunction();
}

export function useLocale() {
  return use(getLocale());
}
