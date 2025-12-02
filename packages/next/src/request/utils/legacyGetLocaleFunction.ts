import { GT } from 'generaltranslation';
import { RequestFunctionReturnType } from '../types';
import { legacyGetRequestFunction } from './legacyGetRequestFunction';
import isSSR from './isSSR';
import I18NConfiguration from '../../config-dir/I18NConfiguration';

let getLocaleFunction: () => Promise<RequestFunctionReturnType>;
let getStaticLocaleFunction: () => Promise<RequestFunctionReturnType>;

/**
 * @deprecated
 */
export function legacyGetLocaleFunction(
  I18NConfig: I18NConfiguration,
  gt: GT
): () => Promise<string> {
  // Construct getLocale function
  getLocaleFunction = legacyGetRequestFunction('getLocale', true);
  getStaticLocaleFunction = legacyGetRequestFunction('getLocale', false);

  // Construct locale function
  return async () => {
    // Always fallback to default locale
    const locale = isSSR()
      ? await getLocaleFunction()
      : await getStaticLocaleFunction();
    return gt.resolveAliasLocale(locale || I18NConfig.getDefaultLocale());
  };
}
