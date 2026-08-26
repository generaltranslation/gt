import { getLocale } from './runtime';

/**
 * Resolve the user's locale for the current TanStack Start request or browser.
 *
 * @deprecated Use `getLocale()` instead.
 */
export function parseLocale(): string {
  return getLocale();
}
