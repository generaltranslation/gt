'server-only';

export { initializeGTSPA } from './setup/initializeGTSPA';
export { useLocaleSelector } from './components/useLocaleSelector';
export { useSetLocale, useSetEnableI18n } from './hooks/conditions-store';
export {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from './cookie-names';

// ===== Server hooks ===== //
export { useGT, useMessages, useTranslations } from './hooks/server-hooks';

// ===== Components ===== //
export { ServerGTProvider as GTProvider } from './provider/ServerGTProvider';
export { LocaleSelector } from './components/LocaleSelector';

export {
  // ===== Components ===== //
  Branch,
  Plural,
  Derive,
  GtInternalTranslateJsx,
  RscT,
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
