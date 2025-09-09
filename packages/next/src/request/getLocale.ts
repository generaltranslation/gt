import getI18NConfig from '../config-dir/getI18NConfig';
import { getNextLocale } from '../next/getNextLocale';
import use from '../utils/use';

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
  if (getLocaleFunction) return await getLocaleFunction();
  // Try catch is for dynamic imports from gt-next/_request for custom getLocale functions
  const I18NConfig = getI18NConfig();
  const gt = I18NConfig.getGTClass();
  if (process.env._GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED === 'true') {
    try {
      const customRequestConfig = require('gt-next/_request');
      const customGetLocale: () => Promise<string> =
        customRequestConfig?.default?.getLocale ||
        customRequestConfig?.default ||
        customRequestConfig.getLocale;
      const locale = gt.resolveAliasLocale(await customGetLocale());
      getLocaleFunction = async () => {
        const preferredLocale = await customGetLocale();
        const result = await getNextLocale(
          I18NConfig.getDefaultLocale(),
          I18NConfig.getLocales(),
          preferredLocale
        );
        return gt.resolveAliasLocale(result);
      };
      return locale;
    } catch {
      /* empty */
    }
  }
  getLocaleFunction = async () => {
    const res = await getNextLocale(
      I18NConfig.getDefaultLocale(),
      I18NConfig.getLocales()
    );
    return gt.resolveAliasLocale(res);
  };
  return await getLocaleFunction();
}

export function useLocale() {
  return use(getLocale());
}
