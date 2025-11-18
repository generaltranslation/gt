import getI18NConfig from '../config-dir/getI18NConfig';
import use from '../utils/use';
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

  // Construct locale function
  getLocaleFunction = async () => {
    // Always fallback to default locale
    const locale =
      (await getRequestFunction('getLocale')()) ||
      I18NConfig.getDefaultLocale();
    return gt.resolveAliasLocale(locale);
  };
  return getLocaleFunction();
}

export function useLocale() {
  return use(getLocale());
}
