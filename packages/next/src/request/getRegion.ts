import { getNextRegion } from '../next/getNextRegion';
import use from '../utils/use';

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
  getRegionFunction = async () => {
    const res = await getNextRegion();
    return res;
  };
  return await getRegionFunction();
}
