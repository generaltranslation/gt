'use client';

// Narrow client entry for framework client modules (e.g. gt-next's client
// entry and client-boundary). Turbopack-specific (webpack is unaffected):
// when the full gt-react entry is imported here and also shared with other
// client chunks, Turbopack keeps its unused exports, including
// initializeGTSPA and with it the i18nCache, in production client bundles.

export { BrowserGTProvider as GTProvider } from './provider/BrowserGTProvider';
export { LocaleSelector } from './components/LocaleSelector';
export { RegionSelector } from './components/RegionSelector';
export {
  Select,
  Ordinal,
  Plural,
  Derive,
  GtInternalTranslateJsx,
  GtInternalVar,
  T,
  Currency,
  DateTime,
  RelativeTime,
  Var,
  N,
  Num,
} from '@generaltranslation/react-core/components';
export {
  useLocale,
  useRegion,
  useDefaultLocale,
  useLocales,
  useGT,
  useMessages,
  useLocaleDirection,
  useLocaleProperties,
  useSetLocale,
} from '@generaltranslation/react-core/hooks';
export { useLocaleSelector } from './components/useLocaleSelector';
