import React, { ReactNode, useEffect, useMemo } from 'react';
import { useRegionSelector } from '../hooks/useRegionSelector';

type RegionData = {
  code: string;
  name: string;
  locale: string;
};

/**
<<<<<<< HEAD
 * A multi-purpose dropdown component that allows users to select a region.
=======
 * A dropdown component that allows users to select a region.
 *
 * @param {string[]} [regions] - An optional array of ISO 3166 region codes to display. If not provided, regions are inferred from supported locales in the `<GTProvider>` context.
 * @param {React.ReactNode} [placeholder] - Optional placeholder node to display as the first option when no region is selected.
 * @param {object} [customMapping] - An optional object to map region codes to custom display names, emojis, or associated locales. The value can be a string (display name) or an object with `name`, `emoji`, and/or `locale` properties.
 * @param {boolean} [prioritizeCurrentLocaleRegion] - If true, the region corresponding to the current locale is prioritized in the list.
 * @param {boolean} [sortRegionsAlphabetically] - If true, regions are sorted alphabetically by display name.
 * @param {boolean} [asLocaleSelector=false] - If true, selecting a region will also update the locale to the region's associated locale.
 * @param {object} [props] - Additional props to pass to the underlying `<select>` element.
 * @returns {React.JSX.Element | null} The rendered region dropdown component or null if no regions are available.
 *
 * @example
 * ```tsx
 * <RegionSelector
 *   regions={['US', 'CA']}
 *   customMapping={{ US: { name: "United States", emoji: "🇺🇸" } }}
 *   placeholder="Select a region"
 * />
 * ```
>>>>>>> a/t
 */
export default function RegionSelector<Regions extends string[]>({
  regions: _regions,
  placeholder,
  customMapping,
  prioritizeCurrentLocaleRegion,
  sortRegionsAlphabetically,
  asLocaleSelector = false,
  ...props
}: {
  regions?: Regions;
  placeholder?: ReactNode;
  customMapping?: {
    [region: string]:
      | string
      | { name?: string; locale?: string; emoji?: string };
  };
  prioritizeCurrentLocaleRegion?: boolean;
  sortRegionsAlphabetically?: boolean;
  asLocaleSelector?: boolean;
  [key: string]: any;
}): React.JSX.Element | null {
<<<<<<< HEAD
  const {
    region,
    setRegion,
    regions,
    regionData,
    locale,
    setLocale,
    localeRegion,
  } = useRegionSelector({
    regions: _regions,
    customMapping,
    prioritizeCurrentLocaleRegion,
    sortRegionsAlphabetically,
  });
=======
  const { region, setRegion, regions, regionData, locale, setLocale } =
    useRegionSelector({
      regions: _regions,
      customMapping,
      prioritizeCurrentLocaleRegion,
      sortRegionsAlphabetically,
    });
>>>>>>> a/t

  const changeRegion = (region: Regions[number]) => {
    setRegion(region);
    if (asLocaleSelector) {
      const regionLocale = regionData.get(region)!.locale;
      if (locale !== regionLocale) setLocale(regionLocale);
    }
  };

  return (
    <select
      {...props}
      value={region || ''}
      onChange={(e) => changeRegion(e.target.value)}
    >
      {!region && (
        <option
          key={'placeholder'}
          value={''}
          disabled={Boolean(region)}
          hidden={Boolean(region)}
          suppressHydrationWarning
        >
          {placeholder || ''}
        </option>
      )}
      {regions.map((r) => (
        <option key={r} value={r} suppressHydrationWarning>
          {regionData.get(r)!.name}
        </option>
      ))}
    </select>
  );
}
