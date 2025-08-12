import React, { ReactNode, useEffect, useMemo } from 'react';
import { useRegionSelector } from '../hooks/useRegionSelector';

type RegionData = {
  code: string;
  name: string;
  locale: string;
};

/**
 * A multi-purpose dropdown component that allows users to select a region.
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
