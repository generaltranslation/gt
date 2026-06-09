import { GT } from 'generaltranslation';
import { RequestFunctionReturnType } from '../types';
import { legacyGetRequestFunction } from './legacyGetRequestFunction';
import { isSSR } from './isSSR';
import { getI18nConfig } from 'gt-i18n/internal';

let getLocaleFunction: () => Promise<RequestFunctionReturnType>;
let getStaticLocaleFunction: () => Promise<RequestFunctionReturnType>;

/**
 * @deprecated
 */
export function legacyGetLocaleFunction(gt: GT): () => Promise<string> {
  // Construct getLocale function
  getLocaleFunction = legacyGetRequestFunction('getLocale', true);
  getStaticLocaleFunction = legacyGetRequestFunction('getLocale', false);

  // Construct locale function
  return async () => {
    // Always fallback to default locale
    const locale = isSSR()
      ? await getLocaleFunction()
      : await getStaticLocaleFunction();
    return gt.resolveAliasLocale(locale || getI18nConfig().getDefaultLocale());
  };
}
