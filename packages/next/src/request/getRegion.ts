import { use } from '../utils/use';
import { getAsyncConditionStore } from '../condition-store/AsyncConditionStore';
import { ensureGTServerInitialized } from '../setup/ensureGTServerInitialized';

/**
 * Gets the user's current region code.
 *
 * @returns {Promise<string | undefined>} The user's region code (e.g., 'US', 'CA'), or `undefined` if not set.
 *
 * @example
 * const region = await getRegion();
 * console.log(region); // 'US' or undefined
 */
export function getRegion(): Promise<string | undefined> {
  ensureGTServerInitialized();
  return getAsyncConditionStore().getRegion();
}

export function useRegion() {
  return use(getRegion());
}
