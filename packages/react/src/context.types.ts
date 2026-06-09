import type { ServerGTProvider } from './provider/ServerGTProvider';

/**
 * Wrap GTProvider around the content that you want to translate
 */
export const GTProvider: typeof ServerGTProvider = () => {
  throw new Error(
    'gt-react: You have imported a function from the dedicated types entrypoint. If you are seeing this error, it means something has gone wrong.'
  );
};

export { initializeGTSPA } from './setup/initializeGTSPA';
export { LocaleSelector } from './components/LocaleSelector';
export { useLocaleSelector } from './components/useLocaleSelector';
export { useSetLocale, useSetEnableI18n } from './hooks/conditions-store';
export {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from './cookie-names';

export declare const RscBranch: typeof import('./components/branches/Branch').RscBranch;
export declare const RscPlural: typeof import('./components/branches/Plural').RscPlural;
export declare const RscDerive: typeof import('./components/derivation/Derive').RscDerive;
export declare const RscT: typeof import('./components/translation/T').RscT;
export declare const RscCurrency: typeof import('./components/variables/Currency').RscCurrency;
export declare const RscDateTime: typeof import('./components/variables/DateTime').RscDateTime;
export declare const RscNum: typeof import('./components/variables/Num').RscNum;
export declare const RscRelativeTime: typeof import('./components/variables/RelativeTime').RscRelativeTime;
export declare const RscVar: typeof import('./components/variables/Var').RscVar;

/**
 * TODO: throw error if any of these functions are called
 */
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
  t,
  // ===== Setup ===== //
  internalInitializeGTSRA as initializeGT,
  getReactI18nCache,
  setReactI18nCache,
  setReadonlyConditionStore,
} from '@generaltranslation/react-core/context';
