import getI18NConfig from '../config-dir/getI18NConfig';
import { getNextLocale } from '../next/getNextLocale';

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
export default async function getLocale(): Promise<string> {
  if (getLocaleFunction) return await getLocaleFunction();
  // Try catch is for dynamic imports from gt-next/_request for custom getLocale functions
  if (process.env._GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED === 'true') {
    try {
      const customRequestConfig = require('gt-next/_request');
      const customGetLocale: () => Promise<string> =
        customRequestConfig?.default || customRequestConfig.getLocale;
      const locale = await customGetLocale();
      getLocaleFunction = customGetLocale;
      return locale;
    } catch {
      /* empty */
    }
  }
  const I18NConfig = getI18NConfig();
  getLocaleFunction = async () => {
    const res = await getNextLocale(
      I18NConfig.getDefaultLocale(),
      I18NConfig.getLocales()
    );
    return res;
  };
  return await getLocaleFunction();
}
