// React surface for Astro islands. Each island needs its own <GTProvider>
// seeded with the serializable props from getGTProviderProps() (gt-astro/server);
// islands do not share React context in Astro.
export {
  // ===== Components ===== //
  Branch,
  Plural,
  Derive,
  T,
  Currency,
  DateTime,
  RelativeTime,
  Var,
  Num,
  GTProvider,
  // ===== Hooks ===== //
  useLocale,
  useSetLocale,
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useSetEnableI18n,
  useLocales,
  useLocaleSelector,
  useFormatLocales,
  useGT,
  useMessages,
  useTranslations,
  // ===== Functions ===== //
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
  mFallback,
  gtFallback,
  getTranslationsSnapshot,
  t,
} from 'gt-react';

export { LocaleSelector, type LocaleSelectorProps } from './LocaleSelector';
export { getLocalizedPath } from './utils';
export type { GTProviderIslandProps } from './server';
