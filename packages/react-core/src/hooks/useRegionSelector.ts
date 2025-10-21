import { useMemo } from 'react';
import useGTContext from '../provider/GTContext';
import { getLocaleProperties } from 'generaltranslation'; //

type RegionData = {
  code: string;
  name: string;
  emoji: string;
  locale: string;
};

/**
 * React hook for managing region selection logic in applications supporting multiple regions.
 *
 * This hook provides the necessary data and handlers to implement a region selector UI component.
 * It returns the current region, a list of available regions, region metadata, and functions to update the region or associated locale.
 *
 * ### Parameters
 * @param {Object} [options] - Optional configuration object.
 * @param {string[]} [options.regions] - An optional array of ISO 3166 region codes to display. If not provided, regions are inferred from supported locales.
 * @param {Object.<string, string|{name?: string, emoji?: string, locale?: string}>} [options.customMapping] - Optional mapping to override region display names, emojis, or associated locales.
 * @param {boolean} [options.prioritizeCurrentLocaleRegion=true] - If true, the region corresponding to the current locale is prioritized in the list.
 * @param {boolean} [options.sortRegionsAlphabetically=true] - If true, regions are sorted alphabetically by display name.
 *
 * ### Returns
 * @returns {{
 *   region: string | undefined,
 *   setRegion: (region: string) => void,
 *   regions: string[],
 *   regionData: Map<string, { code: string, name: string, emoji: string, locale: string }>,
 *   locale: string,
 *   setLocale: (locale: string) => void
 * }} An object containing:
 *   - `region`: The currently selected region code.
 *   - `setRegion`: Function to update the selected region.
 *   - `regions`: Array of available region codes.
 *   - `regionData`: Map of region codes to their display data (name, emoji, locale).
 *   - `locale`: The current locale.
 *   - `setLocale`: Function to update the locale.
 *
 * ### Example
 * ```tsx
 * const {
 *   region,
 *   setRegion,
 *   regions,
 *   regionData,
 *   locale,
 *   setLocale
 * } = useRegionSelector({
 *   customMapping: { US: { name: "United States", emoji: "🇺🇸" } }
 * });
 *
 * return (
 *   <select value={region} onChange={e => setRegion(e.target.value)}>
 *     {regions.map(r => (
 *       <option key={r} value={r}>
 *         {regionData.get(r)?.name}
 *       </option>
 *     ))}
 *   </select>
 * );
 * ```
 */
export function useRegionSelector(
  {
    regions: _regions,
    customMapping,
    prioritizeCurrentLocaleRegion = true,
    sortRegionsAlphabetically = true,
  }: {
    regions?: string[];
    customMapping?: {
      [region: string]:
        | string
        | { name?: string; emoji?: string; locale?: string };
    };
    prioritizeCurrentLocaleRegion?: boolean;
    sortRegionsAlphabetically?: boolean;
  } = {
    prioritizeCurrentLocaleRegion: true,
    sortRegionsAlphabetically: true,
  }
) {
  // Retrieve the locale, locales, and setLocale function
  const { locales, locale, setLocale, gt, region, setRegion } = useGTContext();
  const { regionCode: localeRegion } = gt.getLocaleProperties(locale);

  const [
    regions, // ordered list of ISO 3166 region codes
    regionData, // map of ISO 3166 region codes to region display data, potentially not ordered
  ] = useMemo<[string[], Map<string, RegionData>]>(() => {
    const regionToLocaleMap = new Map(
      locales.map((l) => {
        const lp = getLocaleProperties(l, locale, gt.customMapping); // has to be directly called so sourceLocale can be in the user's current locale
        return [lp.regionCode, lp];
      })
    );

    const regions = _regions
      ? [..._regions]
      : Array.from(regionToLocaleMap?.keys() || [localeRegion]);

    const regionData = new Map<string, RegionData>(
      regions.map((r: string) => {
        return [
          r,
          {
            locale: regionToLocaleMap?.get(r)?.code || locale,
            ...gt.getRegionProperties(r),
            ...(typeof customMapping?.[r] === 'string'
              ? { name: customMapping?.[r] }
              : customMapping?.[r]),
          },
        ];
      })
    );

    if (sortRegionsAlphabetically) {
      regions.sort((a, b) =>
        new Intl.Collator().compare(
          regionData.get(a)!.name,
          regionData.get(b)!.name
        )
      );
    }

    if (prioritizeCurrentLocaleRegion) {
      const localeRegionIndex = regions.indexOf(localeRegion);
      if (localeRegionIndex > 0) {
        // 0 because no action is needed if it's already at the start
        regions.splice(localeRegionIndex, 1);
        regions.unshift(localeRegion);
      }
    }

    return [regions, regionData];
  }, [_regions, region, locale, locales, gt]);

  return {
    region,
    setRegion,
    regions,
    regionData,
    locales,
    locale,
    localeRegion,
    setLocale,
  };
}
