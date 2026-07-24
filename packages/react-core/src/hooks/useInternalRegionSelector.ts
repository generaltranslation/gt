import { useMemo } from 'react';
import { useCustomMapping, useLocales } from './i18n-config';
import { useLocale, useRegion } from './condition-store';
import {
  getLocaleProperties,
  getRegionProperties,
} from '@generaltranslation/format';
import type {
  CustomMapping,
  CustomRegionMapping,
} from '@generaltranslation/format/types';

export type RegionData = {
  code: string;
  name: string;
  emoji: string;
  locale: string;
};

export type InternalRegionSelectorOptions = {
  regions?: string[];
  customMapping?: {
    [region: string]:
      | string
      | { name?: string; emoji?: string; locale?: string };
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
  const localeCustomMapping = useCustomMapping();
  const locale = useLocale();
  const region = useRegion();
  const { regionCode: localeRegion } = getLocaleProperties(
    locale,
    locale,
    localeCustomMapping
  );

  const [
    regions, // ordered list of ISO 3166 region codes
    regionData, // map of ISO 3166 region codes to region display data, potentially not ordered
  ] = useMemo<[string[], Map<string, RegionData>]>(() => {
    const localeRegionMapping = getCustomRegionMapping(localeCustomMapping);
    const regionToLocaleMap = new Map(
      contextLocales.map((l) => {
        const lp = getLocaleProperties(l, locale, localeCustomMapping); // has to be directly called so sourceLocale can be in the user's current locale
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
            ...getRegionProperties(r, locale, localeRegionMapping),
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
  }, [
    _regions,
    customMapping,
    locale,
    localeRegion,
    contextLocales,
    localeCustomMapping,
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

function getCustomRegionMapping(
  customMapping: CustomMapping
): CustomRegionMapping {
  const regionMapping: CustomRegionMapping = {};
  for (const [mappedLocale, mapping] of Object.entries(customMapping)) {
    if (
      typeof mapping === 'object' &&
      mapping?.regionCode &&
      !regionMapping[mapping.regionCode]
    ) {
      regionMapping[mapping.regionCode] = {
        locale: mappedLocale,
        ...(mapping.regionName && { name: mapping.regionName }),
        ...(mapping.emoji && { emoji: mapping.emoji }),
      };
    }
  }
  return regionMapping;
}
