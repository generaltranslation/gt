// @ts-expect-error: resolved by Next aliases or gt-next package exports.
import * as getRegionModule from 'gt-next/internal/_getRegion';
import { cookies } from 'next/headers';
import { defaultRegionCookieName } from '@generaltranslation/react-core/pure';
import { use } from '../utils/use';
import { customGetRegionUnresolvedWarning } from '../errors/createErrors';
import { resolveRequestFunction } from './resolveRequestFunction';

const customGetRegion =
  process.env._GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED === 'true'
    ? resolveRequestFunction<string | undefined>(
        getRegionModule,
        'getRegion',
        customGetRegionUnresolvedWarning
      )
    : undefined;

/**
 * Gets the user's current region code.
 *
 * @returns {Promise<string | undefined>} The user's region code (e.g., 'US', 'CA'), or `undefined` if not set.
 *
 * @example
 * const region = await getRegion();
 * console.log(region); // 'US' or undefined
 */
export async function getRegion(): Promise<string | undefined> {
  if (customGetRegion) return customGetRegion();

  const cookieRegion = (await cookies()).get(defaultRegionCookieName);
  return cookieRegion?.value || undefined;
}

export function useRegion() {
  return use(getRegion());
}
