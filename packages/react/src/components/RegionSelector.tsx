import type React from 'react';
import type { ReactNode } from 'react';
import { InternalRegionSelector } from '@generaltranslation/react-core/components';
import { useRegionSelector } from './useRegionSelector';

/**
 * A dropdown component that allows users to select a region.
 * @param {string[]} [regions] - An optional array of ISO 3166 region codes to display. If not provided, regions are inferred from the supported locales in the `<GTProvider>` context.
 * @param {React.ReactNode} [placeholder] - Optional placeholder node to display as the first option when no region is selected.
 * @param {object} [customMapping] - An optional object to map region codes to custom display names, emojis, or associated locales.
 * @param {boolean} [prioritizeCurrentLocaleRegion] - If true, the region corresponding to the current locale is prioritized in the list.
 * @param {boolean} [sortRegionsAlphabetically] - If true, regions are sorted alphabetically by display name.
 * @param {boolean} [asLocaleSelector=false] - If true, selecting a region will also update the locale to the region's associated locale.
 * @returns {React.ReactElement | null} The rendered region dropdown component or null to prevent rendering.
 *
 * @example
 * ```tsx
 * <RegionSelector
 *   regions={['US', 'CA']}
 *   customMapping={{ US: { name: "United States", emoji: "🇺🇸" } }}
 *   placeholder="Select a region"
 * />
 * ```
 */
export function RegionSelector({
  regions: _regions,
  customMapping,
  prioritizeCurrentLocaleRegion,
  sortRegionsAlphabetically,
  asLocaleSelector = false,
  ...props
}: RegionSelectorProps): React.JSX.Element | null {
  // Get region selector properties
  const { region, regions, regionData, locale, setRegion, setLocale } =
    useRegionSelector({
      regions: _regions,
      customMapping,
      prioritizeCurrentLocaleRegion,
      sortRegionsAlphabetically,
    });

  const changeRegion = (region: string) => {
    if (asLocaleSelector) {
      const regionLocale = regionData.get(region)?.locale;
      // setRegion reloads the page; update the locale cookie first
      if (regionLocale && locale !== regionLocale) setLocale(regionLocale);
    }
    setRegion(region);
  };

  return (
    <InternalRegionSelector
      region={region}
      regions={regions}
      regionData={regionData}
      setRegion={changeRegion}
      {...props}
    />
  );
}

export type RegionSelectorProps = {
  regions?: string[];
  placeholder?: ReactNode;
  customMapping?: {
    [region: string]:
      | string
      | { name?: string; emoji?: string; locale?: string };
  };
  prioritizeCurrentLocaleRegion?: boolean;
  sortRegionsAlphabetically?: boolean;
  asLocaleSelector?: boolean;
  [key: string]: any;
};
