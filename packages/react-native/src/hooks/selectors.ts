import {
  useInternalLocaleSelector,
  useInternalRegionSelector,
  useSetLocale,
  useSetRegion,
} from '@generaltranslation/react-core/hooks';
import type {
  InternalLocaleSelectorResult,
  InternalRegionSelectorOptions,
  InternalRegionSelectorResult,
} from '@generaltranslation/react-core/hooks';

// Explicit return types are required: project references make TypeScript try to
// name the inferred selector types, which otherwise reach into
// generaltranslation's non-portable bundled declarations (TS2742).
export function useLocaleSelector(
  locales?: string[]
): InternalLocaleSelectorResult & { setLocale: (locale: string) => void } {
  const setLocale = useSetLocale();
  return { setLocale, ...useInternalLocaleSelector(locales) };
}

export function useRegionSelector(
  options?: InternalRegionSelectorOptions
): InternalRegionSelectorResult & {
  setLocale: (locale: string) => void;
  setRegion: (region: string | undefined) => void;
} {
  const setLocale = useSetLocale();
  const setRegion = useSetRegion();
  return { setLocale, setRegion, ...useInternalRegionSelector(options) };
}
