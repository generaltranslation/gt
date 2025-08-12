import { intlCache } from '../cache/IntlCache';
import { libraryDefaultLocale } from '../internal';
import { defaultEmoji, emojis } from './getLocaleEmoji';
import { _standardizeLocale } from './isValidLocale';

export type CustomRegionMapping = {
  [region: string]: { name?: string; emoji?: string; locale?: string };
};

/**
 * Retrieves multiple properties for a given region code, including:
 * - `code`: the original region code
 * - `name`: the localized display name
 * - `emoji`: the associated flag or symbol
 *
 * Behavior:
 * - Accepts ISO 3166-1 alpha-2 or UN M.49 region codes (e.g., `"US"`, `"FR"`, `"419"`).
 * - If `customMapping` contains a `name` or `emoji` for the region, those override the default values.
 * - Otherwise, uses `Intl.DisplayNames` to get the localized region name in the given `defaultLocale`,
 *   falling back to `libraryDefaultLocale`.
 * - Falls back to the region code as `name` if display name resolution fails.
 * - Falls back to `defaultEmoji` if no emoji mapping is found in `emojis` or `customMapping`.
 *
 * @param {string} region - The region code to look up (e.g., `"US"`, `"GB"`, `"DE"`).
 * @param {string} [defaultLocale=libraryDefaultLocale] - The locale to use when localizing the region name.
 * @param {CustomRegionMapping} [customMapping] - Optional mapping of region codes to custom names and/or emojis.
 * @returns {{ code: string, name: string, emoji: string }} An object containing:
 *  - `code`: the input region code
 *  - `name`: the localized or custom region name
 *  - `emoji`: the matching emoji flag or symbol
 * @internal
 *
 * @example
 * _getRegionProperties('US', 'en');
 * // => { code: 'US', name: 'United States', emoji: '🇺🇸' }
 *
 * @example
 * _getRegionProperties('US', 'fr');
 * // => { code: 'US', name: 'États-Unis', emoji: '🇺🇸' }
 *
 * @example
 * _getRegionProperties('US', 'en', { US: { name: 'USA', emoji: '🗽' } });
 * // => { code: 'US', name: 'USA', emoji: '🗽' }
 */
export function _getRegionProperties(
  region: string,
  defaultLocale: string = libraryDefaultLocale,
  customMapping?: CustomRegionMapping
): {
  code: string;
  name: string;
  emoji: string;
  locale?: string; // locale is a hidden return field, because we don't want to guarantee it, but we also need customMapping to work with it
} {
  defaultLocale ||= libraryDefaultLocale;
  try {
    const displayNames = intlCache.get(
      'DisplayNames',
      [defaultLocale, libraryDefaultLocale], // default language order
      { type: 'region' }
    );
    return {
      code: region,
      name: displayNames.of(region) || region,
      emoji: emojis[region] || defaultEmoji,
      ...customMapping?.[region],
    };
  } catch {
    return {
      code: region,
      name: region,
      emoji: defaultEmoji,
      ...customMapping?.[region],
    };
  }
}
