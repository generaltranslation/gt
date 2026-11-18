export {
  // ===== Components ===== //
  Branch,
  Ordinal,
  Plural,
  Derive,
  T,
  Currency,
  DateTime,
  RelativeTime,
  Var,
  N,
  Num,
  // Imported by the compiler's auto JSX injection
  GtInternalTranslateJsx,
  GtInternalVar,
} from '@generaltranslation/react-core/components';
export { LocaleSelector, useLocaleSelector } from 'gt-react';
export {
  // ===== Hooks ===== //
  useLocale,
  useSetLocale,
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useSetEnableI18n,
  useLocales,
  useFormatLocales,
  useGT,
  useMessages,
} from '@generaltranslation/react-core/hooks';
// ===== Functions ===== //
export {
  msg,
  mFallback,
  derive,
  plural,
  selectordinal,
  select,
  number,
  date,
  time,
  part,
  n,
  type GT,
  type GTOptions,
  type M,
  type Msg,
  type Part,
  type Placeholder,
} from 'gt-i18n';
