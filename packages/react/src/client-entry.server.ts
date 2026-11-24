'use client';

// Server-rendering counterpart of client-entry.client.ts, matching the
// components index.server.ts exports. Exists for the Turbopack-specific
// tree-shaking reason described in client-entry.client.ts.

export { ServerGTProvider as GTProvider } from './provider/ServerGTProvider';
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
