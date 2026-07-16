import {
  useInternalRegionSelector,
  useSetLocale,
  useSetRegion,
} from '@generaltranslation/react-core/hooks';
import type { InternalRegionSelectorOptions } from '@generaltranslation/react-core/hooks';

/**
 * Gets the list of properties for using a region selector.
 * Provides region management utilities for the application.
 *
 * @param {Object} [options] - Optional configuration object.
 * @param {string[]} [options.regions] - An optional array of ISO 3166 region codes to display. If not provided, regions are inferred from supported locales.
 * @param {Object} [options.customMapping] - Optional mapping to override region display names, emojis, or associated locales.
 * @param {boolean} [options.prioritizeCurrentLocaleRegion=true] - If true, the region corresponding to the current locale is prioritized in the list.
 * @param {boolean} [options.sortRegionsAlphabetically=true] - If true, regions are sorted alphabetically by display name.
 *
 * @returns {Object} An object containing region-related utilities:
 * @returns {string | undefined} return.region - The currently selected region code.
 * @returns {function} return.setRegion - Function to update the current region.
 * @returns {string[]} return.regions - The ordered list of available region codes.
 * @returns {Map<string, RegionData>} return.regionData - Map of region codes to their display data (name, emoji, locale).
 * @returns {string} return.locale - The current locale.
 * @returns {function} return.setLocale - Function to update the current locale.
 */
export function useRegionSelector(options?: InternalRegionSelectorOptions) {
  const setRegion = useSetRegion();
  const setLocale = useSetLocale();
  return { setRegion, setLocale, ...useInternalRegionSelector(options) };
}
