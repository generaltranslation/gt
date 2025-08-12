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
 * A multi-purpose dropdown component that allows users to select a region.
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
      : Array.from(regionToLocaleMap?.keys() || [localeRegion])
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
