import { legacyGetRequestFunction } from './utils/legacyGetRequestFunction';
import isSSR from './utils/isSSR';

let getRegionFunction: () => Promise<string | undefined>;
let getStaticRegionFunction: () => Promise<string | undefined>;
let getRegionFunctionWrapper: () => Promise<string | undefined>;
/**
 * @internal
 *
 * Retrieves the user's current region code from the built-in region cookie.
 *
 * @returns {Promise<string | undefined>} A promise that resolves to the user's region code (e.g., "US", "CA"), or `undefined` if not set.
 *
 * @example
 * const region = await getRegion();
 * console.log(region); // "US" or undefined
 */
export async function getRegion(): Promise<string | undefined> {
  if (getRegionFunctionWrapper) return await getRegionFunctionWrapper();

  getRegionFunction = legacyGetRequestFunction('getRegion', true);
  getStaticRegionFunction = legacyGetRequestFunction('getRegion', false);

  getRegionFunctionWrapper = async () => {
    const region = isSSR()
      ? await getRegionFunction()
      : await getStaticRegionFunction();
    return region;
  };

  return await getRegionFunctionWrapper();
}
