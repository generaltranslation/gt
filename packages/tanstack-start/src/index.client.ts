'use client';

export { parseLocale } from './functions/parseLocale';

export {
  LocaleSelector,
  GTProvider,
  useSetLocale,
  useSetEnableI18n,
  useLocaleSelector,
  // ===== Setup ===== //
  initializeGT,
} from 'gt-react';

export {
  Branch,
  Plural,
  Derive,
  T,
  Currency,
  DateTime,
  RelativeTime,
  Var,
  Num,
} from '@generaltranslation/react-core/components';

export {
  useLocale,
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useLocales,
  useFormatLocales,
  useGT,
  useMessages,
  useTranslations,
} from '@generaltranslation/react-core/hooks';

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

export {
  getTranslationsSnapshot,
  t,
} from '@generaltranslation/react-core/pure';
