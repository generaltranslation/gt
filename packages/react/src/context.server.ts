'server-only';

export { initializeGTSPA } from './setup/initializeGTSPA';
export { useLocaleSelector } from './components/useLocaleSelector';
export { useSetLocale, useSetEnableI18n } from './hooks/conditions-store';
export {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from './cookie-names';
export { RscBranch } from './components/branches/Branch';
export { RscPlural } from './components/branches/Plural';
export { RscDerive } from './components/derivation/Derive';
export { RscT } from './components/translation/T';
export { RscCurrency } from './components/variables/Currency';
export { RscDateTime } from './components/variables/DateTime';
export { RscNum } from './components/variables/Num';
export { RscRelativeTime } from './components/variables/RelativeTime';
export { RscVar } from './components/variables/Var';

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
  setReadonlyConditionStore,
  t,
  // ===== Setup ===== //
  internalInitializeGTSRA as initializeGT,
  internalInitializeGTSPA,
} from '@generaltranslation/react-core/context';
