import getI18NConfig from '../config-dir/getI18NConfig';
import use from '../utils/use';
import { RequestFunctionReturnType } from './types';
import { getRequestFunction } from './utils/getRequestFunction';
import isSSR from './utils/isSSR';

let getLocaleFunction: () => Promise<RequestFunctionReturnType>;
let getStaticLocaleFunction: () => Promise<RequestFunctionReturnType>;
let getLocaleFunctionWrapper: () => Promise<string>;

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
  if (getLocaleFunctionWrapper) return await getLocaleFunctionWrapper();
  const I18NConfig = getI18NConfig();
  const gt = I18NConfig.getGTClass();

  // Construct getLocale function
  getLocaleFunction = getRequestFunction('getLocale', true);
  getStaticLocaleFunction = getRequestFunction('getLocale', false);

  // Construct locale function
  getLocaleFunctionWrapper = async () => {
    // Always fallback to default locale
    const locale = isSSR()
      ? await getLocaleFunction()
      : await getStaticLocaleFunction();
    return gt.resolveAliasLocale(locale || I18NConfig.getDefaultLocale());
  };

  return getLocaleFunctionWrapper();
}

export function useLocale() {
  return use(getLocale());
}
