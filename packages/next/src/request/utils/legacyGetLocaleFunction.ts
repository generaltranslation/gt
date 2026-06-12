import { GT } from 'generaltranslation';
import { RequestFunctionReturnType } from '../types';
import { legacyGetRequestFunction } from './legacyGetRequestFunction';
import { isSSR } from './isSSR';
import { I18NConfiguration } from '../../config-dir/I18NConfiguration';
import { getI18nConfig } from 'gt-i18n/internal';

let getLocaleFunction: () => Promise<RequestFunctionReturnType>;
let getStaticLocaleFunction: () => Promise<RequestFunctionReturnType>;

/**
 * @deprecated
 */
export function legacyGetLocaleFunction(): () => Promise<string> {
  // Construct getLocale function
  getLocaleFunction = legacyGetRequestFunction('getLocale', true);
  getStaticLocaleFunction = legacyGetRequestFunction('getLocale', false);

  // Construct locale function
  const i18nConfig = getI18nConfig();
  const defaultLocale = i18nConfig.getDefaultLocale();
  const gtInstance = i18nConfig.getGTClass();
  return async () => {
    // Always fallback to default locale
    const locale = isSSR()
      ? await getLocaleFunction()
      : await getStaticLocaleFunction();
    return gtInstance.resolveAliasLocale(locale || defaultLocale);
  };
}
