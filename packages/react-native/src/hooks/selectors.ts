import { useSetLocale, useSetRegion } from './condition-store';
import {
  useInternalLocaleSelector,
  useInternalRegionSelector,
} from '@generaltranslation/react-core/hooks';
import type { InternalRegionSelectorOptions } from '@generaltranslation/react-core/hooks';

export function useLocaleSelector(locales?: string[]) {
  const setLocale = useSetLocale();
  return { setLocale, ...useInternalLocaleSelector(locales) };
}

export function useRegionSelector(options?: InternalRegionSelectorOptions) {
  const setLocale = useSetLocale();
  const setRegion = useSetRegion();
  return { setLocale, setRegion, ...useInternalRegionSelector(options) };
}
