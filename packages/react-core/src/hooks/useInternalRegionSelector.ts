import { useMemo } from 'react';
import { useLocales } from './i18n-config';
import { useLocale, useRegion } from './condition-store';
import type { CustomRegionMapping } from '@generaltranslation/format';
import { getI18nConfig } from 'gt-i18n/internal';

export type RegionData = {
  code: string;
  name: string;
  emoji: string;
  locale: string;
};

export type InternalRegionSelectorOptions = {
  regions?: string[];
  customMapping?: {
    [region: string]: string | CustomRegionMapping[string];
  };
  prioritizeCurrentLocaleRegion?: boolean;
  sortRegionsAlphabetically?: boolean;
};

export type InternalRegionSelectorResult = {
  region: string | undefined;
  regions: string[];
  regionData: Map<string, RegionData>;
  locale: string;
  localeRegion: string;
};

/**
 * Internal logic for region selection in applications supporting multiple regions.
 *
 * Returns the current region, an ordered list of available regions (inferred
 * from the supported locales when not provided), and a map of region codes to
 * their display data (name, emoji, associated locale).
 */
export function useInternalRegionSelector({
  regions: _regions,
  customMapping,
  prioritizeCurrentLocaleRegion = true,
  sortRegionsAlphabetically = true,
}: InternalRegionSelectorOptions = {}): InternalRegionSelectorResult {
  // Retrieve the locale, locales, and region
  const contextLocales = useLocales();
  const locale = useLocale();
  const region = useRegion();
  const { regionCode: localeRegion } = getI18nConfig().getLocaleProperties(
    locale,
    { locale }
  );

  const [
    regions, // ordered list of ISO 3166 region codes
    regionData, // map of ISO 3166 region codes to region display data, potentially not ordered
  ] = useMemo<[string[], Map<string, RegionData>]>(() => {
    const i18nConfig = getI18nConfig();
    // By the name each locale is configured under: a locale's code can be one
    // that is not configured, when the locale is an alias. A region shared by
    // several locales goes to the first one configured.
    const regionToLocaleMap = new Map<string, string>();
    for (const l of contextLocales) {
      const { regionCode } = i18nConfig.getLocaleProperties(l, { locale });
      if (!regionToLocaleMap.has(regionCode))
        regionToLocaleMap.set(regionCode, l);
    }

    const regions = _regions
      ? [..._regions]
      : Array.from(regionToLocaleMap?.keys() || [localeRegion]);

    const regionData = new Map<string, RegionData>(
      regions.map((r: string) => {
        return [
          r,
          {
            locale:
              (r === localeRegion ? locale : regionToLocaleMap.get(r)) ||
              locale,
            ...i18nConfig.getRegionProperties(r, { locale }),
            ...(typeof customMapping?.[r] === 'string'
              ? { name: customMapping?.[r] }
              : customMapping?.[r]),
          },
        ];
      })
    );

    if (sortRegionsAlphabetically) {
      const collator = new Intl.Collator();
      regions.sort((a, b) =>
        collator.compare(regionData.get(a)!.name, regionData.get(b)!.name)
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
  }, [
    _regions,
    customMapping,
    locale,
    localeRegion,
    contextLocales,
    prioritizeCurrentLocaleRegion,
    sortRegionsAlphabetically,
  ]);

  return {
    region,
    regions,
    regionData,
    locale,
    localeRegion,
  };
}
