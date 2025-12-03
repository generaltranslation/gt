import { RequestFunctionReturnType } from '../types';
import { legacyGetRequestFunction } from './legacyGetRequestFunction';
import isSSR from './isSSR';

let getRegionFunction: () => Promise<RequestFunctionReturnType>;
let getStaticRegionFunction: () => Promise<RequestFunctionReturnType>;

/**
 * @deprecated
 */
export function legacyGetRegionFunction(): () => Promise<string | undefined> {
  // Construct getLocale function
  getRegionFunction = legacyGetRequestFunction('getRegion', true);
  getStaticRegionFunction = legacyGetRequestFunction('getRegion', false);

  // Construct locale function
  return async (): Promise<string | undefined> =>
    isSSR() ? await getRegionFunction() : await getStaticRegionFunction();
}
