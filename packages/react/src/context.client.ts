'use client';

import type { RscT as CoreRscT } from '@generaltranslation/react-core/context';

export { BrowserGTProvider as GTProvider } from './provider/BrowserGTProvider';
export { initializeGTSPA } from './setup/initializeGTSPA';
export { LocaleSelector } from './components/LocaleSelector';
export { useLocaleSelector } from './components/useLocaleSelector';
export { useSetLocale, useSetEnableI18n } from './hooks/conditions-store';
export {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from './cookie-names';

export const RscT: typeof CoreRscT = Object.assign(
  () => {
    throw new Error('gt-react: RscT cannot be used in a client environment.');
  },
  { _gtt: 'translate-server' as const }
);

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
  internalInitializeGTSSR as initializeGT,
} from '@generaltranslation/react-core/context';
