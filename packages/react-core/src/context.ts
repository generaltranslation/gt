// ===== Components ===== //
export { Branch } from './components/branches/Branch';
export { Plural } from './components/branches/Plural';
export { Derive } from './components/derivation/Derive';
export { T } from './components/translation/T';
export { Currency } from './components/variables/Currency';
export { DateTime } from './components/variables/DateTime';
export { Num } from './components/variables/Num';
export { RelativeTime } from './components/variables/RelativeTime';
export { Var } from './components/variables/Var';

// ===== Hooks ===== //
export { useLocale, useEnableI18n } from './hooks/condition-store';
export {
  useCustomMapping,
  useDefaultLocale,
  useLocales,
} from './hooks/external-store-hooks';
export { useGT } from './hooks/useGT';
export { useMessages } from './hooks/useMessages';
export { useTranslations } from './hooks/useTranslations';
export { useFormatLocales } from './hooks/utils';

// ===== Functions ===== //
export { getTranslationsSnapshot } from './functions/helpers/getTranslationsSnapshot';
export {
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
  mFallback,
  gtFallback,
} from 'gt-i18n';
export { t } from './functions/translation/t';

// ===== Internal ===== //
export { useInternalLocaleSelector } from './hooks/useInternalLocaleSelector';
export { InternalLocaleSelector } from './components/helpers/InternalLocaleSelector';
export { InternalGTProvider } from './context/InternalGTProvider';
export { internalInitializeGTSPA } from './setup/initializeGTSPA';
export { internalInitializeGTSSR } from './setup/initializeGTSSR';
export {
  getI18nStore,
  setI18nStore,
  isI18nStoreInitialized,
} from './i18n-store/singleton-operations';
export { setRenderStrategy, getRenderStrategy } from './setup/globals';
export {
  getReadonlyConditionStoreWithFallback,
  setReadonlyConditionStore,
} from './condition-store/singleton-operations';
export { WritableConditionStore } from 'gt-i18n/internal';
export type { WritableConditionStoreParams } from 'gt-i18n/internal';
export {
  getReactI18nManager,
  setReactI18nManager,
} from './i18n-manager/singleton-operations';
export { I18nStore } from './i18n-store/I18nStore';
export type { I18nStoreParams } from './i18n-store/I18nStore';
export type { InternalGTProviderProps } from './context/InternalGTProvider';
export type {
  ReactI18nManager,
  ReactI18nManagerParams,
} from './i18n-manager/ReactI18nManager';
