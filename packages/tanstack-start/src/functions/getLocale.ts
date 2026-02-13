import { determineLocale } from './determineLocale';

/**
 * Returns the user's current locale.
 * @returns {string} The user's current locale.
 */
export function getLocale(): string {
  console.log(
    `[getLocale](${typeof process !== 'undefined' ? 'server' : 'client'})`
  );
  return determineLocale();
}
