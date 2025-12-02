import { getRequestFunction } from './utils/getRequestFunction';
import { legacyGetRegionFunction } from './utils/legacyGetRegionFunction';

let getRegionFunction: () => Promise<string | undefined>;
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
  if (getRegionFunction) return await getRegionFunction();

  if (process.env._GENERALTRANSLATION_ENABLE_SSG === 'false') {
    // Support new behavior
    getRegionFunction = getRequestFunction('getRegion');
  } else {
    // Support legacy behavior
    getRegionFunction = legacyGetRegionFunction();
  }

  return await getRegionFunction();
}
