import { isReservedOptionKey } from '../translation-functions/reservedKeys';

/**
 * Given an object of options, returns an object with no gt-related options
 * (i.e. only the user interpolation variables).
 *
 * TODO: next major version, this should extract any sugar syntax options
 * TODO: next major version, options should be Record<string, string>
 */
export function extractVariables<T extends Record<string, unknown>>(
  options: T
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(options).filter(([key]) => !isReservedOptionKey(key))
  );
}
