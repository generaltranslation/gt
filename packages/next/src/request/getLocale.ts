import getI18NConfig from '../config-dir/getI18NConfig';
import use from '../utils/use';
import { legacyGetLocaleFunction } from './utils/legacyGetLocaleFunction';
import { getRequestFunction } from './utils/getRequestFunction';

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
  const I18NConfig = getI18NConfig();
  const gt = I18NConfig.getGTClass();

  if (process.env._GENERALTRANSLATION_ENABLE_SSG === 'false') {
    const requestFunction = getRequestFunction('getLocale');
    // Support new behavior
    getLocaleFunction = async () => {
      const requestLocale = await requestFunction();
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
