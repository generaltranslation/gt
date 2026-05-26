'server-only';

export { SSRGTProvider as GTProvider } from './provider/SSRGTProvider';
export { initializeGTSPA } from './setup/initializeGTSPA';
export { LocaleSelector } from './components/LocaleSelector';
export { useLocaleSelector } from './components/useLocaleSelector';
export { useSetLocale, useSetEnableI18n } from './hooks/conditions-store';
export {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from './cookie-names';

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
  // ===== Hooks ===== //
  useLocale,
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useLocales,
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
  internalInitializeGTSSR as initializeGT,
  internalInitializeGTSPA,
} from '@generaltranslation/react-core/context';

/** @deprecated use getReactI18nCache instead */
export { getReactI18nCache as getReactI18nManager } from '@generaltranslation/react-core/context';
/** @deprecated use setReactI18nCache instead */
export { setReactI18nCache as setReactI18nManager } from '@generaltranslation/react-core/context';
