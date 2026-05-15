'use client';

export { CSRGTProvider as GTProvider } from './refactor/provider/CSRGTProvider';
export { initializeGTSPA } from './refactor/setup/initializeGTSPA';

export {
  // ===== Components ===== //
  Branch,
  Plural,
  Derive,
  LocaleSelector,
  T,
  Currency,
  DateTime,
  RelativeTime,
  Var,
  Num,
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
  getTranslationsSnapshot,
  // ===== Setup ===== //
  internalInitializeGTSSR as initializeGT,
} from '@generaltranslation/react-core/context';
