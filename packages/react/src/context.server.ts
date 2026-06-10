'use client';

// This entrypoint is the SSR/context-capable runtime: hooks, providers, and
// interactive components. In React Server Component vocabulary that is a
// client module, so the directive marks the whole entrypoint as a
// server-to-client boundary. RSC framework integrations should prefer
// gt-react/context-rsc for hook-free rendering primitives and
// gt-react/context-client-boundary for client components.
// In non-RSC environments the directive is inert.

export { initializeGTSPA } from './setup/initializeGTSPA';
export { useLocaleSelector } from './components/useLocaleSelector';
export { useSetLocale, useSetEnableI18n } from './hooks/conditions-store';
export {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from './cookie-names';

// ===== Components ===== //
export { ServerGTProvider as GTProvider } from './provider/ServerGTProvider';
export { LocaleSelector } from './components/LocaleSelector';

export {
  // ===== Components ===== //
  Branch,
  Plural,
  Derive,
  GtInternalTranslateJsx,
  T,
  Currency,
  DateTime,
  RelativeTime,
  Var,
  Num,
  // ===== Hooks ===== //
  useLocale,
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useLocales,
  getFormatLocales,
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
  getReactI18nCache,
  setReactI18nCache,
  t,
  // ===== Setup ===== //
  internalInitializeGTSRA as initializeGT,
  internalInitializeGTSPA,
} from '@generaltranslation/react-core/context';
