import { CSRGTProvider } from './provider/CSRGTProvider';

/**
 * Wrap GTProvider around the content that you want to translate
 */
export const GTProvider: typeof CSRGTProvider = () => {
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

/**
 * TODO: throw error if any of these functions are called
 */
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
  t,
  // ===== Setup ===== //
  internalInitializeGTSSR as initializeGT,
  getReactI18nCache,
  setReactI18nCache,
} from '@generaltranslation/react-core/context';

/** @deprecated use getReactI18nCache instead */
export { getReactI18nCache as getReactI18nManager } from '@generaltranslation/react-core/context';
/** @deprecated use setReactI18nCache instead */
export { setReactI18nCache as setReactI18nManager } from '@generaltranslation/react-core/context';
